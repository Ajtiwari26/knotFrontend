import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
// v3 - Persistent cache + background scan + thumbnail support

const CACHE_KEY = 'local_music_cache_v5';
const METADATA_CACHE_KEY = 'local_music_metadata_cache_v1';
const MAX_CACHE_SIZE = 50000; // Increased significantly for 'unlimited' feel

export interface LocalTrack {
  id: string;
  uri: string;
  filename: string;
  title: string;
  artist: string;
  duration_ms: number;
  albumId?: string;
  thumbnail?: string;
}

export class LocalMusicService {
  private static cachedTracks: LocalTrack[] | null = null;
  private static isScanning = false;
  private static listenerSubscription: any = null;

  /**
   * Initialize listeners to catch new songs instantly without polling.
   */
  static init() {
    if (this.listenerSubscription) return;
    
    // Listen for system media store changes
    this.listenerSubscription = MediaLibrary.addListener(() => {
      console.log('[LocalMusicService] System MediaStore changed! Updating cache...');
      this.silentUpdate();
    });
  }

  /**
   * Request permission to access media library.
   * Returns true if granted.
   */
  static async requestPermission(): Promise<boolean> {
    const perms = await MediaLibrary.getPermissionsAsync();
    console.log('[LocalMusicService] MediaLibrary permission status:', perms);
    
    if (perms.granted) return true;

    console.log('[LocalMusicService] Requesting MediaLibrary permission...');
    const request = await MediaLibrary.requestPermissionsAsync();
    
    if (!request.granted) {
      console.warn('[LocalMusicService] MediaLibrary permission denied. On Android 13+, you might need to manually enable "All Files Access" in Settings > Apps > Knot.');
    }
    
    return request.granted;
  }

  /**
   * Check if we already have permission.
   */
  static async hasPermission(): Promise<boolean> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Scan the device for audio files.
   * Returns a list of LocalTrack objects sorted by filename.
   * Uses a 3-tier cache: memory -> disk (AsyncStorage) -> live scan.
   */
  /**
   * Scan the device for audio files.
   * Returns a list of LocalTrack objects sorted by filename.
   * Uses a 3-tier cache: memory -> disk (AsyncStorage) -> live scan.
   */
  static async getDeviceSongs(
    pageSize: number = 100,
    afterCursor?: string
  ): Promise<{ tracks: LocalTrack[]; endCursor: string; hasNextPage: boolean }> {
    // 1. Try disk cache if memory empty
    if (!this.cachedTracks && !afterCursor) {
      try {
        const diskCache = await AsyncStorage.getItem(CACHE_KEY);
        if (diskCache) {
          const parsed = JSON.parse(diskCache) as LocalTrack[];
          // Force refresh if thumbnail does NOT have the albumart path
          const needsRefresh = parsed.length > 0 && parsed[0].thumbnail && !parsed[0].thumbnail.includes('albumart');
          
          if (needsRefresh) {
            console.log('[LocalMusicService] Old cache detected. Forcing full rescan.');
            await AsyncStorage.removeItem(CACHE_KEY);
            this.cachedTracks = null;
          } else {
            this.cachedTracks = parsed;
            console.log(`[LocalMusicService] Loaded ${this.cachedTracks.length} tracks from disk cache.`);
            this.silentUpdate();
          }
        }
      } catch (e) {
        console.warn('[LocalMusicService] Failed to read disk cache:', e);
      }
    }

    // 2. If we have cached tracks, handle pagination from cache
    if (this.cachedTracks) {
      const startIndex = afterCursor ? (afterCursor.startsWith('cache-') ? parseInt(afterCursor.split('-')[1]) : 0) : 0;
      const endIndex = startIndex + pageSize;
      const paginatedTracks = this.cachedTracks.slice(startIndex, endIndex);
      const nextIndex = endIndex < this.cachedTracks.length ? endIndex : -1;

      return {
        tracks: paginatedTracks,
        endCursor: nextIndex !== -1 ? `cache-${nextIndex}` : '',
        hasNextPage: nextIndex !== -1,
      };
    }

    // 3. Fallback/Initial live scan:
    try {
      console.log('[LocalMusicService] Disk cache empty, performing quick live scan...');
      let liveTracks: LocalTrack[] = [];
      
      // Load downloaded tracks first (fast and always available)
      const downloaded = await this.loadDownloadedTracks();
      liveTracks = [...downloaded];

      // Query MediaLibrary if we have permission
      const hasPerm = await this.hasPermission();
      if (hasPerm) {
        // Load metadata cache for the quick scan
        let metadataCache: Record<string, { title: string; artist: string; album?: string; modificationTime: number }> = {};
        try {
          const cachedMeta = await AsyncStorage.getItem(METADATA_CACHE_KEY);
          if (cachedMeta) {
            metadataCache = JSON.parse(cachedMeta);
          }
        } catch {}

        const mediaPage = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 200, // Fetch a quick first page
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });

        const mapped: LocalTrack[] = [];
        for (const asset of mediaPage.assets) {
          if (asset.duration <= 5 && asset.duration !== 0) continue;
          
          const mTime = asset.modificationTime || asset.creationTime || 0;
          let title = cleanTitle(asset.filename);
          let artist = 'Local File';
          let album = undefined;
          
          const cached = metadataCache[asset.uri];
          if (cached && cached.modificationTime === mTime) {
            title = cached.title;
            artist = cached.artist;
            album = cached.album;
          } else {
            const parsed = await parseAudioMetadata(asset.uri, asset.id);
            if (parsed.title) title = parsed.title;
            if (parsed.artist) artist = parsed.artist;
            if (parsed.album) album = parsed.album;
            
            metadataCache[asset.uri] = { title, artist, album, modificationTime: mTime };
          }

          mapped.push({
            id: asset.id,
            uri: asset.uri,
            filename: asset.filename,
            title: title,
            artist: artist,
            duration_ms: (asset.duration || 0) * 1000,
            albumId: asset.albumId,
            thumbnail: `content://media/external/audio/media/${asset.id}/albumart`,
          });
        }
        
        AsyncStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(metadataCache)).catch(() => {});

        liveTracks = [...liveTracks, ...mapped];
      }

      // Deduplicate liveTracks
      const dedupMap = new Map<string, LocalTrack>();
      for (const track of liveTracks) {
        const key = getDeduplicationKey(track);
        const existing = dedupMap.get(key);
        if (!existing || getMetadataScore(track) > getMetadataScore(existing)) {
          dedupMap.set(key, track);
        }
      }
      const finalLive = Array.from(dedupMap.values());

      // Trigger full background scan asynchronously to populate cache
      this.backgroundScan();

      // Return paginated live tracks
      const startIndex = afterCursor ? (afterCursor.startsWith('cache-') ? parseInt(afterCursor.split('-')[1]) : 0) : 0;
      const endIndex = startIndex + pageSize;
      const paginatedTracks = finalLive.slice(startIndex, endIndex);
      const nextIndex = endIndex < finalLive.length ? endIndex : -1;

      return {
        tracks: paginatedTracks,
        endCursor: nextIndex !== -1 ? `cache-${nextIndex}` : '',
        hasNextPage: nextIndex !== -1,
      };
    } catch (e) {
      console.warn('[LocalMusicService] Live scan failed:', e);
      return { tracks: [], endCursor: '', hasNextPage: false };
    }
  }

  /**
   * Helper: Load all downloaded track details stored in AsyncStorage under downloaded_track_*
   */
  private static async loadDownloadedTracks(): Promise<LocalTrack[]> {
    const downloadedTracks: LocalTrack[] = [];
    try {
      const keys = await AsyncStorage.getAllKeys();
      const downloadedKeys = keys.filter(k => k.startsWith('downloaded_track_'));
      
      for (const key of downloadedKeys) {
        try {
          const val = await AsyncStorage.getItem(key);
          if (val) {
            const track = JSON.parse(val);
            const uri = track.local_uri || track.uri;
            if (uri) {
              let exists = true;
              if (uri.startsWith('file://')) {
                const info = await FileSystem.getInfoAsync(uri);
                exists = info.exists;
              }
              if (exists) {
                downloadedTracks.push({
                  id: uri,
                  uri: uri,
                  filename: track.filename || `${cleanTitle(track.title)}.mp3`,
                  title: track.title,
                  artist: track.artist || 'Downloaded Track',
                  duration_ms: track.duration_ms || 0,
                  thumbnail: track.thumbnail || undefined,
                });
              }
            }
          }
        } catch (e) {
          console.warn('[LocalMusicService] Failed to load downloaded track for key:', key, e);
        }
      }
    } catch (e) {
      console.warn('[LocalMusicService] Failed to load downloaded tracks list:', e);
    }
    return downloadedTracks;
  }

  /**
   * Background scan - discovers all music (MediaStore + crawler + downloads) and persists to disk.
   */
  private static async backgroundScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      console.log('[LocalMusicService] Starting full background scan...');
      let mediaTracks: LocalTrack[] = [];
      let crawledTracks: LocalTrack[] = [];
      let downloadedTracks: LocalTrack[] = [];

      // Load metadata cache
      let metadataCache: Record<string, { title: string; artist: string; album?: string; modificationTime: number }> = {};
      try {
        const cachedMeta = await AsyncStorage.getItem(METADATA_CACHE_KEY);
        if (cachedMeta) {
          metadataCache = JSON.parse(cachedMeta);
        }
      } catch (e) {
        console.warn('[LocalMusicService] Failed to load metadata cache:', e);
      }
      let isMetaCacheDirty = false;
      const onCacheDirty = () => { isMetaCacheDirty = true; };

      // 1. Scan downloaded tracks (no permission required)
      try {
        downloadedTracks = await this.loadDownloadedTracks();
        console.log(`[LocalMusicService] Loaded ${downloadedTracks.length} downloaded tracks.`);
      } catch (e) {
        console.warn('[LocalMusicService] Failed to load downloaded tracks:', e);
      }

      // 2. Scan MediaLibrary if permission is granted
      const hasPerm = await this.hasPermission();
      if (hasPerm) {
        try {
          let cursor: string | undefined;
          let hasMore = true;

          while (hasMore) {
            const result = await MediaLibrary.getAssetsAsync({
              mediaType: [MediaLibrary.MediaType.audio],
              first: 500,
              after: cursor,
            });

            if (!result || !result.assets || result.assets.length === 0) break;

            const mapped: LocalTrack[] = [];
            for (const asset of result.assets) {
              if (asset.duration <= 5 && asset.duration !== 0) continue;
              
              const mTime = asset.modificationTime || asset.creationTime || 0;
              let title = cleanTitle(asset.filename);
              let artist = 'Local File';
              let album = undefined;
              
              const cached = metadataCache[asset.uri];
              if (cached && cached.modificationTime === mTime) {
                title = cached.title;
                artist = cached.artist;
                album = cached.album;
              } else {
                const parsed = await parseAudioMetadata(asset.uri, asset.id);
                if (parsed.title) title = parsed.title;
                if (parsed.artist) artist = parsed.artist;
                if (parsed.album) album = parsed.album;
                
                metadataCache[asset.uri] = { title, artist, album, modificationTime: mTime };
                isMetaCacheDirty = true;
              }

              mapped.push({
                id: asset.id,
                uri: asset.uri,
                filename: asset.filename,
                title: title,
                artist: artist,
                duration_ms: (asset.duration || 0) * 1000,
                albumId: asset.albumId,
                thumbnail: `content://media/external/audio/media/${asset.id}/albumart`,
              });
            }

            mediaTracks = [...mediaTracks, ...mapped];
            cursor = result.endCursor;
            hasMore = result.hasNextPage;
            
            if (mediaTracks.length >= MAX_CACHE_SIZE) {
              console.log(`[LocalMusicService] Reached max cache size (${MAX_CACHE_SIZE}), stopping MediaLibrary scan.`);
              break;
            }
          }
          console.log(`[LocalMusicService] MediaLibrary scan found ${mediaTracks.length} tracks.`);
        } catch (e) {
          console.warn('[LocalMusicService] MediaStore query failed:', e);
        }

        // 3. Fallback scan of common directories (in case media index is out of sync or missing files)
        try {
          const fallback = await this.fallbackScan(metadataCache, onCacheDirty);
          crawledTracks = fallback.tracks;
          console.log(`[LocalMusicService] Crawled common directories found ${crawledTracks.length} tracks.`);
        } catch (e) {
          console.warn('[LocalMusicService] Direct crawl failed:', e);
        }
      } else {
        console.log('[LocalMusicService] MediaLibrary permission not granted. Skipping MediaLibrary and directory crawl.');
      }

      // Persist metadata cache if updated
      if (isMetaCacheDirty) {
        try {
          await AsyncStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(metadataCache));
          console.log('[LocalMusicService] Persisted updated metadata cache.');
        } catch (e) {
          console.warn('[LocalMusicService] Failed to persist metadata cache:', e);
        }
      }

      // Merge and deduplicate all tracks
      const allMerged = [...downloadedTracks, ...mediaTracks, ...crawledTracks];
      const dedupMap = new Map<string, LocalTrack>();

      for (const track of allMerged) {
        const key = getDeduplicationKey(track);
        const existing = dedupMap.get(key);

        if (!existing) {
          dedupMap.set(key, track);
        } else {
          // Keep the track with better metadata
          const existingScore = getMetadataScore(existing);
          const currentScore = getMetadataScore(track);
          if (currentScore > existingScore) {
            dedupMap.set(key, track);
          }
        }
      }

      const finalTracks = Array.from(dedupMap.values());
      // Sort by title
      finalTracks.sort((a, b) => a.title.localeCompare(b.title));

      this.cachedTracks = finalTracks;
      console.log(`[LocalMusicService] Scan complete. Total unique cached tracks: ${finalTracks.length}`);

      // Persist to disk
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalTracks));
        console.log(`[LocalMusicService] Persisted ${finalTracks.length} tracks to disk.`);
      } catch (e) {
        console.warn('[LocalMusicService] Failed to persist cache:', e);
      }
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Silent update: re-scans in the background and updates cache if new files found.
   */
  private static async silentUpdate(): Promise<void> {
    if (this.isScanning) return;
    
    setTimeout(async () => {
      try {
        const hasPerm = await this.hasPermission();
        if (!hasPerm) {
          // If no permission, we can just scan for new downloaded tracks
          const downloaded = await this.loadDownloadedTracks();
          const cachedCount = this.cachedTracks?.length || 0;
          if (downloaded.length !== cachedCount) {
            console.log('[LocalMusicService] Silent update: downloaded tracks count changed. Re-scanning...');
            this.cachedTracks = null;
            await this.backgroundScan();
          }
          return;
        }

        const result = await MediaLibrary.getAssetsAsync({
          mediaType: [MediaLibrary.MediaType.audio],
          first: 1,
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        const totalCount = result.totalCount || 0;
        
        // Add downloaded tracks count
        const downloaded = await this.loadDownloadedTracks();
        const expectedCount = totalCount + downloaded.length;
        const cachedCount = this.cachedTracks?.length || 0;

        if (expectedCount !== cachedCount) {
          console.log(`[LocalMusicService] Silent update: expected ${expectedCount} vs cached ${cachedCount}. Re-scanning...`);
          this.cachedTracks = null;
          await this.backgroundScan();
        } else {
          console.log(`[LocalMusicService] Silent update: no changes detected.`);
        }
      } catch (e) {
        console.warn('[LocalMusicService] Silent update failed:', e);
      }
    }, 3000); // Delay 3s to not block UI
  }

  /**
   * Fallback: Directly crawl common directories using FileSystem.
   * Useful when MediaStore is not indexed or broken.
   */
  private static async fallbackScan(
    metadataCache: Record<string, { title: string; artist: string; album?: string; modificationTime: number }>,
    onCacheDirty: () => void
  ): Promise<{ tracks: LocalTrack[]; endCursor: string; hasNextPage: boolean }> {
    const commonDirs = [
      'file:///storage/emulated/0/Music',
      'file:///storage/emulated/0/Music/Knot Music',
      'file:///storage/emulated/0/Knot Music',
      'file:///storage/emulated/0/Download',
      'file:///storage/emulated/0/Download/Knot Music',
      'file:///storage/emulated/0/Recordings',
      'file:///storage/emulated/0/Audior',
    ];

    let foundTracks: LocalTrack[] = [];

    for (const dir of commonDirs) {
      try {
        console.log(`[LocalMusicService] Fallback scanning: ${dir}`);
        const files = await FileSystem.readDirectoryAsync(dir);
        
        for (const file of files) {
          if (file.match(/\.(mp3|m4a|wav|aac|flac)$/i)) {
            const uri = `${dir}/${file}`;
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists) {
              const mTime = info.modificationTime || 0;
              let title = cleanTitle(file);
              let artist = 'Local File (Scanned)';
              let album = undefined;
              
              const cached = metadataCache[uri];
              if (cached && cached.modificationTime === mTime) {
                title = cached.title;
                artist = cached.artist;
                album = cached.album;
              } else {
                const parsed = await parseAudioMetadata(uri);
                if (parsed.title) title = parsed.title;
                if (parsed.artist) artist = parsed.artist;
                if (parsed.album) album = parsed.album;
                
                metadataCache[uri] = { title, artist, album, modificationTime: mTime };
                onCacheDirty();
              }

              foundTracks.push({
                id: uri,
                uri: uri,
                filename: file,
                title: title,
                artist: artist,
                duration_ms: 0,
                albumId: 'fallback',
              });
            }
          }
        }
      } catch (e) {
        console.warn(`[LocalMusicService] Failed to read ${dir}:`, (e as Error).message);
      }
    }

    console.log(`[LocalMusicService] Fallback found ${foundTracks.length} tracks.`);
    return {
      tracks: foundTracks,
      endCursor: '',
      hasNextPage: false,
    };
  }

  /**
   * Search local songs by filename, title, and artist.
   */
  static async searchDeviceSongs(query: string): Promise<LocalTrack[]> {
    const q = query.toLowerCase();

    // 1. If already in memory, filter immediately (instant)
    if (this.cachedTracks) {
       return this.cachedTracks.filter(
         (t) => t.title.toLowerCase().includes(q) || 
                t.filename.toLowerCase().includes(q) ||
                (t.artist && t.artist.toLowerCase().includes(q))
       );
    }

    // 2. Not in memory, try to load from disk cache
    try {
      const diskCache = await AsyncStorage.getItem(CACHE_KEY);
      if (diskCache) {
        this.cachedTracks = JSON.parse(diskCache) as LocalTrack[];
        return this.cachedTracks.filter(
          (t) => t.title.toLowerCase().includes(q) || 
                 t.filename.toLowerCase().includes(q) ||
                 (t.artist && t.artist.toLowerCase().includes(q))
        );
      }
    } catch (e) {
      console.warn('[LocalMusicService] Failed to read disk cache during search:', e);
    }

    // 3. Last resort: Perform a quick initial scan and populate memory
    // This only happens on the very first search if cache is totally empty
    const result = await this.getDeviceSongs(2000); 
    // Note: getDeviceSongs sets this.cachedTracks if it loads from disk
    // If not, we use the results from the live scan
    const tracksToFilter = this.cachedTracks || result.tracks;
    
    return tracksToFilter.filter(
      (t) => t.title.toLowerCase().includes(q) || 
             t.filename.toLowerCase().includes(q) ||
             (t.artist && t.artist.toLowerCase().includes(q))
    );
  }

  /**
   * Get all cached tracks (for matching by filename).
   */
  static getAllCachedTracks(): LocalTrack[] {
    return this.cachedTracks || [];
  }

  /**
   * Force a full scan to populate cache.
   */
  static async forceRescan(): Promise<void> {
    this.cachedTracks = null;
    await this.backgroundScan();
  }
}

/**
 * Clean up a filename into a readable title.
 * e.g. "01_-_Shape_of_You_(320kbps).mp3" → "Shape of You"
 */
function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')          // remove extension
    .replace(/^\d+[\s._-]+/, '')      // remove track number prefix
    .replace(/[\s._-]+/g, ' ')        // replace separators with spaces
    .replace(/\(\d+kbps\)/gi, '')     // remove bitrate tags
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim();
}

function getDeduplicationKey(track: LocalTrack): string {
  // Normalize filename or title
  const name = track.filename || track.title || '';
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/[^a-z0-9]/g, ''); // alphanumeric only
}

function getMetadataScore(track: LocalTrack): number {
  let score = 0;
  // If track has a specific artist instead of generic placeholder
  if (
    track.artist && 
    track.artist !== 'Local File' && 
    track.artist !== 'Local File (Scanned)' && 
    track.artist !== 'Unknown Artist' &&
    track.artist !== 'Downloaded Track'
  ) {
    score += 10;
  }
  // If track has thumbnail
  if (track.thumbnail && !track.thumbnail.includes('placeholder') && !track.thumbnail.includes('icon.png')) {
    score += 5;
  }
  // If duration is valid
  if (track.duration_ms && track.duration_ms > 0) {
    score += 2;
  }
  return score;
}

// Custom Base64 to Uint8Array decoder
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
  base64Lookup[base64Chars.charCodeAt(i)] = i;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bufferLength = cleanBase64.length * 0.75;
  let len = cleanBase64.length;
  let padding = 0;
  if (cleanBase64[len - 1] === '=') {
    padding++;
    if (cleanBase64[len - 2] === '=') {
      padding++;
    }
  }
  const bytes = new Uint8Array(bufferLength - padding);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = base64Lookup[cleanBase64.charCodeAt(i)];
    const encoded2 = base64Lookup[cleanBase64.charCodeAt(i + 1)];
    const encoded3 = base64Lookup[cleanBase64.charCodeAt(i + 2)];
    const encoded4 = base64Lookup[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bytes.length) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bytes.length) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  return bytes;
}

function decodeTextFrame(bytes: Uint8Array, start: number, length: number): string {
  if (length <= 1) return '';
  const encoding = bytes[start];
  const dataStart = start + 1;
  const dataLength = length - 1;

  if (encoding === 0) {
    // ISO-8859-1 (Latin1)
    let str = '';
    for (let i = 0; i < dataLength; i++) {
      const charCode = bytes[dataStart + i];
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str.trim();
  } else if (encoding === 1) {
    // UTF-16 with BOM
    if (dataLength < 2) return '';
    const littleEndian = (bytes[dataStart] === 0xFF && bytes[dataStart + 1] === 0xFE);
    let str = '';
    for (let i = 2; i < dataLength - 1; i += 2) {
      const idx = dataStart + i;
      const val = littleEndian 
        ? (bytes[idx] | (bytes[idx + 1] << 8))
        : ((bytes[idx] << 8) | bytes[idx + 1]);
      if (val === 0) break;
      str += String.fromCharCode(val);
    }
    return str.trim();
  } else if (encoding === 2) {
    // UTF-16BE without BOM
    let str = '';
    for (let i = 0; i < dataLength - 1; i += 2) {
      const idx = dataStart + i;
      const val = (bytes[idx] << 8) | bytes[idx + 1];
      if (val === 0) break;
      str += String.fromCharCode(val);
    }
    return str.trim();
  } else if (encoding === 3) {
    // UTF-8
    let str = '';
    let i = 0;
    while (i < dataLength) {
      const idx = dataStart + i;
      const b = bytes[idx];
      if (b === 0) break;
      if (b < 128) {
        str += String.fromCharCode(b);
        i++;
      } else if (b > 191 && b < 224 && i + 1 < dataLength) {
        const b2 = bytes[dataStart + i + 1];
        str += String.fromCharCode(((b & 31) << 6) | (b2 & 63));
        i += 2;
      } else if (i + 2 < dataLength) {
        const b2 = bytes[dataStart + i + 1];
        const b3 = bytes[dataStart + i + 2];
        str += String.fromCharCode(((b & 15) << 12) | ((b2 & 63) << 6) | (b3 & 63));
        i += 3;
      } else {
        i++;
      }
    }
    return str.trim();
  }
  return '';
}

function parseID3v1(bytes: Uint8Array): { title: string; artist: string; album: string } {
  if (bytes[0] !== 84 || bytes[1] !== 65 || bytes[2] !== 71) { // "TAG"
    return { title: '', artist: '', album: '' };
  }
  
  const decodeString = (start: number, length: number): string => {
    let str = '';
    for (let i = 0; i < length; i++) {
      const charCode = bytes[start + i];
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str.trim();
  };

  return {
    title: decodeString(3, 30),
    artist: decodeString(33, 30),
    album: decodeString(63, 30)
  };
}

async function parseAudioMetadata(uri: string, assetId?: string): Promise<{ title?: string; artist?: string; album?: string }> {
  try {
    let readableUri = uri;
    if (uri.startsWith('file:///storage/emulated/') && assetId && /^\d+$/.test(assetId)) {
      readableUri = `content://media/external/audio/media/${assetId}`;
    }
    const headerBase64 = await FileSystem.readAsStringAsync(readableUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 10
    });
    
    if (!headerBase64) return {};
    
    const headerBytes = base64ToUint8Array(headerBase64);
    if (headerBytes.length < 10) return {};
    
    if (headerBytes[0] === 0x49 && headerBytes[1] === 0x44 && headerBytes[2] === 0x33) {
      const version = headerBytes[3];
      const flags = headerBytes[5];
      const size = ((headerBytes[6] & 0x7f) << 21) |
                   ((headerBytes[7] & 0x7f) << 14) |
                   ((headerBytes[8] & 0x7f) << 7) |
                   (headerBytes[9] & 0x7f);
                   
      if (size > 0) {
        const readSize = Math.min(size, 256 * 1024);
        const tagDataBase64 = await FileSystem.readAsStringAsync(readableUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: 10,
          length: readSize
        });
        
        if (tagDataBase64) {
          const tagDataBytes = base64ToUint8Array(tagDataBase64);
          let offset = 0;
          
          if ((flags & 0x40) !== 0) {
            if (tagDataBytes.length >= 4) {
              if (version === 3) {
                const extSize = (tagDataBytes[0] << 24) | (tagDataBytes[1] << 16) | (tagDataBytes[2] << 8) | tagDataBytes[3];
                offset = extSize + 4;
              } else if (version === 4) {
                const extSize = ((tagDataBytes[0] & 0x7f) << 21) |
                                ((tagDataBytes[1] & 0x7f) << 14) |
                                ((tagDataBytes[2] & 0x7f) << 7) |
                                (tagDataBytes[3] & 0x7f);
                offset = extSize;
              }
            }
          }
          
          let title = '';
          let artist = '';
          let album = '';
          
          if (version === 2) {
            while (offset + 6 <= tagDataBytes.length) {
              if (tagDataBytes[offset] === 0) break;
              const frameId = String.fromCharCode(
                tagDataBytes[offset],
                tagDataBytes[offset + 1],
                tagDataBytes[offset + 2]
              );
              const frameSize = (tagDataBytes[offset + 3] << 16) |
                                (tagDataBytes[offset + 4] << 8) |
                                tagDataBytes[offset + 5];
              const dataOffset = offset + 6;
              if (dataOffset + frameSize > tagDataBytes.length) break;
              
              if (frameId === 'TT2') title = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              else if (frameId === 'TP1') artist = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              else if (frameId === 'TAL') album = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              
              if (title && artist) break;
              offset += 6 + frameSize;
            }
          } else {
            while (offset + 10 <= tagDataBytes.length) {
              if (tagDataBytes[offset] === 0) break;
              const frameId = String.fromCharCode(
                tagDataBytes[offset],
                tagDataBytes[offset + 1],
                tagDataBytes[offset + 2],
                tagDataBytes[offset + 3]
              );
              
              let frameSize = 0;
              if (version === 4) {
                frameSize = ((tagDataBytes[offset + 4] & 0x7f) << 21) |
                            ((tagDataBytes[offset + 5] & 0x7f) << 14) |
                            ((tagDataBytes[offset + 6] & 0x7f) << 7) |
                            (tagDataBytes[offset + 7] & 0x7f);
              } else {
                frameSize = (tagDataBytes[offset + 4] << 24) |
                            (tagDataBytes[offset + 5] << 16) |
                            (tagDataBytes[offset + 6] << 8) |
                            tagDataBytes[offset + 7];
              }
              
              const dataOffset = offset + 10;
              if (dataOffset + frameSize > tagDataBytes.length) break;
              
              if (frameId === 'TIT2') title = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              else if (frameId === 'TPE1') artist = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              else if (frameId === 'TALB') album = decodeTextFrame(tagDataBytes, dataOffset, frameSize);
              
              if (title && artist) break;
              offset += 10 + frameSize;
            }
          }
          
          if (title || artist) {
            return { title, artist, album };
          }
        }
      }
    }
    
    const info = await FileSystem.getInfoAsync(readableUri);
    if (info.exists && info.size && info.size > 128) {
      const v1Base64 = await FileSystem.readAsStringAsync(readableUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: info.size - 128,
        length: 128
      });
      if (v1Base64) {
        const v1Bytes = base64ToUint8Array(v1Base64);
        if (v1Bytes.length >= 128) {
          const v1 = parseID3v1(v1Bytes);
          if (v1.title || v1.artist) {
            return v1;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[LocalMusicService] Failed to parse ID3 tags for:', uri, e);
  }
  return {};
}


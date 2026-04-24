import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
// v3 - Persistent cache + background scan + thumbnail support

const CACHE_KEY = 'local_music_cache_v4';
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

    // 3. Fallback: Query MediaStore
    try {
      let allTracks: LocalTrack[] = [];
      let currentCursor = afterCursor;
      let hasNextPage = true;

      // Ensure we have enough tracks with valid duration
      while (allTracks.length < pageSize && hasNextPage) {
        const mediaPage = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 500, // Faster indexing with larger pages
          after: currentCursor,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });

        const mapped: LocalTrack[] = mediaPage.assets
        .filter(asset => asset.duration > 10)
        .map(asset => ({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          title: cleanTitle(asset.filename),
          artist: 'Local File',
          duration_ms: (asset.duration || 0) * 1000,
          albumId: asset.albumId,
          thumbnail: `content://media/external/audio/media/${asset.id}/albumart`,
        }));

        allTracks = [...allTracks, ...mapped];
        currentCursor = mediaPage.endCursor;
        hasNextPage = mediaPage.hasNextPage;
      }

      // Deduplicate by ID
      const uniqueTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());

      return {
        tracks: uniqueTracks,
        endCursor: currentCursor || '',
        hasNextPage: hasNextPage,
      };
    } catch (e) {
      console.warn('[LocalMusicService] MediaStore scan failed:', e);
      return { tracks: [], endCursor: '', hasNextPage: false };
    }
  }

  /**
   * Background scan - discovers all music and persists to disk.
   */
  private static async backgroundScan(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      let allTracks: LocalTrack[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: [MediaLibrary.MediaType.audio],
          first: 500,
          after: cursor,
        });

        if (!result || !result.assets || result.assets.length === 0) break;

        const mapped: LocalTrack[] = result.assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename,
          title: cleanTitle(asset.filename),
          artist: 'Local File',
          duration_ms: (asset.duration || 0) * 1000,
          albumId: asset.albumId,
          thumbnail: `content://media/external/audio/media/${asset.id}/albumart`,
        }));

        allTracks = [...allTracks, ...mapped];
        cursor = result.endCursor;
        hasMore = result.hasNextPage;
        
        if (allTracks.length % 400 === 0) console.log(`[LocalMusicService] Scanned ${allTracks.length} songs...`);
        if (allTracks.length >= MAX_CACHE_SIZE) {
          console.log(`[LocalMusicService] Reached max cache size (${MAX_CACHE_SIZE}), stopping scan.`);
          break;
        }
      }

      // Deduplicate by ID
      allTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());

      // Fallback if MediaLibrary found nothing
      if (allTracks.length === 0) {
        const fallback = await this.fallbackScan();
        allTracks = fallback.tracks;
      }

      this.cachedTracks = allTracks;
      console.log(`[LocalMusicService] Full scan complete. Cached ${allTracks.length} songs.`);

      // Persist to disk
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(allTracks));
        console.log(`[LocalMusicService] Persisted ${allTracks.length} tracks to disk.`);
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
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: [MediaLibrary.MediaType.audio],
          first: 1,
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        const totalCount = result.totalCount || 0;
        const cachedCount = this.cachedTracks?.length || 0;

        if (totalCount !== cachedCount) {
          console.log(`[LocalMusicService] Silent update: found ${totalCount - cachedCount} new files. Re-scanning...`);
          this.cachedTracks = null;
          await this.backgroundScan();
        } else {
          console.log(`[LocalMusicService] Silent update: no new files.`);
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
  private static async fallbackScan(): Promise<{ tracks: LocalTrack[]; endCursor: string; hasNextPage: boolean }> {
    const commonDirs = [
      'file:///storage/emulated/0/Music',
      'file:///storage/emulated/0/Download',
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
              foundTracks.push({
                id: uri,
                uri: uri,
                filename: file,
                title: cleanTitle(file),
                artist: 'Local File (Scanned)',
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
   * Search local songs by filename.
   */
  static async searchDeviceSongs(query: string): Promise<LocalTrack[]> {
    const q = query.toLowerCase();

    // 1. If already in memory, filter immediately (instant)
    if (this.cachedTracks) {
       return this.cachedTracks.filter(
         (t) => t.title.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q)
       );
    }

    // 2. Not in memory, try to load from disk cache
    try {
      const diskCache = await AsyncStorage.getItem(CACHE_KEY);
      if (diskCache) {
        this.cachedTracks = JSON.parse(diskCache) as LocalTrack[];
        return this.cachedTracks.filter(
          (t) => t.title.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q)
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
      (t) => t.title.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q)
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

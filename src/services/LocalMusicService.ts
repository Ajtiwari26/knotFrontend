import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
// v2

export interface LocalTrack {
  id: string;
  uri: string;
  filename: string;
  title: string;
  artist: string;
  duration_ms: number;
  albumId?: string;
}

export class LocalMusicService {
  private static cachedTracks: LocalTrack[] | null = null;
  private static isScanning = false;
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
   */
  static async getDeviceSongs(
    pageSize: number = 100,
    afterCursor?: string
  ): Promise<{ tracks: LocalTrack[]; endCursor: string; hasNextPage: boolean }> {
    // If we have cached tracks, handle pagination from cache
    if (this.cachedTracks) {
      const startIndex = afterCursor ? (afterCursor.startsWith('cache-') ? parseInt(afterCursor.split('-')[1]) : 0) : 0;
      const endIndex = startIndex + pageSize;
      const paginatedTracks = this.cachedTracks.slice(startIndex, endIndex);
      const nextIndex = endIndex < this.cachedTracks.length ? endIndex : -1;

      console.log(`[LocalMusicService] Returning ${paginatedTracks.length} tracks from cache offset ${startIndex}. Total: ${this.cachedTracks.length}`);
      return {
        tracks: paginatedTracks,
        endCursor: nextIndex !== -1 ? `cache-${nextIndex}` : '',
        hasNextPage: nextIndex !== -1,
      };
    }

    // If already scanning, wait or return empty (prevents parallel scans)
    if (this.isScanning) {
       return { tracks: [], endCursor: '', hasNextPage: false };
    }

    console.log('[LocalMusicService] No cache found. Starting full background scan...');
    this.isScanning = true;
    
    try {
      let allTracks: LocalTrack[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      // Scan EVERYTHING in one go and cache it
      while (hasMore) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: [MediaLibrary.MediaType.audio],
          first: 200,
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
        }));

        allTracks = [...allTracks, ...mapped];
        cursor = result.endCursor;
        hasMore = result.hasNextPage;
        
        // Progress log every 400 songs
        if (allTracks.length % 400 === 0) console.log(`[LocalMusicService] Scanned ${allTracks.length} songs...`);
      }

      // Fallback if MediaLibrary found nothing
      if (allTracks.length === 0) {
        const fallback = await this.fallbackScan();
        allTracks = fallback.tracks;
      }

      this.cachedTracks = allTracks;
      this.isScanning = false;
      console.log(`[LocalMusicService] Full scan complete. Cached ${allTracks.length} songs.`);

      // Return the first page
      return this.getDeviceSongs(pageSize, afterCursor);
    } catch (error) {
      this.isScanning = false;
      console.error('[LocalMusicService] Error scanning assets:', error);
      return { tracks: [], endCursor: '', hasNextPage: false };
    }
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
      'file:///storage/emulated/0/Audior', // Added specifically for your case
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
                id: uri, // Use URI as ID for fallback
                uri: uri,
                filename: file,
                title: cleanTitle(file),
                artist: 'Local File (Scanned)',
                duration_ms: 0, // Duration is hard to get via FileSystem without a player
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
    if (this.cachedTracks) {
       const q = query.toLowerCase();
       return this.cachedTracks.filter(
         (t) => t.title.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q)
       );
    }

    let allTracks: LocalTrack[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const { tracks, endCursor, hasNextPage } = await this.getDeviceSongs(200, cursor);
      allTracks = [...allTracks, ...tracks];
      cursor = endCursor;
      hasMore = hasNextPage;
      if (allTracks.length >= 2000) break;
    }

    this.cachedTracks = allTracks;

    const q = query.toLowerCase();
    return allTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q)
    );
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

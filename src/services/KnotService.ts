import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveKnot, Track, Knot } from '../store/playerStore';
import { getBaseUrl } from '../config/api';

const KNOT_STORAGE_PREFIX = 'knot_data_';

export class KnotService {
  /**
   * Save a knot for a specific song.
   * key can be youtube_id or local_uri.
   */
  static async saveKnot(songKey: string, knot: any): Promise<void> {
    try {
      const storageKey = `${KNOT_STORAGE_PREFIX}${songKey}`;
      const dataToSave = {
        ...knot,
        createdAt: Date.now(), // Track when this knot was last updated/created
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log(`[KnotService] Saved knot for ${songKey}`);
    } catch (error) {
      console.error('[KnotService] Error saving knot:', error);
    }
  }

  /**
   * Retrieve a saved knot for a specific song.
   */
  static async getSavedKnot(songKey: string): Promise<ActiveKnot | null> {
    try {
      const storageKey = `${KNOT_STORAGE_PREFIX}${songKey}`;
      const data = await AsyncStorage.getItem(storageKey);
      if (data) {
        return JSON.parse(data) as ActiveKnot;
      }
      return null;
    } catch (error) {
      console.error('[KnotService] Error getting saved knot:', error);
      return null;
    }
  }

  /**
   * Delete a saved knot.
   */
  static async deleteKnot(songKey: string): Promise<void> {
    try {
      const storageKey = `${KNOT_STORAGE_PREFIX}${songKey}`;
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[KnotService] Error deleting knot:', error);
    }
  }

  /**
   * Get all keys that have knot data saved.
   * Returns the raw song keys (without the storage prefix).
   */
  static async getAllKnottedKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(k => k.startsWith(KNOT_STORAGE_PREFIX))
        .map(k => k.replace(KNOT_STORAGE_PREFIX, ''));
    } catch (error) {
      console.error('[KnotService] Error getting all knotted keys:', error);
      return [];
    }
  }

  /**
   * Get all knotted details, including metadata like createdAt and junctions count.
   */
  static async getAllKnottedDetails(): Promise<{ key: string; knot: ActiveKnot; createdAt: number }[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const knotKeys = allKeys.filter(k => k.startsWith(KNOT_STORAGE_PREFIX));
      if (knotKeys.length === 0) return [];

      const pairs = await AsyncStorage.multiGet(knotKeys);
      const results: { key: string; knot: ActiveKnot; createdAt: number }[] = [];

      for (const [sKey, value] of pairs) {
        if (value) {
          const parsed = JSON.parse(value);
          results.push({
            key: sKey.replace(KNOT_STORAGE_PREFIX, ''),
            knot: parsed as ActiveKnot,
            createdAt: parsed.createdAt || 0,
          });
        }
      }

      // Sort by newest first
      return results.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('[KnotService] Error getting all knotted details:', error);
      return [];
    }
  }

  /**
   * Sync a local knot to the backend for cross-install persistence.
   */
  static async syncToBackend(track: Track, knot: ActiveKnot): Promise<void> {
    try {
      if (track.source !== 'local') return;
      const baseUrl = getBaseUrl();
      const localId = track.filename || track.local_uri || '';
      if (!localId) return;

      await fetch(`${baseUrl}/api/songs/local/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          local_id: localId,
          title: track.title,
          artist: track.artist,
          duration_ms: track.duration_ms,
          nodes: knot.junctions,
        }),
      });
      console.log(`[KnotService] Synced knot to backend for ${localId}`);
    } catch (error) {
      // Silent fail - backend sync is best-effort
      console.warn('[KnotService] Backend sync failed (non-critical):', error);
    }
  }

  /**
   * Attempt to fetch knot from backend if local is missing.
   */
  static async fetchFromBackend(filename: string): Promise<ActiveKnot | null> {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/songs/local/${encodeURIComponent(filename)}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data && data.nodes && data.nodes.length > 0) {
        return {
          _id: filename,
          name: 'Recovered Knot',
          junctions: data.nodes,
          knotted_duration_ms: 0,
          original_duration_ms: data.duration_ms || 0,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch all knots synced to backend for local tracks.
   */
  static async getSyncedLocalKnots(): Promise<any[]> {
     try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/songs/local/all-knotted`);
        if (!response.ok) return [];
        return await response.json();
     } catch (error) {
        return [];
     }
  }
  /**
   * Load knots for a track and update the store.
   * This is designed to be called from both foreground (UI) and background (PlaybackService).
   */
  static cleanString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/\s*[\[\(][^\]\)]*[\]\)]\s*/g, ' ')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  static isTitleMatch(t1: string, t2: string): boolean {
    const clean1 = this.cleanString(t1);
    const clean2 = this.cleanString(t2);
    if (!clean1 || !clean2) return false;
    if (clean1 === clean2) return true;
    if (clean1.length >= 5 && clean2.length >= 5) {
      if (clean1.includes(clean2) || clean2.includes(clean1)) {
        return true;
      }
    }
    return false;
  }

  static isArtistMatch(a1: string, a2: string): boolean {
    const clean1 = this.cleanString(a1);
    const clean2 = this.cleanString(a2);
    if (!clean1 || !clean2) return true;
    const genericArtists = ['unknown', 'unknownartist', 'pagalworld', 'pagalworldcom', 'pagalfree', 'pagalsong', 'jiosaavn'];
    if (genericArtists.includes(clean1) || genericArtists.includes(clean2)) {
      return true;
    }
    return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
  }

  static async loadKnotsForTrack(track: Track): Promise<any[]> {
    try {
      const { usePlayerStore } = require('../store/playerStore');
      const store = usePlayerStore.getState();
      
      let songKey = '';
      if (track.source === 'local') songKey = track.local_uri || '';
      else if (track.source === 'youtube') songKey = track.youtube_id || '';
      else if (track.source === 'pagalworld') songKey = track.pagalworld_url || '';
      else if (track.source === 'pagalfree') songKey = track.pagalfree_url || '';
      else if (track.source === 'jiosaavn') songKey = track.jiosaavn_token || '';

      if (!songKey) {
        store.setKnots([]);
        store.setActiveKnot(null);
        return [];
      }

      let savedKnot = await this.getSavedKnot(songKey);

      // Fallback 1: if local and no knot found by URI, try finding by filename
      if (!savedKnot && track.source === 'local' && track.filename) {
        const allKeys = await this.getAllKnottedKeys();
        for (const key of allKeys) {
          const keyFilename = key.split('/').pop()?.toLowerCase();
          if (keyFilename === track.filename.toLowerCase()) {
            savedKnot = await this.getSavedKnot(key);
            if (savedKnot) break;
          }
        }
      }

      // Fallback 2: match by title & artist
      if (!savedKnot) {
        const details = await this.getAllKnottedDetails();
        for (const item of details) {
          let itemTitle = item.knot.title || '';
          let itemArtist = item.knot.artist || '';
          if (!itemTitle) {
            const lastSegment = item.key.split('/').pop() || '';
            itemTitle = lastSegment.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          }
          
          if (this.isTitleMatch(track.title, itemTitle) && this.isArtistMatch(track.artist, itemArtist)) {
            savedKnot = item.knot;
            // Associate this knot with the current track's songKey to make subsequent loads instant
            await this.saveKnot(songKey, {
              ...savedKnot,
              title: track.title,
              artist: track.artist,
            });
            break;
          }
        }
      }

      // Fallback 3: try fetching from backend
      if (!savedKnot && track.source === 'local' && track.filename) {
        savedKnot = await this.fetchFromBackend(track.filename);
        if (savedKnot) {
          await this.saveKnot(songKey, savedKnot);
        }
      }

      if (savedKnot) {
        console.log(`[KnotService] Loaded ${savedKnot.junctions.length} junctions for ${track.title}`);
        store.setActiveKnot(savedKnot);
        const processedKnots = savedKnot.junctions.map(j => ({
          startTime: j.start_ms / 1000,
          endTime: j.end_ms / 1000,
          active: true
        }));
        store.setKnots(processedKnots);
        return processedKnots;
      } else {
        store.setActiveKnot(null);
        store.setKnots([]);
        return [];
      }
    } catch (error) {
      console.error('[KnotService] Error loading knots for track:', error);
      return [];
    }
  }

  /**
   * Pure version of knot loading that doesn't touch the store.
   * Useful for background service where the store might be in a different JS engine.
   */
  static async getKnotsForId(id: string): Promise<any[]> {
    try {
      if (!id || id === 'knot-stream' || id === 'pagalworld-stream' || id === 'pagalfree-stream' || id === 'jiosaavn-stream') return [];

      let savedKnot = await this.getSavedKnot(id);

      // Fallback 1: If it looks like a file path, try filename matching
      if (!savedKnot && (id.startsWith('file://') || id.startsWith('content://') || id.includes('/'))) {
        const filename = id.split('/').pop();
        if (filename) {
          const allKeys = await this.getAllKnottedKeys();
          for (const key of allKeys) {
            const keyFilename = key.split('/').pop()?.toLowerCase();
            if (keyFilename === filename.toLowerCase()) {
              savedKnot = await this.getSavedKnot(key);
              if (savedKnot) break;
            }
          }
        }
      }

      // Fallback 2: Title & artist match if current track title is known
      if (!savedKnot && (id.startsWith('file://') || id.startsWith('content://') || id.includes('/'))) {
        let trackTitle = '';
        let trackArtist = '';
        try {
          const { usePlayerStore } = require('../store/playerStore');
          const currentTrack = usePlayerStore.getState().currentTrack;
          if (currentTrack) {
            const trackId = currentTrack.local_uri || currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token;
            if (trackId === id) {
              trackTitle = currentTrack.title;
              trackArtist = currentTrack.artist;
            }
          }
        } catch (e) {
          // Ignored
        }

        if (trackTitle) {
          const details = await this.getAllKnottedDetails();
          for (const item of details) {
            let itemTitle = item.knot.title || '';
            let itemArtist = item.knot.artist || '';
            if (!itemTitle) {
              const lastSegment = item.key.split('/').pop() || '';
              itemTitle = lastSegment.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            }
            
            if (this.isTitleMatch(trackTitle, itemTitle) && this.isArtistMatch(trackArtist, itemArtist)) {
              savedKnot = item.knot;
              // Cache it for this ID to make subsequent loads instant
              await this.saveKnot(id, {
                ...savedKnot,
                title: trackTitle,
                artist: trackArtist,
              });
              break;
            }
          }
        }
      }

      if (savedKnot) {
        return savedKnot.junctions.map(j => ({
          startTime: j.start_ms / 1000,
          endTime: j.end_ms / 1000,
          active: true
        }));
      }
      return [];
    } catch (e) {
      console.error('[KnotService] Error in getKnotsForId:', e);
      return [];
    }
  }

  /**
   * Get the current player store state directly from storage.
   * Crucial for background service where the Zustand store might be stale or reset.
   */
  static async getSyncedStore(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem('player-storage');
      if (!data) return null;

      const parsed = JSON.parse(data);
      const state = parsed.state;

      // Add functional helpers for background use
      return {
        ...state,
        nextTrack: () => {
          if (!state.queue || state.queue.length === 0) return;
          let nextIndex = state.currentIndex + 1;
          if (state.shuffle) {
            nextIndex = Math.floor(Math.random() * state.queue.length);
          } else if (nextIndex >= state.queue.length) {
            nextIndex = state.repeatMode === 'list' ? 0 : state.currentIndex;
          }
          state.currentIndex = nextIndex;
          state.currentTrack = state.queue[nextIndex];
          // We don't save back here because we mostly use this to get the next track to play
          // The background service should handle the actual play command
        },
        prevTrack: () => {
          if (!state.queue || state.queue.length === 0) return;
          let prevIndex = state.currentIndex - 1;
          if (prevIndex < 0) prevIndex = 0;
          state.currentIndex = prevIndex;
          state.currentTrack = state.queue[prevIndex];
        }
      };
    } catch (e) {
      console.error('[KnotService] Error getting synced store:', e);
      return null;
    }
  }

  /**
   * Resolve knots for a track, fetching from storage if needed.
   */
  static async getKnotsForTrack(track: Track): Promise<any[]> {
    let id = '';
    if (track.source === 'local') id = track.local_uri || '';
    else if (track.source === 'youtube') id = track.youtube_id || '';
    else if (track.source === 'pagalworld') id = track.pagalworld_url || '';
    else if (track.source === 'pagalfree') id = track.pagalfree_url || '';
    else if (track.source === 'jiosaavn') id = track.jiosaavn_token || '';
    
    return this.getKnotsForId(id);
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveKnot, Track } from '../store/playerStore';
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
}

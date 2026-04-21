import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveKnot } from '../store/playerStore';

const KNOT_STORAGE_PREFIX = 'knot_data_';

export class KnotService {
  /**
   * Save a knot for a specific song.
   * key can be youtube_id or local_uri.
   */
  static async saveKnot(songKey: string, knot: ActiveKnot): Promise<void> {
    try {
      const storageKey = `${KNOT_STORAGE_PREFIX}${songKey}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(knot));
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
}

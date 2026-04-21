import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from './playerStore';

interface LibraryState {
  likedSongs: Track[];
  addLikedSong: (track: Track) => void;
  removeLikedSong: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      addLikedSong: (track) => set((state) => {
        const id = track.source === 'youtube' ? track.youtube_id : track.local_uri;
        if (state.likedSongs.find(t => (t.source === 'youtube' ? t.youtube_id : t.local_uri) === id)) {
          return state;
        }
        return { likedSongs: [track, ...state.likedSongs] };
      }),
      removeLikedSong: (trackId) => set((state) => ({
        likedSongs: state.likedSongs.filter(t => (t.source === 'youtube' ? t.youtube_id : t.local_uri) !== trackId)
      })),
      isLiked: (trackId) => {
        return get().likedSongs.some(t => (t.source === 'youtube' ? t.youtube_id : t.local_uri) === trackId);
      }
    }),
    {
      name: 'knot-library-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

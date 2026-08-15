import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Junction {
  start_ms: number;
  end_ms: number;
  label?: string;
  active?: boolean;
}

export interface Track {
  youtube_id?: string;       // present for YouTube songs
  local_uri?: string;        // file:// URI for device songs
  uri?: string;              // general/fallback URI
  filename?: string;         // stable filename for knot matching
  pagalworld_url?: string;   // Pagalworld detail page URL
  pagalworld_metadata?: { year: string; month: string; file: string };
  pagalfree_url?: string;     // PagalFree detail page URL
  pagalfree_direct_url?: string; // Direct download link from metadata
  jiosaavn_token?: string;    // JioSaavn token/id
  jiosaavn_direct_url?: string; // Decrypted direct URL
  source: 'youtube' | 'local' | 'pagalworld' | 'pagalfree' | 'jiosaavn';
  title: string;
  artist: string;
  thumbnail: string;
  duration_ms: number;
  streamUrl?: string;
}

/** Extract a clean 11-character YouTube video ID from a raw ID or any YouTube URL format. */
export function extractYoutubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) return match[1];
  return null;
}

/** Stable identity key for a track across sources. */
export function trackKey(track: Track | null | undefined): string {
  if (!track) return '';
  const ytId = extractYoutubeId(track.youtube_id) || track.youtube_id;
  return (
    ytId ||
    track.pagalworld_url ||
    track.pagalfree_url ||
    track.jiosaavn_token ||
    track.local_uri ||
    track.uri ||
    ''
  );
}

export interface KnotVersion {
  id: string;
  name: string;
  junctions: Junction[];
}

export interface ActiveKnot {
  _id: string;
  name: string;
  junctions: Junction[];
  knotted_duration_ms: number;
  original_duration_ms: number;
  title?: string;
  artist?: string;
  thumbnail?: string;
  source?: 'youtube' | 'local' | 'pagalworld' | 'pagalfree' | 'jiosaavn';
  activeVersionId?: string;
  versions?: KnotVersion[];
  createdAt?: number;
}

export interface Knot {
  startTime: number;
  endTime: number;
  active: boolean;
  subKnots?: Knot[];
}

interface PlayerState {
  currentTrack: Track | null;
  activeKnot: ActiveKnot | null;
  knots: Knot[];
  isPlaying: boolean;
  queue: Track[];
  currentIndex: number;
  repeatMode: 'off' | 'track' | 'list';
  shuffle: boolean;
  knottingStatus: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  knottingProgress: number;
  knottingPhase: string;
  pendingKnots: Knot[] | null;
  
  downloadProgress: { [songKey: string]: number };
  lyricOffsets: Record<string, number>;
  setLyricOffset: (trackKey: string, offsetMs: number) => void;
  setDownloadProgress: (songKey: string, progress: number) => void;
  cyclePlaybackMode: () => void;
  setCurrentTrack: (track: Track | null) => void;
  setActiveKnot: (knot: ActiveKnot | null) => void;
  setKnots: (knots: Knot[] | ((prev: Knot[]) => Knot[])) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[], startIndex?: number) => void;
  setRepeatMode: (mode: 'off' | 'track' | 'list') => void;
  setShuffle: (shuffle: boolean) => void;
  setKnottingStatus: (status: 'idle' | 'uploading' | 'processing' | 'done' | 'error') => void;
  setKnottingProgress: (progress: number) => void;
  setKnottingPhase: (phase: string) => void;
  setPendingKnots: (knots: Knot[] | null) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      activeKnot: null,
      knots: [],
      isPlaying: false,
      queue: [],
      currentIndex: 0,
      repeatMode: 'off',
      shuffle: false,
      knottingStatus: 'idle',
      knottingProgress: 0,
      knottingPhase: '',
      pendingKnots: null,
      downloadProgress: {},
      lyricOffsets: {},
      
      setLyricOffset: (trackKey, offsetMs) => set((state) => ({
        lyricOffsets: {
          ...state.lyricOffsets,
          [trackKey]: offsetMs
        }
      })),
      
      setCurrentTrack: (track) => set((state) => {
        // Only clear knots/activeKnot if the track ID/URI is actually changing, to avoid clearing during enrichment!
        const isSameTrack = state.currentTrack && track && (
          (state.currentTrack.youtube_id && state.currentTrack.youtube_id === track.youtube_id) ||
          (state.currentTrack.local_uri && state.currentTrack.local_uri === track.local_uri) ||
          (state.currentTrack.pagalworld_url && state.currentTrack.pagalworld_url === track.pagalworld_url) ||
          (state.currentTrack.pagalfree_url && state.currentTrack.pagalfree_url === track.pagalfree_url) ||
          (state.currentTrack.jiosaavn_token && state.currentTrack.jiosaavn_token === track.jiosaavn_token)
        );
        if (isSameTrack) {
          return { currentTrack: track };
        }
        return { currentTrack: track, activeKnot: null, knots: [] };
      }),
      setActiveKnot: (knot) => set({ activeKnot: knot }),
      setKnots: (updater) => set((state) => ({
        knots: typeof updater === 'function' ? updater(state.knots) : updater
      })),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      
      setQueue: (queue, startIndex = 0) => {
        set({ queue, currentIndex: startIndex, currentTrack: queue[startIndex] || null });
      },
      
      setRepeatMode: (mode) => {
        set({ repeatMode: mode });
        try {
          const TrackPlayer = require('react-native-track-player').default;
          const { RepeatMode } = require('react-native-track-player');
          const nativeMode = mode === 'track' ? RepeatMode.Track : RepeatMode.Off;
          TrackPlayer.setRepeatMode(nativeMode).catch((err: any) => {
            console.warn('[PlayerStore] Failed to set native repeat mode:', err);
          });
        } catch (e) {
          console.warn('[PlayerStore] Failed to load TrackPlayer for repeat mode sync:', e);
        }
      },
      setShuffle: (shuffle) => set({ shuffle }),
      setKnottingStatus: (status) => set({ knottingStatus: status }),
      setKnottingProgress: (progress) => set({ knottingProgress: progress }),
      setKnottingPhase: (phase) => set({ knottingPhase: phase }),
      setPendingKnots: (knots) => set({ pendingKnots: knots }),
      setDownloadProgress: (songKey, progress) => set((state) => ({
        downloadProgress: {
          ...state.downloadProgress,
          [songKey]: progress
        }
      })),
      cyclePlaybackMode: () => {
        const { repeatMode, shuffle } = get();
        let nextRepeat: 'off' | 'track' | 'list' = 'off';
        let nextShuffle = false;
        if (shuffle) {
          nextRepeat = 'off';
          nextShuffle = false;
        } else if (repeatMode === 'track') {
          nextRepeat = 'list';
          nextShuffle = false;
        } else if (repeatMode === 'list') {
          nextRepeat = 'off';
          nextShuffle = true;
        } else {
          nextRepeat = 'track';
          nextShuffle = false;
        }
        set({ repeatMode: nextRepeat, shuffle: nextShuffle });
        try {
          const TrackPlayer = require('react-native-track-player').default;
          const { RepeatMode } = require('react-native-track-player');
          const nativeMode = nextRepeat === 'track' ? RepeatMode.Track : RepeatMode.Off;
          TrackPlayer.setRepeatMode(nativeMode).catch((err: any) => {
            console.warn('[PlayerStore] Failed to set native repeat mode:', err);
          });
        } catch (e) {
          console.warn('[PlayerStore] Failed to load TrackPlayer for repeat mode sync:', e);
        }
      },
      
      nextTrack: () => {
        const { queue, currentIndex, repeatMode, shuffle } = get();
        if (queue.length === 0) return;
        
        let nextIndex = currentIndex + 1;
        if (shuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else if (nextIndex >= queue.length) {
          if (repeatMode === 'list' || repeatMode === 'track') {
            nextIndex = 0;
          } else {
            set({ currentTrack: null, activeKnot: null, knots: [], isPlaying: false });
            return;
          }
        }
        
        set({ currentIndex: nextIndex, currentTrack: queue[nextIndex], activeKnot: null, knots: [] });
      },
      
      prevTrack: () => {
        const { queue, currentIndex, repeatMode } = get();
        if (queue.length === 0) return;
        
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
          if (repeatMode === 'list' || repeatMode === 'track') {
            prevIndex = queue.length - 1;
          } else {
            prevIndex = 0;
          }
        }
        
        set({ currentIndex: prevIndex, currentTrack: queue[prevIndex], activeKnot: null, knots: [] });
      },
      
      reset: () => set({ 
        currentTrack: null, activeKnot: null, isPlaying: false, 
        queue: [], currentIndex: 0, repeatMode: 'off', shuffle: false 
      }),
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        queue: state.queue, 
        currentIndex: state.currentIndex, 
        repeatMode: state.repeatMode, 
        shuffle: state.shuffle, 
        currentTrack: state.currentTrack,
        // NOTE: `knots` and `isPlaying` intentionally NOT persisted — knots are
        // loaded fresh via loadKnotsForTrack() each time a track plays. Persisting
        // them caused stale knots from a previous song to bleed into the next.
        lyricOffsets: state.lyricOffsets
      }),
    }
  )
);

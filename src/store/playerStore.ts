import { create } from 'zustand';

export interface Junction {
  start_ms: number;
  end_ms: number;
  label?: string;
}

export interface Track {
  youtube_id?: string;       // present for YouTube songs
  local_uri?: string;        // file:// URI for device songs
  filename?: string;         // stable filename for knot matching
  source: 'youtube' | 'local';
  title: string;
  artist: string;
  thumbnail: string;
  duration_ms: number;
  streamUrl?: string;
}

export interface ActiveKnot {
  _id: string;
  name: string;
  junctions: Junction[];
  knotted_duration_ms: number;
  original_duration_ms: number;
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
  
  setCurrentTrack: (track: Track | null) => void;
  setActiveKnot: (knot: ActiveKnot | null) => void;
  setKnots: (knots: Knot[] | ((prev: Knot[]) => Knot[])) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[], startIndex?: number) => void;
  setRepeatMode: (mode: 'off' | 'track' | 'list') => void;
  setShuffle: (shuffle: boolean) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  activeKnot: null,
  knots: [],
  isPlaying: false,
  queue: [],
  currentIndex: 0,
  repeatMode: 'off',
  shuffle: false,
  
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setActiveKnot: (knot) => set({ activeKnot: knot }),
  setKnots: (updater) => set((state) => ({
    knots: typeof updater === 'function' ? updater(state.knots) : updater
  })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  setQueue: (queue, startIndex = 0) => {
    set({ queue, currentIndex: startIndex, currentTrack: queue[startIndex] || null });
  },
  
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  setShuffle: (shuffle) => set({ shuffle }),
  
  nextTrack: () => {
    const { queue, currentIndex, repeatMode, shuffle } = get();
    if (queue.length === 0) return;
    
    if (repeatMode === 'track') {
      // Stay on same track
      return;
    }
    
    let nextIndex = currentIndex + 1;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      nextIndex = repeatMode === 'list' ? 0 : currentIndex; // Stop at end if not repeating list
    }
    
    set({ currentIndex: nextIndex, currentTrack: queue[nextIndex] });
  },
  
  prevTrack: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = 0;
    }
    
    set({ currentIndex: prevIndex, currentTrack: queue[prevIndex] });
  },
  
  reset: () => set({ 
    currentTrack: null, activeKnot: null, isPlaying: false, 
    queue: [], currentIndex: 0, repeatMode: 'off', shuffle: false 
  }),
}));

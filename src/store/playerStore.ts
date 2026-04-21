import { create } from 'zustand';

export interface Junction {
  start_ms: number;
  end_ms: number;
  label?: string;
}

export interface Track {
  youtube_id?: string;       // present for YouTube songs
  local_uri?: string;        // file:// URI for device songs
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

interface PlayerState {
  currentTrack: Track | null;
  activeKnot: ActiveKnot | null;
  isPlaying: boolean;
  
  setCurrentTrack: (track: Track | null) => void;
  setActiveKnot: (knot: ActiveKnot | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  activeKnot: null,
  isPlaying: false,
  
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setActiveKnot: (knot) => set({ activeKnot: knot }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  reset: () => set({ currentTrack: null, activeKnot: null, isPlaying: false }),
}));

import { create } from 'zustand';

interface ExtractorState {
  videoId: string | null;
  extracting: boolean;
  resolvePromise: ((data: { streamingData: any; playerJsUrl: string | null }) => void) | null;
  rejectPromise: ((error: any) => void) | null;
  requestExtraction: (videoId: string) => Promise<{ streamingData: any; playerJsUrl: string | null }>;
  completeExtraction: (streamingData: any, playerJsUrl: string | null) => void;
  failExtraction: (error: any) => void;
}

export const useExtractorStore = create<ExtractorState>((set, get) => ({
  videoId: null,
  extracting: false,
  resolvePromise: null,
  rejectPromise: null,
  
  requestExtraction: (videoId: string) => {
    return new Promise((resolve, reject) => {
      set({
        videoId,
        extracting: true,
        resolvePromise: resolve,
        rejectPromise: reject,
      });
    });
  },
  
  completeExtraction: (streamingData: any, playerJsUrl: string | null) => {
    const { resolvePromise } = get();
    if (resolvePromise) resolvePromise({ streamingData, playerJsUrl });
    set({ videoId: null, extracting: false, resolvePromise: null, rejectPromise: null });
  },
  
  failExtraction: (error: any) => {
    const { rejectPromise } = get();
    if (rejectPromise) rejectPromise(error);
    set({ videoId: null, extracting: false, resolvePromise: null, rejectPromise: null });
  }
}));

import React, { useEffect, useState } from 'react';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { KnotService } from '../services/KnotService';
import { AudioService } from '../services/AudioService';

export const GlobalPlayerController = () => {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const knots = usePlayerStore(state => state.knots);
  const setKnots = usePlayerStore(state => state.setKnots);
  const setActiveKnot = usePlayerStore(state => state.setActiveKnot);
  const { position } = useProgress(250);

  // Track previous position to avoid infinite loop when seeking
  const [lastSeekPos, setLastSeekPos] = useState<number>(0);

  // Auto-load saved knots when track changes
  useEffect(() => {
    const loadSaved = async () => {
      if (!currentTrack) {
        setKnots([]);
        setActiveKnot(null);
        return;
      }

      const songKey = currentTrack.source === 'local' ? currentTrack.local_uri : currentTrack.youtube_id;
      if (songKey) {
        let savedKnot = await KnotService.getSavedKnot(songKey);

        // Fallback: if local and no knot found by URI, try finding by filename in all knots
        if (!savedKnot && currentTrack.source === 'local' && currentTrack.filename) {
          const allKeys = await KnotService.getAllKnottedKeys();
          for (const key of allKeys) {
            const keyFilename = key.split('/').pop()?.toLowerCase();
            if (keyFilename === currentTrack.filename.toLowerCase()) {
              savedKnot = await KnotService.getSavedKnot(key);
              if (savedKnot) break;
            }
          }
        }

        // Final fallback: try fetching from backend
        if (!savedKnot && currentTrack.source === 'local' && currentTrack.filename) {
          savedKnot = await KnotService.fetchFromBackend(currentTrack.filename);
          if (savedKnot) {
            await KnotService.saveKnot(songKey, savedKnot);
          }
        }

        if (savedKnot) {
          setActiveKnot(savedKnot);
          setKnots(savedKnot.junctions.map(j => ({
            startTime: j.start_ms / 1000,
            endTime: j.end_ms / 1000,
            active: true
          })));
        } else {
          setActiveKnot(null);
          setKnots([]);
        }
      }
    };

    loadSaved();
  }, [currentTrack]);

  // Audio skip logic: when playback enters any ACTIVE knot, jump past it
  useEffect(() => {
    if (knots.length === 0) return;

    // Check if we recently performed a seek to avoid loop jitters
    if (Math.abs(position - lastSeekPos) < 0.5) return;

    for (const knot of knots) {
      // Logic: If we reach the knot startTime, smoothly jump to endTime
      // Using the 1.0s buffer added in the engine to mask the transition
      if (knot.active && position >= knot.startTime && position < knot.endTime - 0.2) {
        setLastSeekPos(knot.endTime);
        AudioService.seekToSmoothly(knot.endTime);
        break;
      }
    }
  }, [position, knots]);

  return null; // This component doesn't render anything
};

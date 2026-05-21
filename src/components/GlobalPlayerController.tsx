import React, { useEffect, useState } from 'react';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/playerStore';
import { KnotService } from '../services/KnotService';
import { AudioService } from '../services/AudioService';

export const GlobalPlayerController = () => {
  const router = useRouter();
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

      let songKey = '';
      if (currentTrack.source === 'local') songKey = currentTrack.local_uri || '';
      else if (currentTrack.source === 'youtube') songKey = currentTrack.youtube_id || '';
      else if (currentTrack.source === 'pagalworld') songKey = currentTrack.pagalworld_url || '';
      else if (currentTrack.source === 'pagalfree') songKey = currentTrack.pagalfree_url || '';
      else if (currentTrack.source === 'jiosaavn') songKey = currentTrack.jiosaavn_token || '';
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
      if (knot.active && position >= knot.startTime && position < knot.endTime - 0.2) {
        setLastSeekPos(knot.endTime);
        AudioService.seekToSmoothly(knot.endTime);
        break;
      }
    }
  }, [position, knots]);

  // Hydrate TrackPlayer with persisted track on startup if native queue is empty
  useEffect(() => {
    const hydratePlayerOnBoot = async () => {
      if (!currentTrack) return;
      try {
        await AudioService.setupPlayer();
        const queue = await TrackPlayer.getQueue();
        if (queue.length === 0) {
          console.log('[GlobalPlayerController] Boot-time hydration: checking persisted track state:', currentTrack.title);
          const isPlayingPersisted = usePlayerStore.getState().isPlaying;
          
          if (isPlayingPersisted) {
            console.log('[GlobalPlayerController] Track was playing when closed. Auto-playing and seeking...');
            await AsyncStorage.setItem('restore_saved_position_flag', 'true');
            await AudioService.playQueueTrack(currentTrack);
            
            setTimeout(() => {
              try {
                router.push('/player');
              } catch (navErr) {
                console.warn('[GlobalPlayerController] Navigation to player failed:', navErr);
              }
            }, 500);
          } else {
            console.log('[GlobalPlayerController] Track was paused when closed. Adding placeholder.');
            const trackId = currentTrack.source === 'local' ? currentTrack.local_uri : (currentTrack.youtube_id || currentTrack.jiosaavn_token || currentTrack.pagalworld_url || currentTrack.pagalfree_url || 'knot-track');
            await TrackPlayer.add({
              id: trackId,
              url: 'https://placeholder.invalid',
              title: currentTrack.title,
              artist: currentTrack.artist,
              artwork: currentTrack.thumbnail || undefined,
            });
            await TrackPlayer.pause();
          }
        }
      } catch (err) {
        console.warn('[GlobalPlayerController] Boot-time TrackPlayer hydration failed:', err);
      }
    };
    hydratePlayerOnBoot();
  }, [currentTrack]);

  return null; // This component doesn't render anything
};

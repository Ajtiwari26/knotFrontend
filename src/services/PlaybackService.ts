import TrackPlayer, { Event, State } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

module.exports = async function () {
  let isTransitioning = false;

  const handleTrackFinished = async (source: string) => {
    if (isTransitioning) return;
    isTransitioning = true;
    setTimeout(() => { isTransitioning = false; }, 1000); // 1s cooldown

    const { usePlayerStore } = require('../store/playerStore');
    const store = usePlayerStore.getState();
    const AudioService = require('./AudioService').AudioService;
    
    console.log(`[PlaybackService] Track finished detected via ${source}. RepeatMode:`, store.repeatMode);
    
    if (store.repeatMode === 'track') {
      if (store.currentTrack) {
        console.log('[PlaybackService] Repeating current track:', store.currentTrack.title);
        await AudioService.playQueueTrack(store.currentTrack);
      }
    } else {
      store.nextTrack();
      const nextTrack = usePlayerStore.getState().currentTrack;
      console.log('[PlaybackService] Advancing to next track:', nextTrack?.title);
      if (nextTrack) {
        await AudioService.playQueueTrack(nextTrack);
      }
    }
  };

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      const { usePlayerStore } = require('../store/playerStore');
      usePlayerStore.getState().setIsPlaying(true);
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack && activeTrack.url === 'https://placeholder.invalid') {
        const store = usePlayerStore.getState();
        if (store.currentTrack) {
          const AudioService = require('./AudioService').AudioService;
          await AudioService.playQueueTrack(store.currentTrack);
          return;
        }
      }
    } catch (e) {
      console.warn('[PlaybackService] RemotePlay placeholder check failed:', e);
    }
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    const { usePlayerStore } = require('../store/playerStore');
    usePlayerStore.getState().setIsPlaying(false);
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    const { usePlayerStore } = require('../store/playerStore');
    usePlayerStore.getState().setIsPlaying(false);
    TrackPlayer.stop();
  });
  
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const { usePlayerStore } = require('../store/playerStore');
    const store = usePlayerStore.getState();
    store.nextTrack();
    const nextTrack = usePlayerStore.getState().currentTrack;
    if (nextTrack) {
      const AudioService = require('./AudioService').AudioService;
      await AudioService.playQueueTrack(nextTrack);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const { usePlayerStore } = require('../store/playerStore');
    const store = usePlayerStore.getState();
    store.prevTrack();
    const prevTrack = usePlayerStore.getState().currentTrack;
    if (prevTrack) {
      const AudioService = require('./AudioService').AudioService;
      await AudioService.playQueueTrack(prevTrack);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));

  // Sync state dynamically & handle track completion
  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    try {
      const { usePlayerStore } = require('../store/playerStore');
      const isPlaying = event.state === State.Playing;
      usePlayerStore.getState().setIsPlaying(isPlaying);

      if (event.state === State.Ended) {
        await handleTrackFinished('PlaybackState.Ended');
      }
    } catch (e) {
      console.warn('[PlaybackService] PlaybackState listener failed:', e);
    }
  });

  // Handle auto-advance when a track finishes (legacy backup)
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    await handleTrackFinished('PlaybackQueueEnded');
  });

  // Background knot skipping — supplements the foreground GlobalPlayerController
  // This handles skipping when the app is minimized but the JS engine is still alive
  let lastTrackId: string | null = null;
  let activeKnots: any[] = [];
  let lastSkipTime = 0;

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (event) => {
    const { position } = event;

    // Save position and song key to AsyncStorage
    try {
      const { usePlayerStore } = require('../store/playerStore');
      const store = usePlayerStore.getState();
      if (store.currentTrack) {
        const songKey = store.currentTrack.youtube_id || store.currentTrack.pagalworld_url || store.currentTrack.pagalfree_url || store.currentTrack.jiosaavn_token || store.currentTrack.local_uri;
        if (songKey) {
          await AsyncStorage.setItem('last_played_position', position.toString());
          await AsyncStorage.setItem('last_played_song_key', songKey);
        }
      }
    } catch (e) {
      console.warn('[PlaybackService] Failed to save playback progress:', e);
    }

    // 1. Identify the active track
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack || !activeTrack.id) return;

    // 2. Sync knots if track changed
    if (activeTrack.id !== lastTrackId) {
      const { KnotService } = require('./KnotService');
      activeKnots = await KnotService.getKnotsForId(activeTrack.id);
      lastTrackId = activeTrack.id;
      
      if (activeKnots.length > 0) {
        console.log(`[PlaybackService] 💡 Background knots loaded for ${activeTrack.id}: ${activeKnots.length} knots`);
      }
    }

    if (activeKnots.length === 0) return;

    // 3. Skip knots — same logic as the original GlobalPlayerController
    // Avoid re-triggering within 0.5s of last skip
    if (Math.abs(position - lastSkipTime) < 0.5) return;

    for (const knot of activeKnots) {
      if (knot.active && position >= knot.startTime && position < knot.endTime - 0.2) {
        console.log(`[PlaybackService] 🪢 BG SKIP: ${position.toFixed(2)}s -> ${knot.endTime.toFixed(2)}s`);
        lastSkipTime = knot.endTime;
        await TrackPlayer.seekTo(knot.endTime);
        break;
      }
    }
  });
};

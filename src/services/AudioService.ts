import TrackPlayer, { AppKilledPlaybackBehavior, Capability, State, RepeatMode } from 'react-native-track-player';

export class AudioService {
  private static isSetup = false;

  static async setupPlayer() {
    if (this.isSetup) return;

    if (!Capability) {
      console.warn('[AudioService] Capability is undefined. Native module might not be ready.');
      return;
    }

    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        progressUpdateEventInterval: 0.5,
        capabilities: [
          Capability?.Play,
          Capability?.Pause,
          Capability?.SkipToNext,
          Capability?.SkipToPrevious,
          Capability?.SeekTo,
          Capability?.Stop,
        ].filter(Boolean) as Capability[],
        compactCapabilities: [
          Capability?.Play,
          Capability?.Pause,
          Capability?.SkipToNext,
          Capability?.SkipToPrevious,
        ].filter(Boolean) as Capability[],
        notificationCapabilities: [
          Capability?.Play,
          Capability?.Pause,
          Capability?.SkipToNext,
          Capability?.SkipToPrevious,
          Capability?.SeekTo,
          Capability?.Stop,
        ].filter(Boolean) as Capability[],
      });
      this.isSetup = true;
    } catch (error) {
      console.error('Error setting up track player', error);
    }
  }

  /**
   * Play a YouTube stream URL.
   */
  static async playStream(url: string, title: string, artist: string, thumbnail: string, id: string = 'knot-stream') {
    if (!this.isSetup) await this.setupPlayer();

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: id,
      url,
      title,
      artist,
      ...(thumbnail ? { artwork: thumbnail } : {}),
    });

    await TrackPlayer.play();
  }

  /**
   * Play a local device audio file.
   * Uses the file:// URI directly — TrackPlayer supports local URIs natively.
   */
  static async playLocal(uri: string, title: string, artist: string, thumbnail?: string, id: string = 'knot-local') {
    if (!this.isSetup) await this.setupPlayer();

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: id,
      url: uri,
      title,
      artist,
      ...(thumbnail ? { artwork: thumbnail } : {}),
    });

    await TrackPlayer.play();
  }

  static async togglePlayPause() {
    const state = await TrackPlayer.getPlaybackState() as any;
    if (state?.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (!activeTrack) {
          const store = require('@/src/store/playerStore').usePlayerStore.getState();
          if (store.currentTrack) {
            console.log('[AudioService] No active track found, playing store currentTrack:', store.currentTrack.title);
            await this.playQueueTrack(store.currentTrack);
            return;
          }
        } else if (activeTrack.url === 'https://placeholder.invalid') {
          const store = require('@/src/store/playerStore').usePlayerStore.getState();
          if (store.currentTrack) {
            console.log('[AudioService] Resuming playback of hydrated placeholder track:', store.currentTrack.title);
            await this.playQueueTrack(store.currentTrack);
            return;
          }
        }
      } catch (e) {
        console.warn('[AudioService] Failed to check/resolve placeholder track:', e);
      }
      await TrackPlayer.play();
    }
  }

  static async setFallbackArtwork() {
    try {
      const { Image } = require('react-native');
      const fallbackUri = Image.resolveAssetSource(require('@/assets/icon.png')).uri;
      await TrackPlayer.updateNowPlayingMetadata({ artwork: fallbackUri });
      console.log('[AudioService] Updated TrackPlayer with fallback artwork');
    } catch (e) {
      console.warn('[AudioService] Failed to set fallback artwork:', e);
    }
  }

  static async seekTo(position: number) {
    await TrackPlayer.seekTo(position);
  }

  static async seekToSmoothly(position: number) {
    // Perform the jump directly without volume dropping
    await TrackPlayer.seekTo(position);
  }

  static async playQueueTrack(track: any) {
    if (!this.isSetup) await this.setupPlayer();

    // Sync repeat mode with native player
    try {
      const store = require('@/src/store/playerStore').usePlayerStore.getState();
      const nativeMode = store.repeatMode === 'track' ? RepeatMode.Track : RepeatMode.Off;
      await TrackPlayer.setRepeatMode(nativeMode);
      console.log('[AudioService] Synced native repeat mode:', nativeMode);
    } catch (e) {
      console.warn('[AudioService] Failed to sync repeat mode on play:', e);
    }

    let seekToPosition: number | null = null;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const shouldRestoreFlag = await AsyncStorage.getItem('restore_saved_position_flag');
      const activeTrack = await TrackPlayer.getActiveTrack();
      const isPlaceholder = activeTrack && activeTrack.url === 'https://placeholder.invalid';
      
      if (shouldRestoreFlag === 'true' || isPlaceholder) {
        const trackKey = track.youtube_id || track.pagalworld_url || track.pagalfree_url || track.jiosaavn_token || track.local_uri;
        const savedSongKey = await AsyncStorage.getItem('last_played_song_key');
        
        if (trackKey && trackKey === savedSongKey) {
          const savedPosStr = await AsyncStorage.getItem('last_played_position');
          if (savedPosStr) {
            seekToPosition = parseFloat(savedPosStr);
            console.log('[AudioService] Found boot-time saved position to restore:', seekToPosition);
          }
        }
        await AsyncStorage.removeItem('restore_saved_position_flag');
      }
    } catch (e) {
      console.warn('[AudioService] Failed to check for saved position:', e);
    }

    // Load knots for this track (works in background too!)
    try {
      const { KnotService } = require('./KnotService');
      await KnotService.loadKnotsForTrack(track);
    } catch (e) {
      console.warn('[AudioService] Failed to load knots for track:', e);
    }

    if (track.source === 'local') {
      await this.playLocal(track.local_uri, track.title, track.artist, track.thumbnail, track.local_uri);
    } else if (track.source === 'pagalworld') {
      let streamUrl = track.streamUrl;
      
      if (!streamUrl) {
        try {
          const PagalworldService = require('./PagalworldService').default;
          console.log(`[AudioService] Fetching metadata for Pagalworld song: ${track.title}...`);
          
          let metadata = track.pagalworld_metadata;
          if (!metadata && track.pagalworld_url) {
            metadata = await PagalworldService.getMetadata(track.pagalworld_url);
          }

          if (metadata) {
            // Update track metadata
            if (metadata.title) track.title = metadata.title;
            if (metadata.artist) track.artist = metadata.artist;
            if (metadata.imageUrl) track.thumbnail = metadata.imageUrl;

            // Update the player store with enriched track
            const store = require('@/src/store/playerStore').usePlayerStore.getState();
            store.setCurrentTrack({ ...track });



            streamUrl = PagalworldService.getStreamUrl(metadata);
          } else {
            throw new Error('Could not resolve Pagalworld metadata');
          }
        } catch (e) {
          console.error('[AudioService] Pagalworld resolution failed:', e);
          throw e;
        }
      }
      
      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.pagalworld_url || 'pagalworld-stream');
    } else if (track.source === 'pagalfree') {
      let streamUrl = track.streamUrl;

      if (!streamUrl) {
        try {
          const PagalfreeService = require('./PagalfreeService').default;
          console.log(`[AudioService] Fetching metadata for Pagalfree song: ${track.title}...`);

          let directUrl = track.pagalfree_direct_url;
          if (!directUrl && track.pagalfree_url) {
            const metadata = await PagalfreeService.getMetadata(track.pagalfree_url);
            console.log('[AudioService] Pagalfree metadata received:', JSON.stringify(metadata, null, 2));
            
            if (metadata && metadata.downloadLinks.length > 0) {
              // Prefer 320kbps, then 128kbps, then whatever is first
              const bestLink = metadata.downloadLinks.find((l: any) => l.quality === '320kbps') || 
                               metadata.downloadLinks.find((l: any) => l.quality === '128kbps') || 
                               metadata.downloadLinks[0];
              directUrl = bestLink.url;
              
              // Update track metadata
              if (metadata.title) track.title = metadata.title;
              if (metadata.artist) track.artist = metadata.artist;
              if (metadata.imageUrl) {
                track.thumbnail = metadata.imageUrl;
                console.log('[AudioService] Updated thumbnail to:', metadata.imageUrl);
              }
              
              // Update the player store with enriched track
              const store = require('@/src/store/playerStore').usePlayerStore.getState();
              store.setCurrentTrack({ ...track });


            }
          }

          if (directUrl) {
            streamUrl = PagalfreeService.getStreamUrl(directUrl);
          } else {
            throw new Error('Could not resolve Pagalfree download link');
          }
        } catch (e) {
          console.error('[AudioService] Pagalfree resolution failed:', e);
          throw e;
        }
      }

      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.pagalfree_url || 'pagalfree-stream');
    } else if (track.source === 'jiosaavn') {
      let streamUrl = track.streamUrl;

      if (!streamUrl) {
        try {
          const JiosaavnService = require('./JiosaavnService').default;
          console.log(`[AudioService] Fetching metadata for JioSaavn song: ${track.title}...`);

          let directUrl = track.jiosaavn_direct_url;
          if (!directUrl && track.jiosaavn_token) {
            const metadata = await JiosaavnService.getMetadata(track.jiosaavn_token);
            console.log('[AudioService] JioSaavn metadata received:', JSON.stringify(metadata, null, 2));
            
            if (metadata && metadata.downloadLinks.length > 0) {
              // Prefer 320kbps, then 160kbps, then whatever is first
              const bestLink = metadata.downloadLinks.find((l: any) => l.quality === '320kbps') || 
                               metadata.downloadLinks.find((l: any) => l.quality === '160kbps') || 
                               metadata.downloadLinks[0];
              directUrl = bestLink.url;
              
              // Update track metadata
              if (metadata.title) track.title = metadata.title;
              if (metadata.artist) track.artist = metadata.artist;
              if (metadata.imageUrl) {
                track.thumbnail = metadata.imageUrl;
                console.log('[AudioService] Updated thumbnail to:', metadata.imageUrl);
              }
              if (metadata.duration_ms) {
                track.duration_ms = metadata.duration_ms;
              }
              
              // Update the player store with enriched track
              const store = require('@/src/store/playerStore').usePlayerStore.getState();
              store.setCurrentTrack({ ...track });


            }
          }

          if (directUrl) {
            streamUrl = JiosaavnService.getStreamUrl(directUrl);
          } else {
            throw new Error('Could not resolve JioSaavn download link');
          }
        } catch (e) {
          console.error('[AudioService] JioSaavn resolution failed:', e);
          throw e;
        }
      }

      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.jiosaavn_token || 'jiosaavn-stream');
    } else {
      let streamUrl = track.streamUrl;
      const { getBaseUrl } = require('@/src/config/api');
      const { extractYoutubeId } = require('@/src/store/playerStore');
      const baseUrl = getBaseUrl();
      const cleanYtId = extractYoutubeId(track.youtube_id) || track.youtube_id;

      if (!streamUrl) {
        const isLocal = baseUrl.includes('localhost') || baseUrl.includes('10.0.2.2');
        
        // 1. Try Client-Side Extraction (Residential IP)
        try {
          const { YoutubeExtractor } = require('./YoutubeExtractor');
          console.log(`[AudioService] Attempting client-side extraction for ${cleanYtId}...`);
          streamUrl = await YoutubeExtractor.extract(cleanYtId);
        } catch (e) {
          console.warn('[AudioService] Client-side extraction failed:', e);
        }

        // 2. Fallback to Backend Extraction (Proxy)
        if (!streamUrl) {
          if (isLocal) {
            console.log('[AudioService] Falling back to Mac backend extraction (local mode)...');
          } else {
            console.log('[AudioService] Falling back to backend proxy (production mode)...');
          }
          streamUrl = `${baseUrl}/api/songs/${encodeURIComponent(cleanYtId)}/stream`;
        }
      }

      const cleanThumb = track.thumbnail || (cleanYtId ? `https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg` : '');
      await this.playStream(streamUrl, track.title, track.artist, cleanThumb, cleanYtId);
    }

    if (seekToPosition !== null && seekToPosition > 0) {
      setTimeout(async () => {
        try {
          console.log('[AudioService] Seeking to restored position:', seekToPosition);
          await TrackPlayer.seekTo(seekToPosition);
        } catch (seekErr) {
          console.warn('[AudioService] Failed to seek to restored position:', seekErr);
        }
      }, 500);
    }
  }
}

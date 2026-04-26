import TrackPlayer, { AppKilledPlaybackBehavior, Capability, State } from 'react-native-track-player';

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
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
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
    const state = await TrackPlayer.getPlaybackState();
    if (state?.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
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

    if (track.source === 'local') {
      await this.playLocal(track.local_uri, track.title, track.artist, track.thumbnail, track.local_uri);
    } else {
      let streamUrl = track.streamUrl;
      const { getBaseUrl } = require('@/src/config/api');
      const baseUrl = getBaseUrl();

      if (!streamUrl) {
        // Step 1: Try client-side resolution (Piped API)
        try {
          console.log(`[AudioService] Client-side resolution for ${track.youtube_id}...`);
          const res = await fetch(`https://pipedapi.kavin.rocks/streams/${track.youtube_id}`);
          if (res.ok) {
            const data = await res.json();
            const audio = data.audioStreams?.find((s: any) => s.format === 'WEBM_OPUS' || s.bitrate > 100000);
            if (audio?.url) {
              console.log(`[AudioService] Client-side success via Piped!`);
              // IMPORTANT: We pass this to the backend so the backend can proxy it (knotting support)
              streamUrl = `${baseUrl}/api/songs/${track.youtube_id}/stream?stream_url=${encodeURIComponent(audio.url)}`;
            }
          }
        } catch (e) {
          console.warn('[AudioService] Client-side resolution failed:', e);
        }

        // Step 2: Fallback to standard backend stream
        if (!streamUrl) {
          console.log('[AudioService] Falling back to backend extraction...');
          streamUrl = `${baseUrl}/api/songs/${track.youtube_id}/stream`;
        }
      }
      
      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.youtube_id);
    }
  }
}

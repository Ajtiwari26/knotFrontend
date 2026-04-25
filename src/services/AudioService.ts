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
    // Subtler volume dip (60ms) - don't go to zero to avoid "song ended" feel
    for (let v = 0.8; v >= 0.15; v -= 0.15) {
      await TrackPlayer.setVolume(v);
      await new Promise(r => setTimeout(r, 15));
    }
    await TrackPlayer.setVolume(0.15);

    // Perform the jump
    await TrackPlayer.seekTo(position);
    
    // Tiny delay
    await new Promise(r => setTimeout(r, 60));

    // Volume ramp up (200ms)
    for (let v = 0.3; v <= 1.0; v += 0.2) {
      await TrackPlayer.setVolume(v);
      await new Promise(r => setTimeout(r, 40));
    }
    await TrackPlayer.setVolume(1.0);
  }

  static async playQueueTrack(track: any) {
    if (!this.isSetup) await this.setupPlayer();

    if (track.source === 'local') {
      await this.playLocal(track.local_uri, track.title, track.artist, track.thumbnail, track.local_uri);
    } else {
      let streamUrl = track.streamUrl;
      if (!streamUrl) {
        try {
          const { getBaseUrl } = require('@/src/config/api');
          const baseUrl = getBaseUrl();
          streamUrl = `${baseUrl}/api/songs/${track.youtube_id}/stream`;
        } catch (e) {
          console.error('[AudioService] Error constructing stream URL', e);
          return;
        }
      }
      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.youtube_id);
    }
  }
}

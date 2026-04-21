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
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability?.Play,
          Capability?.Pause,
          Capability?.SkipToNext,
          Capability?.SkipToPrevious,
          Capability?.SeekTo,
        ].filter(Boolean) as Capability[],
        compactCapabilities: [
          Capability?.Play,
          Capability?.Pause,
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
  static async playStream(url: string, title: string, artist: string, thumbnail: string) {
    if (!this.isSetup) await this.setupPlayer();

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: 'knot-stream',
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
  static async playLocal(uri: string, title: string, artist: string, thumbnail?: string) {
    if (!this.isSetup) await this.setupPlayer();

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: 'knot-local',
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

  static async seekTo(position: number) {
    await TrackPlayer.seekTo(position);
  }

  static async playQueueTrack(track: any) {
    if (!this.isSetup) await this.setupPlayer();

    if (track.source === 'local') {
      await this.playLocal(track.local_uri, track.title, track.artist, track.thumbnail);
    } else {
      let streamUrl = track.streamUrl;
      if (!streamUrl) {
        // Fetch it!
        try {
          const { resolveBaseUrl } = require('@/src/config/api');
          const baseUrl = await resolveBaseUrl();
          const res = await fetch(`${baseUrl}/api/songs/${track.youtube_id}/stream-url`);
          const data = await res.json();
          if (res.ok && data.streamUrl) {
            streamUrl = data.streamUrl;
          } else {
            throw new Error(data.error || 'Failed to fetch stream URL');
          }
        } catch (e) {
          console.error('[AudioService] Error fetching stream URL', e);
          return; // Can't play
        }
      }
      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail);
    }
  }
}

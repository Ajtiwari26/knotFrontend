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
            if (metadata.title) track.title = metadata.title;
            if (metadata.artist) track.artist = metadata.artist;

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
            if (metadata && metadata.downloadLinks.length > 0) {
              // Prefer 320kbps, then 128kbps, then whatever is first
              const bestLink = metadata.downloadLinks.find((l: any) => l.quality === '320kbps') || 
                               metadata.downloadLinks.find((l: any) => l.quality === '128kbps') || 
                               metadata.downloadLinks[0];
              directUrl = bestLink.url;
              if (metadata.title) track.title = metadata.title;
              if (metadata.artist) track.artist = metadata.artist;
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
    } else {
      let streamUrl = track.streamUrl;
      const { getBaseUrl } = require('@/src/config/api');
      const baseUrl = getBaseUrl();

      if (!streamUrl) {
        const isLocal = baseUrl.includes('localhost') || baseUrl.includes('10.0.2.2');
        
        // 1. Try Client-Side Extraction (Residential IP)
        try {
          const { YoutubeExtractor } = require('./YoutubeExtractor');
          console.log(`[AudioService] Attempting client-side extraction for ${track.youtube_id}...`);
          streamUrl = await YoutubeExtractor.extract(track.youtube_id);
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
          streamUrl = `${baseUrl}/api/songs/${track.youtube_id}/stream`;
        }
      }
      
      await this.playStream(streamUrl, track.title, track.artist, track.thumbnail, track.youtube_id);
    }
  }
}

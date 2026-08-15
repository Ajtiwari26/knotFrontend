import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';
import { KnotService } from '@/src/services/KnotService';
import { LocalMusicService } from '@/src/services/LocalMusicService';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface KnottedSong {
  id: string;
  key?: string;
  title: string;
  artist: string;
  thumbnail: string;
  knotName: string;
  duration: string;
  uri?: string;
  source: 'local' | 'youtube' | 'pagalworld' | 'pagalfree' | 'jiosaavn';
  filename?: string;
  duration_ms: number;
  createdAt: number;
  knotCount: number;
}

export default function KnottedListScreen() {
  const router = useRouter();
  const [knotted, setKnotted] = useState<KnottedSong[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadKnottedSongs();
    }, [])
  );

  const loadKnottedSongs = async () => {
    try {
      setLoading(true);
      const { tracks: allLocal } = await LocalMusicService.getDeviceSongs(5000);
      const localKeys = await KnotService.getAllKnottedKeys();
      
      let remoteKnots: any[] = [];
      try {
        remoteKnots = await KnotService.getSyncedLocalKnots();
      } catch (e) {}

      const matchedFilenames = new Set<string>();
      const localMatched: KnottedSong[] = [];

      // Process local keys (file:// or content:// URIs)
      const localFileUris = localKeys.filter(k => k.startsWith('file://') || k.startsWith('content://'));
      for (const uri of localFileUris) {
        let match = allLocal.find(t => t.uri === uri);
        if (!match) {
          const uriFilename = uri.split('/').pop()?.toLowerCase();
          if (uriFilename) {
            match = allLocal.find(t => t.filename.toLowerCase() === uriFilename);
          }
        }

        if (match) {
          const knotData = await KnotService.getSavedKnot(uri);
          matchedFilenames.add(match.filename.toLowerCase());
          localMatched.push({
            id: match.id,
            key: uri,
            title: match.title,
            artist: match.artist,
            thumbnail: match.thumbnail || '',
            knotName: `${knotData?.junctions.length || 0} Knot${(knotData?.junctions.length || 0) !== 1 ? 's' : ''}`,
            duration: formatDuration(match.duration_ms),
            uri: match.uri,
            source: 'local',
            filename: match.filename,
            duration_ms: match.duration_ms,
            createdAt: (knotData as any)?.createdAt || 0,
            knotCount: knotData?.junctions.length || 0,
          });
        }
      }

      // Process online keys (YouTube IDs, pagalworld URLs, jiosaavn tokens, etc.)
      const onlineKeys = localKeys.filter(k => !k.startsWith('file://') && !k.startsWith('content://'));
      for (const key of onlineKeys) {
        try {
          const knotData = await KnotService.getSavedKnot(key);
          if (!knotData) continue;

          // Check if this online song was downloaded
          let isDownloadedMatch = false;
          const downloadedData = await AsyncStorage.getItem(`downloaded_track_${key}`);
          if (downloadedData) {
            const downloaded = JSON.parse(downloadedData);
            const downloadedFilename = (downloaded.filename || '').toLowerCase();
            if (downloadedFilename && !matchedFilenames.has(downloadedFilename)) {
              // Find the matching local device song
              const localMatch = allLocal.find(t => t.filename.toLowerCase() === downloadedFilename) 
                              || (downloaded.local_uri ? allLocal.find(t => t.uri === downloaded.local_uri) : null);
              if (localMatch) {
                isDownloadedMatch = true;
                matchedFilenames.add(localMatch.filename.toLowerCase());
                localMatched.push({
                  id: localMatch.id,
                  key: key,
                  title: localMatch.title,
                  artist: localMatch.artist,
                  thumbnail: localMatch.thumbnail || '',
                  knotName: `${knotData.junctions?.length || 0} Knot${(knotData.junctions?.length || 0) !== 1 ? 's' : ''}`,
                  duration: formatDuration(localMatch.duration_ms),
                  uri: localMatch.uri,
                  source: 'local',
                  filename: localMatch.filename,
                  duration_ms: localMatch.duration_ms,
                  createdAt: (knotData as any)?.createdAt || 0,
                  knotCount: knotData.junctions?.length || 0,
                });
              }
            }
          }

          // If not matched as a local download, include as an online streamed track
          if (!isDownloadedMatch) {
            const { extractYoutubeId } = require('@/src/store/playerStore');
            const ytId = extractYoutubeId(key) || extractYoutubeId(knotData._id);
            let onlineSource: KnottedSong['source'] = 'youtube';
            let isYoutube = false;

            if (knotData.source && knotData.source !== 'local') {
              onlineSource = knotData.source;
              isYoutube = onlineSource === 'youtube';
            } else if (ytId || key.includes('youtube') || key.includes('youtu.be')) {
              onlineSource = 'youtube';
              isYoutube = true;
            } else if (key.includes('pagalworld') || key.includes('pagalsong')) {
              onlineSource = 'pagalworld';
            } else if (key.includes('pagalfree')) {
              onlineSource = 'pagalfree';
            } else {
              onlineSource = 'jiosaavn';
            }

            const cleanYtId = ytId || (isYoutube ? key : '');
            let fallbackThumbnail = knotData.thumbnail || '';
            if (!fallbackThumbnail && isYoutube && cleanYtId) {
              fallbackThumbnail = `https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg`;
            }

            const fallbackTitle =
              knotData.title ||
              (key.includes('/') ? key.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '') ||
              'Unknown Title';
            const fallbackArtist =
              knotData.artist ||
              (onlineSource === 'youtube' ? 'YouTube Track' : onlineSource === 'jiosaavn' ? 'JioSaavn Track' : 'Online Track');

            const effectiveKey = (isYoutube && cleanYtId) ? cleanYtId : key;
            if (!matchedFilenames.has(effectiveKey.toLowerCase())) {
              matchedFilenames.add(effectiveKey.toLowerCase());
              localMatched.push({
                id: `${effectiveKey}_${(knotData as any)?.createdAt || 0}`,
                key: effectiveKey,
                title: fallbackTitle,
                artist: fallbackArtist,
                thumbnail: fallbackThumbnail,
                knotName: `${knotData.junctions?.length || 0} Knot${(knotData.junctions?.length || 0) !== 1 ? 's' : ''}`,
                duration: formatDuration(knotData.original_duration_ms || 0),
                uri: isYoutube ? undefined : key,
                source: onlineSource,
                duration_ms: knotData.original_duration_ms || 0,
                createdAt: (knotData as any)?.createdAt || 0,
                knotCount: knotData.junctions?.length || 0,
              });
            }
          }
        } catch (e) {
          // Skip individual key errors
        }
      }

      // Merge remote
      for (const remote of remoteKnots) {
        const remoteFilename = (remote.local_id || '').toLowerCase();
        if (remoteFilename && !matchedFilenames.has(remoteFilename)) {
          const localMatch = allLocal.find(t => t.filename.toLowerCase() === remoteFilename);
          if (localMatch) {
            matchedFilenames.add(remoteFilename);
            localMatched.push({
              id: localMatch.id,
              key: remote.local_id,
              title: remote.title || localMatch.title,
              artist: remote.artist || localMatch.artist,
              thumbnail: localMatch.thumbnail || '',
              knotName: `${remote.nodes?.length || 0} Knot${(remote.nodes?.length || 0) !== 1 ? 's' : ''}`,
              duration: formatDuration(localMatch.duration_ms),
              uri: localMatch.uri,
              source: 'local',
              filename: localMatch.filename,
              duration_ms: localMatch.duration_ms,
              createdAt: remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0,
              knotCount: remote.nodes?.length || 0,
            });
          }
        }
      }

      // Sort newest first
      localMatched.sort((a, b) => b.createdAt - a.createdAt);
      setKnotted(localMatched);
    } catch (error) {
      console.error('[KnottedList] Error loading songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const knottedToTrack = (t: KnottedSong): Track => {
    const { extractYoutubeId } = require('@/src/store/playerStore');
    const ytId = t.source === 'youtube' ? (extractYoutubeId(t.key || t.uri || t.id) || t.key || t.uri || t.id) : undefined;
    return {
      youtube_id: ytId,
      jiosaavn_token: t.source === 'jiosaavn' ? (t.key || t.uri) : undefined,
      pagalworld_url: t.source === 'pagalworld' ? (t.key || t.uri) : undefined,
      pagalfree_url: t.source === 'pagalfree' ? (t.key || t.uri) : undefined,
      source: t.source,
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ''),
      duration_ms: t.duration_ms,
      local_uri: t.source === 'local' ? t.uri : undefined,
      filename: t.filename,
    };
  };

  const handlePlay = async (track: KnottedSong, index: number) => {
    try {
      const currentTrack = knottedToTrack(track);
      const queue: Track[] = knotted.map(knottedToTrack);

      usePlayerStore.getState().setQueue(queue, index);
      await AudioService.playQueueTrack(currentTrack);
      router.push('/player');
    } catch (error) {
      console.error('[KnottedList] Error playing track:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knotted Collection</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={knotted}
        keyExtractor={(item) => item.uri || item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No knotted songs found.</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TrackItem
            title={item.title}
            artist={item.artist}
            thumbnail={item.thumbnail}
            duration={item.duration}
            knotBadge={item.knotName}
            onPress={() => handlePlay(item, index)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.statsText}>{knotted.length} Songs Knotted</Text>
          </View>
        }
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <PlayerBar />
    </SafeAreaView>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  listHeader: {
    marginBottom: spacing.lg,
  },
  statsText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyState: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

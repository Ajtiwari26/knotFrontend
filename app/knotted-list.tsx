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

interface KnottedSong {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  knotName: string;
  duration: string;
  uri?: string;
  source: 'local' | 'youtube';
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

      // Process local keys
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

      // Merge remote
      for (const remote of remoteKnots) {
        const remoteFilename = (remote.local_id || '').toLowerCase();
        if (remoteFilename && !matchedFilenames.has(remoteFilename)) {
          const localMatch = allLocal.find(t => t.filename.toLowerCase() === remoteFilename);
          if (localMatch) {
            matchedFilenames.add(remoteFilename);
            localMatched.push({
              id: localMatch.id,
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

  const handlePlay = async (track: KnottedSong, index: number) => {
    try {
      const queue: Track[] = knotted.map(t => ({
        youtube_id: t.id || t.uri,
        source: t.source,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail,
        duration_ms: t.duration_ms,
        local_uri: t.uri,
        filename: t.filename,
      }));

      usePlayerStore.getState().setQueue(queue, index);
      await AudioService.playQueueTrack(queue[index]);
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

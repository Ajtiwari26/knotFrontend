import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, Music, FolderOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { LocalMusicService, LocalTrack } from '@/src/services/LocalMusicService';
import { usePlayerStore } from '@/src/store/playerStore';
import { Artwork } from '@/src/components/Artwork';
import { AudioService } from '@/src/services/AudioService';

export default function LocalSongsScreen() {
  const router = useRouter();
  const setCurrentTrack = usePlayerStore((s) => s.setCurrentTrack);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setQueue = usePlayerStore((s) => s.setQueue);

  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    setLoading(true);
    const granted = await LocalMusicService.requestPermission();
    if (!granted) {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }
    const result = await LocalMusicService.getDeviceSongs(80);
    setTracks(result.tracks);
    setCursor(result.endCursor);
    setHasMore(result.hasNextPage);
    setLoading(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || search.length > 0) return;
    setLoadingMore(true);
    const result = await LocalMusicService.getDeviceSongs(80, cursor);
    setTracks((prev) => [...prev, ...result.tracks]);
    setCursor(result.endCursor);
    setHasMore(result.hasNextPage);
    setLoadingMore(false);
  };

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) {
      // Reset to initial list
      const result = await LocalMusicService.getDeviceSongs(80);
      setTracks(result.tracks);
      setCursor(result.endCursor);
      setHasMore(result.hasNextPage);
      return;
    }
    setLoading(true);
    const results = await LocalMusicService.searchDeviceSongs(q.trim());
    setTracks(results);
    setHasMore(false);
    setLoading(false);
  }, []);

  const handlePlay = async (track: LocalTrack, index: number) => {
    const queueTracks = tracks.map(t => ({
      local_uri: t.uri,
      source: 'local' as const,
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnail || '',
      duration_ms: t.duration_ms,
    }));
    
    setQueue(queueTracks, index);
    setIsPlaying(true);
    await AudioService.playLocal(track.uri, track.title, track.artist, track.thumbnail, track.uri);
    router.push('/player');
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '--:--';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderTrack = ({ item, index }: { item: LocalTrack, index: number }) => (
    <TouchableOpacity style={s.trackRow} onPress={() => handlePlay(item, index)} activeOpacity={0.7}>
      <Artwork uri={item.thumbnail} thumbnail={item.thumbnail} style={s.trackArt} />
      <View style={s.trackInfo}>
        <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.trackArtist} numberOfLines={1}>{item.artist} • {formatDuration(item.duration_ms)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (permissionDenied) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Device Music</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={s.emptyState}>
          <FolderOpen size={64} color={colors.textSecondary} />
          <Text style={s.emptyTitle}>Permission Required</Text>
          <Text style={s.emptySubtitle}>
            Knot needs access to your media library to browse local songs.
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadInitial}>
            <Text style={s.retryText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Device Music</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search your music..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {/* Count Badge */}
      {!loading && (
        <View style={s.countRow}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.countBadge}
          >
            <Text style={s.countText}>{tracks.length} songs found</Text>
          </LinearGradient>
        </View>
      )}

      {/* Track List */}
      {loading ? (
        <View style={s.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loaderText}>Scanning your music...</Text>
        </View>
      ) : tracks.length === 0 ? (
        <View style={s.emptyState}>
          <Music size={64} color={colors.textSecondary} />
          <Text style={s.emptyTitle}>No Songs Found</Text>
          <Text style={s.emptySubtitle}>
            {search ? `No results for "${search}"` : 'No audio files found on your device.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrack}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 16 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.lg,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl,
    color: colors.text, letterSpacing: -0.3,
  },
  searchWrap: { paddingHorizontal: spacing.xxl, marginBottom: spacing.lg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, marginLeft: 10,
    fontFamily: typography.fontFamily.body, fontSize: typography.size.md,
    color: colors.text, paddingVertical: 0,
  },
  countRow: { paddingHorizontal: spacing.xxl, marginBottom: spacing.lg },
  countBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs,
    color: colors.onPrimary,
  },
  list: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  trackArt: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLow, marginRight: 14,
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md,
    color: colors.text, marginBottom: 3,
  },
  trackArtist: {
    fontFamily: typography.fontFamily.body, fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loaderText: {
    fontFamily: typography.fontFamily.body, fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: {
    fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl,
    color: colors.text, marginTop: 20,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamily.body, fontSize: typography.size.sm,
    color: colors.textSecondary, textAlign: 'center', marginTop: 8,
  },
  retryBtn: {
    marginTop: 24, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
  },
  retryText: {
    fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm,
    color: colors.onPrimary,
  },
});

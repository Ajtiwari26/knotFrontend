import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Artwork } from '@/src/components/Artwork';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Play, Heart, Bell } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';
import { KnotService } from '@/src/services/KnotService';
import { LocalMusicService, LocalTrack } from '@/src/services/LocalMusicService';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';

const { width } = Dimensions.get('window');

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

const TRENDING = [
  { id: 't1', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20', knotName: 'Drop Only' },
  { id: 't2', title: 'Shape of You', artist: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg', duration: '3:54', knotName: 'No Intro' },
  { id: 't3', title: 'Levitating', artist: 'Dua Lipa', thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg', duration: '3:23', knotName: 'Chorus Loop' },
  { id: 't4', title: 'Stay', artist: 'The Kid LAROI, Justin Bieber', thumbnail: 'https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg', duration: '2:21', knotName: 'Best Part' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [knotted, setKnotted] = useState<KnottedSong[]>([]);
  const [loading, setLoading] = useState(true);

  // Load knotted songs on focus
  useFocusEffect(
    useCallback(() => {
      loadKnottedSongs();
    }, [])
  );

  const loadKnottedSongs = async () => {
    try {
      setLoading(true);

      // 1. Load all local tracks from the device cache
      const { tracks: allLocal } = await LocalMusicService.getDeviceSongs(5000);

      // 2. Load all knotted details (sorted newest first)
      const details = await KnotService.getAllKnottedDetails();

      // 3. Match details to local files
      const matched: KnottedSong[] = [];
      for (const item of details) {
        const uri = item.key;
        let match = allLocal.find(t => t.uri === uri);
        if (!match) {
          const fn = uri.split('/').pop()?.toLowerCase();
          if (fn) match = allLocal.find(t => t.filename.toLowerCase() === fn);
        }

        if (match) {
          matched.push({
            id: match.id,
            title: match.title,
            artist: match.artist,
            thumbnail: match.thumbnail || '',
            knotName: `${item.knot.junctions?.length || 0} Knot${(item.knot.junctions?.length || 0) !== 1 ? 's' : ''}`,
            duration: formatDuration(match.duration_ms),
            uri: match.uri,
            source: 'local',
            filename: match.filename,
            duration_ms: match.duration_ms,
            createdAt: item.createdAt,
            knotCount: item.knot.junctions?.length || 0,
          });
        }
      }

      setKnotted(matched);
    } catch (error) {
      console.error('[Home] Error loading knotted songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (track: KnottedSong, allTracks: KnottedSong[]) => {
    try {
      const localTrack: Track = {
        youtube_id: track.id || track.uri,
        source: 'local' as const,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration_ms: track.duration_ms,
        local_uri: track.uri,
        filename: track.filename,
      };

      const queue: Track[] = allTracks.map(t => ({
        youtube_id: t.id || t.uri,
        source: 'local' as const,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail,
        duration_ms: t.duration_ms,
        local_uri: t.uri,
        filename: t.filename,
      }));

      const startIndex = queue.findIndex(q => (q.local_uri || q.youtube_id) === (localTrack.local_uri || localTrack.youtube_id));
      usePlayerStore.getState().setQueue(queue, startIndex >= 0 ? startIndex : 0);
      await AudioService.playQueueTrack(localTrack);
      router.push('/player');
    } catch (error) {
      console.error('[Home] Error playing track:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Editorial Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>VIBRANT RESONANCE</Text>
              <Text style={styles.displayTitle}>Pulse of{'\n'}The Street</Text>
            </View>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => router.push('/notifications')}
            >
              <Bell size={22} color={colors.text} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Knots Carousel */}
        <SectionHeader 
          title="Recently Knotted" 
          onAction={() => router.push('/knotted-songs')}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : knotted.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No knotted songs yet. Start knotting your music!</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            style={styles.carousel}
          >
            {knotted.map((knot) => (
              <TouchableOpacity
                key={knot.id}
                style={styles.knotCard}
                activeOpacity={0.85}
                onPress={() => handlePlay(knot, knotted)}
              >
                <Artwork
                  uri={knot.thumbnail}
                  thumbnail={knot.thumbnail}
                  style={styles.knotImage}
                />
                <View style={styles.playOverlay}>
                  <View style={styles.playBadge}>
                    <Play size={18} color={colors.onPrimary} fill={colors.onPrimary} />
                  </View>
                </View>
                <Text style={styles.knotTitle} numberOfLines={1}>{knot.title}</Text>
                <Text style={styles.knotArtist} numberOfLines={1}>{knot.artist}</Text>
                <View style={styles.knotBadgeWrap}>
                  <Text style={styles.knotBadge}>{knot.knotName}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Trending Knots */}
        <View style={styles.sectionGap} />
        <SectionHeader
          title="Trending Knots"
          onAction={() => router.push('/community')}
        />
        {TRENDING.map((item) => (
          <TrackItem
            key={item.id}
            title={item.title}
            artist={item.artist}
            thumbnail={item.thumbnail}
            duration={item.duration}
            knotBadge={item.knotName}
            showHeart
            onPress={() => router.push('/song-detail')}
          />
        ))}

        {/* Quick Actions */}
        <View style={styles.sectionGap} />
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/downloads')}>
            <Text style={styles.quickEmoji}>📥</Text>
            <Text style={styles.quickLabel}>Downloads</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/community')}>
            <Text style={styles.quickEmoji}>🌍</Text>
            <Text style={styles.quickLabel}>Community</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/queue')}>
            <Text style={styles.quickEmoji}>📋</Text>
            <Text style={styles.quickLabel}>Queue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Glassmorphic Player Bar */}
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
  container: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  kicker: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.primary,
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.sm,
  },
  displayTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.display,
    lineHeight: typography.size.display * typography.lineHeight.tight,
    color: colors.text,
    letterSpacing: typography.letterSpacing.tighter,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryContainer,
  },
  carousel: {
    marginHorizontal: -spacing.xxl,
  },
  carouselContent: {
    paddingHorizontal: spacing.xxl,
  },
  knotCard: {
    width: width * 0.58,
    marginRight: spacing.xl,
  },
  knotImage: {
    width: '100%',
    height: width * 0.58,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerLow,
  },
  playOverlay: {
    position: 'absolute',
    top: width * 0.58 - 52,
    right: 14,
  },
  playBadge: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  knotTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    color: colors.text,
    marginTop: 14,
  },
  knotArtist: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  knotBadgeWrap: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  knotBadge: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: colors.onPrimaryContainer,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionGap: {
    height: spacing.section,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  quickEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

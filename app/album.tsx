import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Play } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';
import DownloadService from '@/src/services/DownloadService';
import JiosaavnService, { JiosaavnAlbumDetails, JiosaavnAlbumSong } from '@/src/services/JiosaavnService';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function toTrack(song: JiosaavnAlbumSong, albumImage?: string): Track {
  return {
    jiosaavn_token: song.token,
    source: 'jiosaavn' as const,
    title: song.title,
    artist: song.artist || 'JioSaavn',
    thumbnail: song.imageUrl || albumImage || '',
    duration_ms: song.duration_ms,
  };
}

export default function AlbumScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [album, setAlbum] = useState<JiosaavnAlbumDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const data = await JiosaavnService.getAlbum(token);
      if (!cancelled) {
        setAlbum(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handlePlay = async (index: number) => {
    if (!album) return;
    try {
      const queueTracks = album.songs.map(s => toTrack(s, album.imageUrl));
      setQueue(queueTracks, index);
      setIsPlaying(true);
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Album play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{album?.title || 'Album'}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !album ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Album not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <Image source={{ uri: album.imageUrl }} style={s.heroImg} />
            <View style={s.heroInfo}>
              <Text style={s.heroTitle} numberOfLines={2}>{album.title}</Text>
              <Text style={s.heroSubtitle} numberOfLines={1}>{album.artist}</Text>
              <Text style={s.heroMeta}>
                {[album.year, album.language, `${album.songs.length} songs`].filter(Boolean).join(' · ')}
              </Text>
              <TouchableOpacity style={s.playBtn} onPress={() => handlePlay(0)}>
                <Play size={16} color={colors.background} fill={colors.background} />
                <Text style={s.playBtnText}>Play All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {album.songs.map((song, i) => (
            <TrackItem
              key={`alb-${song.token}`}
              title={song.title}
              artist={song.artist || album.artist || 'JioSaavn'}
              thumbnail={song.imageUrl || album.imageUrl}
              duration={song.duration_ms ? formatMs(song.duration_ms) : '--:--'}
              showMore
              onPress={() => handlePlay(i)}
              onDownload={() => DownloadService.downloadTrack(toTrack(song, album.imageUrl))}
            />
          ))}
        </ScrollView>
      )}
      <PlayerBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg },
  backBtn: { marginRight: spacing.lg },
  title: { flex: 1, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  heroImg: { width: 140, height: 140, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainer },
  heroInfo: { flex: 1, marginLeft: spacing.xl },
  heroTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, color: colors.text },
  heroSubtitle: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  heroMeta: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 4 },
  playBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: borderRadius.full, marginTop: spacing.md, gap: 6 },
  playBtnText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.background },
});

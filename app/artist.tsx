import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BadgeCheck, Play } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';
import DownloadService from '@/src/services/DownloadService';
import JiosaavnService, { JiosaavnArtistDetails, JiosaavnAlbumSong } from '@/src/services/JiosaavnService';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function formatFollowers(count?: number): string {
  if (!count) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M followers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K followers`;
  return `${count} followers`;
}

function toTrack(song: JiosaavnAlbumSong): Track {
  return {
    jiosaavn_token: song.token,
    source: 'jiosaavn' as const,
    title: song.title,
    artist: song.artist || 'JioSaavn',
    thumbnail: song.imageUrl || '',
    duration_ms: song.duration_ms,
  };
}

export default function ArtistScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [artist, setArtist] = useState<JiosaavnArtistDetails | null>(null);
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
      const data = await JiosaavnService.getArtist(token);
      if (!cancelled) {
        setArtist(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const playFrom = async (songs: JiosaavnAlbumSong[], index: number) => {
    try {
      const queueTracks = songs.map(toTrack);
      setQueue(queueTracks, index);
      setIsPlaying(true);
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Artist play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{artist?.name || 'Artist'}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !artist ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Artist not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <Image source={{ uri: artist.imageUrl }} style={s.heroImg} />
            <View style={s.heroInfo}>
              <View style={s.nameRow}>
                <Text style={s.heroTitle} numberOfLines={1}>{artist.name}</Text>
                {artist.isVerified && <BadgeCheck size={18} color={colors.primary} />}
              </View>
              {!!artist.followerCount && (
                <Text style={s.heroMeta}>{formatFollowers(artist.followerCount)}</Text>
              )}
              {artist.topSongs.length > 0 && (
                <TouchableOpacity style={s.playBtn} onPress={() => playFrom(artist.topSongs, 0)}>
                  <Play size={16} color={colors.background} fill={colors.background} />
                  <Text style={s.playBtnText}>Play Top Songs</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {artist.topSongs.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Top Songs</Text>
              {artist.topSongs.map((song, i) => (
                <TrackItem
                  key={`ts-${song.token}`}
                  title={song.title}
                  artist={song.artist || artist.name}
                  thumbnail={song.imageUrl}
                  duration={song.duration_ms ? formatMs(song.duration_ms) : '--:--'}
                  showMore
                  onPress={() => playFrom(artist.topSongs, i)}
                  onDownload={() => DownloadService.downloadTrack(toTrack(song))}
                />
              ))}
            </View>
          )}

          {artist.topAlbums.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Albums</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {artist.topAlbums.map((al, i) => (
                  <TouchableOpacity
                    key={`aa-${al.token || i}`}
                    style={s.albumCard}
                    onPress={() => router.push({ pathname: '/album', params: { token: al.token } })}
                  >
                    <Image source={{ uri: al.imageUrl }} style={s.albumImg} />
                    <Text style={s.albumTitle} numberOfLines={1}>{al.title}</Text>
                    <Text style={s.albumSubtitle} numberOfLines={1}>{al.year || al.artist || 'Album'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {artist.singles.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Singles</Text>
              {artist.singles.map((song, i) => (
                <TrackItem
                  key={`sg-${song.token}`}
                  title={song.title}
                  artist={song.artist || artist.name}
                  thumbnail={song.imageUrl}
                  duration={song.duration_ms ? formatMs(song.duration_ms) : '--:--'}
                  showMore
                  onPress={() => playFrom(artist.singles, i)}
                  onDownload={() => DownloadService.downloadTrack(toTrack(song))}
                />
              ))}
            </View>
          )}
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
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.section },
  heroImg: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surfaceContainer },
  heroInfo: { flex: 1, marginLeft: spacing.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text, flexShrink: 1 },
  heroMeta: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  playBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: borderRadius.full, marginTop: spacing.md, gap: 6 },
  playBtnText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.background },
  section: { marginBottom: spacing.section },
  sectionTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text, marginBottom: spacing.md },
  albumCard: { width: 140, marginRight: spacing.lg },
  albumImg: { width: 140, height: 140, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceContainer, marginBottom: 8 },
  albumTitle: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text },
  albumSubtitle: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary },
});

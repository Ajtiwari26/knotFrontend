import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

export default function KnottedSongsScreen() {
  const router = useRouter();
  const [knotted, setKnotted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    loadKnotted();
  }, []);

  const loadKnotted = async () => {
    try {
      setLoading(true);
      const details = await KnotService.getAllKnottedDetails();
      const { tracks: allLocal } = await LocalMusicService.getDeviceSongs(5000);

      const matched: any[] = [];
      const matchedFilenames = new Set<string>();

      for (const item of details) {
        const uri = item.key;
        let match = allLocal.find(t => t.uri === uri);
        if (!match) {
          const fn = uri.split('/').pop()?.toLowerCase();
          if (fn) match = allLocal.find(t => t.filename.toLowerCase() === fn);
        }

        // Fallback: match by title & artist
        if (!match) {
          let itemTitle = item.knot.title || '';
          let itemArtist = item.knot.artist || '';
          if (!itemTitle) {
            const lastSegment = uri.split('/').pop() || '';
            itemTitle = lastSegment.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          }
          match = allLocal.find(t => 
            KnotService.isTitleMatch(t.title, itemTitle) && 
            KnotService.isArtistMatch(t.artist, itemArtist)
          );
        }

        if (match && !matchedFilenames.has(match.filename.toLowerCase())) {
          matchedFilenames.add(match.filename.toLowerCase());
          const totalSeconds = Math.floor(match.duration_ms / 1000);
          matched.push({
            ...match,
            duration: `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`,
            knotCount: item.knot.junctions?.length || 0,
          });
        } else if (!match && !uri.startsWith('file://') && !uri.startsWith('content://')) {
          // Online key — check if it was downloaded
          try {
            const downloadedData = await AsyncStorage.getItem(`downloaded_track_${uri}`);
            if (downloadedData) {
              const downloaded = JSON.parse(downloadedData);
              const downloadedFilename = (downloaded.filename || '').toLowerCase();
              if (downloadedFilename && !matchedFilenames.has(downloadedFilename)) {
                const localMatch = allLocal.find(t => t.filename.toLowerCase() === downloadedFilename)
                                || (downloaded.local_uri ? allLocal.find(t => t.uri === downloaded.local_uri) : null);
                if (localMatch) {
                  matchedFilenames.add(localMatch.filename.toLowerCase());
                  const totalSeconds = Math.floor(localMatch.duration_ms / 1000);
                  matched.push({
                    ...localMatch,
                    duration: `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`,
                    knotCount: item.knot.junctions?.length || 0,
                  });
                }
              }
            }
          } catch (e) {
            // Skip individual key errors
          }
        }
      }
      setKnotted(matched);
    } catch (e) {
      console.error('[KnottedSongs] Error loading:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (track: any, index: number) => {
    try {
      const queueTracks: Track[] = knotted.map(r => ({
        source: 'local',
        title: r.title,
        artist: r.artist,
        thumbnail: r.thumbnail || '',
        duration_ms: r.duration_ms,
        local_uri: r.uri,
        filename: r.filename,
      }));

      setIsPlaying(true);
      setQueue(queueTracks, index);
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Play error:', e);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={s.title}>Knotted Library</Text>
      </View>

      <FlatList
        data={knotted}
        keyExtractor={(item) => item.uri || item.filename}
        contentContainerStyle={s.list}
        renderItem={({ item, index }) => (
          <TrackItem
            title={item.title}
            artist={item.artist}
            thumbnail={item.thumbnail}
            duration={item.duration}
            knotBadge={`${item.knotCount} Knots`}
            showHeart
            onPress={() => handlePlay(item, index)}
          />
        )}
        ListEmptyComponent={() => !loading ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No knotted songs found.</Text>
          </View>
        ) : null}
      />

      <PlayerBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  backBtn: { marginRight: spacing.lg },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  list: { paddingHorizontal: spacing.xxl, paddingBottom: 100 },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
});

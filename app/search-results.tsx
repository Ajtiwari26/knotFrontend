import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Chip } from '@/src/components/Chip';
import { TrackItem } from '@/src/components/TrackItem';
import { resolveBaseUrl } from '@/src/config/api';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';

const FILTERS = ['All', 'Tracks', 'Artists', 'Knots'];

export default function SearchResultsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const setCurrentTrack = usePlayerStore(state => state.setCurrentTrack);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    if (query.trim().length > 2) {
      const delaySearch = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(delaySearch);
    }
  }, [query]);

  const handleSearch = async () => {
    try {
      setLoading(true);
      const baseUrl = await resolveBaseUrl();
      const res = await fetch(`${baseUrl}/api/songs/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (track: any, index: number) => {
    try {
      const baseUrl = await resolveBaseUrl();
      console.log(`[Play] Fetching stream URL for ${track.youtube_id} from ${baseUrl}`);
      
      const res = await fetch(`${baseUrl}/api/songs/${track.youtube_id}/stream-url`);
      const data = await res.json();
      
      if (!res.ok || !data.streamUrl) {
        const errorMsg = data.error || data.message || 'Unknown server error';
        console.error(`[Play] Server error: ${errorMsg}`, data);
        throw new Error(errorMsg);
      }
      
      const queueTracks: Track[] = results.map(r => ({
        youtube_id: r.youtube_id,
        source: 'youtube' as const,
        title: r.title,
        artist: r.artist,
        thumbnail: r.thumbnail,
        duration_ms: r.duration_ms,
      }));
      queueTracks[index].streamUrl = data.streamUrl;
      
      console.log('[Play] Starting playback...', track.title);
      setQueue(queueTracks, index);
      setIsPlaying(true);
      await AudioService.playStream(data.streamUrl, track.title, track.artist, track.thumbnail);
      router.push('/player');
    } catch (e) {
      console.error('Play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.searchBar}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <TextInput style={s.input} value={query} onChangeText={setQuery} autoFocus returnKeyType="search" placeholderTextColor={colors.textSecondary} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsPad}>
        {FILTERS.map(f => <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />)}
      </ScrollView>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <>
            <Text style={s.count}>{results.length} results for "{query}"</Text>
            {results.map((r, i) => (
              <TrackItem 
                key={r.youtube_id} 
                title={r.title} 
                artist={r.artist} 
                thumbnail={r.thumbnail} 
                duration={Math.floor(r.duration_ms / 60000) + ':' + String(Math.floor((r.duration_ms % 60000) / 1000)).padStart(2, '0')} 
                showMore 
                onPress={() => handlePlay(r, i)} 
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, gap: 8, marginBottom: spacing.lg },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
  input: { flex: 1, marginLeft: 10, fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.text, paddingVertical: 0 },
  chips: { marginBottom: spacing.lg },
  chipsPad: { paddingHorizontal: spacing.xxl },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  count: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing.lg },
});

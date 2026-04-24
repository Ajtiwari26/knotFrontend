import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, Mic, Wifi, WifiOff, X } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Chip } from '@/src/components/Chip';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';
import { KnotService } from '@/src/services/KnotService';
import { LocalMusicService, LocalTrack } from '@/src/services/LocalMusicService';
import { AudioService } from '@/src/services/AudioService';
import { usePlayerStore, Track } from '@/src/store/playerStore';
import { resolveBaseUrl } from '@/src/config/api';

const { width } = Dimensions.get('window');
const GENRES = ['All', 'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'R&B'];

const ARTISTS = [
  { id: 'a1', name: 'The Weeknd', img: 'https://i.pravatar.cc/150?img=1' },
  { id: 'a2', name: 'Dua Lipa', img: 'https://i.pravatar.cc/150?img=5' },
  { id: 'a3', name: 'Drake', img: 'https://i.pravatar.cc/150?img=3' },
  { id: 'a4', name: 'Billie Eilish', img: 'https://i.pravatar.cc/150?img=9' },
];

const TRACKS = [
  { id: 'tk1', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20', knotName: 'Drop Only' },
  { id: 'tk2', title: 'Bad Guy', artist: 'Billie Eilish', thumbnail: 'https://i.ytimg.com/vi/DyDfgMOUjCI/hqdefault.jpg', duration: '3:14', knotName: 'Bass Drop' },
];

export default function SearchScreen() {
  const router = useRouter();
  
  // Explore State
  const [activeGenre, setActiveGenre] = useState('All');
  const [knotted, setKnotted] = useState<{title: string; artist: string; thumbnail: string; duration: string; knotName: string; uri?: string; filename?: string; duration_ms: number}[]>([]);
  
  // Search State
  const [query, setQuery] = useState('');
  const latestQuery = React.useRef('');
  const [searchMode, setSearchMode] = useState<'online' | 'offline'>('online');
  const [localResults, setLocalResults] = useState<LocalTrack[]>([]);
  const [onlineResults, setOnlineResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Player Actions
  const setCurrentTrack = usePlayerStore(state => state.setCurrentTrack);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    loadKnottedLocal();
  }, []);

  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    
    if (q.length > 0) {
      const delaySearch = setTimeout(() => {
        handleSearch();
      }, 400);
      return () => clearTimeout(delaySearch);
    } else {
      setLocalResults([]);
      setOnlineResults([]);
    }
  }, [query, searchMode]);

  const loadKnottedLocal = async () => {
    try {
      const details = await KnotService.getAllKnottedDetails();
      const { tracks: allLocal } = await LocalMusicService.getDeviceSongs(5000);

      const matched: (typeof knotted[0] & { knotCount: number })[] = [];
      for (const item of details) {
        const uri = item.key;
        let match = allLocal.find(t => t.uri === uri);
        if (!match) {
          const fn = uri.split('/').pop()?.toLowerCase();
          if (fn) match = allLocal.find(t => t.filename.toLowerCase() === fn);
        }
        if (match) {
          const totalSeconds = Math.floor(match.duration_ms / 1000);
          matched.push({
            title: match.title,
            artist: match.artist,
            thumbnail: match.thumbnail || '',
            duration: `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`,
            knotName: `${item.knot.junctions?.length || 0} Knots`,
            uri: match.uri,
            filename: match.filename,
            duration_ms: match.duration_ms,
            knotCount: item.knot.junctions?.length || 0,
          });
        }
      }
      setKnotted(matched);
    } catch (e) {
      console.error('[Search] Error loading knotted local songs:', e);
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) {
      setLocalResults([]);
      setOnlineResults([]);
      return;
    }

    try {
      console.log(`[Search] Searching for: "${q}" (Mode: ${searchMode})`);
      
      // 1. Search Local (Always instant)
      const matchedLocal = await LocalMusicService.searchDeviceSongs(q);
      
      // Safety check: if user cleared search or typed something else, abort
      if (latestQuery.current !== q) return;
      
      setLocalResults(matchedLocal);
      console.log(`[Search] Found ${matchedLocal.length} local results`);

      // 2. Search Online (if mode is online)
      if (searchMode === 'online') {
        setLoading(true);
        const baseUrl = await resolveBaseUrl();
        const res = await fetch(`${baseUrl}/api/songs/search?q=${encodeURIComponent(q)}`);
        
        // Safety check: if user typed something else while waiting for fetch, abort
        if (latestQuery.current !== q) {
          setLoading(false);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const results = data ? data.slice(0, 8) : [];
          setOnlineResults(results);
          console.log(`[Search] Found ${results.length} online results`);
        } else {
          console.warn(`[Search] Online search failed: ${res.status}`);
          setOnlineResults([]);
        }
      } else {
        setOnlineResults([]);
      }
    } catch (e) {
      console.error('[Search] Search error:', e);
    } finally {
      if (latestQuery.current === q) {
        setLoading(false);
      }
    }
  };

  const handlePlayOnline = async (track: any, index: number) => {
    try {
      const baseUrl = await resolveBaseUrl();
      const streamUrl = `${baseUrl}/api/songs/${track.youtube_id}/stream`;
      
      const queueTracks: Track[] = onlineResults.map(r => ({
        youtube_id: r.youtube_id,
        source: 'youtube' as const,
        title: r.title,
        artist: r.artist,
        thumbnail: r.thumbnail,
        duration_ms: r.duration_ms,
      }));
      queueTracks[index].streamUrl = streamUrl;
      
      setQueue(queueTracks, index);
      setIsPlaying(true);
      await AudioService.playStream(streamUrl, track.title, track.artist, track.thumbnail);
      router.push('/player');
    } catch (e) {
      console.error('Play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  const handlePlayLocal = async (track: LocalTrack | typeof knotted[0], index: number) => {
    try {
      const localTrackForQueue: Track = {
        source: 'local',
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail || '',
        duration_ms: track.duration_ms,
        local_uri: track.uri,
        filename: track.filename,
      };
      
      // We only set the queue from localResults if we are searching, 
      // else just set queue to this one track if played from Explore
      if (query.trim().length > 0) {
        const queueTracks: Track[] = localResults.map(r => ({
          source: 'local',
          title: r.title,
          artist: r.artist,
          thumbnail: r.thumbnail || '',
          duration_ms: r.duration_ms,
          local_uri: r.uri,
          filename: r.filename,
        }));
        setQueue(queueTracks, index);
      } else {
        setQueue([localTrackForQueue], 0);
      }

      setIsPlaying(true);
      await AudioService.playQueueTrack(localTrackForQueue);
      router.push('/player');
    } catch (e) {
      console.error('Local play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  const isSearching = query.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerContainer}>
        {!isSearching && <Text style={s.title}>Explore</Text>}
        <View style={s.searchBar}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <TextInput 
            style={s.searchInput}
            placeholder="Search tracks, artists, knots..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {isSearching ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Mic size={20} color={colors.primary} />
          )}
        </View>
        
        <View style={s.toggleContainer}>
          <TouchableOpacity 
            style={[s.toggleBtn, searchMode === 'offline' && s.toggleBtnActive]} 
            onPress={() => setSearchMode('offline')}
          >
            <WifiOff size={16} color={searchMode === 'offline' ? colors.background : colors.textSecondary} style={{marginRight: 6}} />
            <Text style={[s.toggleText, searchMode === 'offline' && s.toggleTextActive]}>Offline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.toggleBtn, searchMode === 'online' && s.toggleBtnActive]} 
            onPress={() => setSearchMode('online')}
          >
            <Wifi size={16} color={searchMode === 'online' ? colors.background : colors.textSecondary} style={{marginRight: 6}} />
            <Text style={[s.toggleText, searchMode === 'online' && s.toggleTextActive]}>Online</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        
        {!isSearching ? (
          // --- EXPLORE CONTENT ---
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsPad}>
              {GENRES.map(g => <Chip key={g} label={g} active={activeGenre === g} onPress={() => setActiveGenre(g)} />)}
            </ScrollView>

            {knotted.length > 0 && (
              <>
                <View style={s.gap} />
                <SectionHeader 
                  title="Your Knotted Songs" 
                  onAction={() => router.push('/knotted-songs')}
                />
                {knotted.slice(0, 5).map((t, i) => (
                  <TrackItem
                    key={`knotted-${i}`}
                    title={t.title}
                    artist={t.artist}
                    thumbnail={t.thumbnail}
                    duration={t.duration}
                    knotBadge={t.knotName}
                    showHeart
                    onPress={() => handlePlayLocal(t, i)}
                  />
                ))}
              </>
            )}

            <View style={s.gap} />
            <SectionHeader title="Popular Artists" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ARTISTS.map(a => (
                <TouchableOpacity key={a.id} style={s.artistCard}>
                  <Image source={{ uri: a.img }} style={s.artistImg} />
                  <Text style={s.artistName} numberOfLines={1}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.gap} />
            <SectionHeader title="Top Community Knots" onAction={() => router.push('/community')} />
            {TRACKS.map(t => (
              <TrackItem key={t.id} title={t.title} artist={t.artist} thumbnail={t.thumbnail} duration={t.duration} knotBadge={t.knotName} showHeart onPress={() => router.push('/song-detail')} />
            ))}
          </>
        ) : (
          // --- SEARCH RESULTS ---
          <>
            {localResults.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Device Songs</Text>
                {localResults.map((r, i) => {
                  const totalSeconds = Math.floor(r.duration_ms / 1000);
                  const durationStr = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
                  return (
                    <TrackItem 
                      key={r.id || r.uri} 
                      title={r.title} 
                      artist={r.artist || 'Unknown'} 
                      thumbnail={r.thumbnail} 
                      duration={durationStr} 
                      showMore 
                      onPress={() => handlePlayLocal(r, i)} 
                    />
                  );
                })}
              </View>
            )}

            {searchMode === 'online' && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>YouTube Results</Text>
                {loading && onlineResults.length === 0 ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
                ) : (
                  onlineResults.map((r, i) => (
                    <TrackItem 
                      key={r.youtube_id} 
                      title={r.title} 
                      artist={r.artist} 
                      thumbnail={r.thumbnail} 
                      duration={Math.floor(r.duration_ms / 60000) + ':' + String(Math.floor((r.duration_ms % 60000) / 1000)).padStart(2, '0')} 
                      showMore 
                      onPress={() => handlePlayOnline(r, i)} 
                    />
                  ))
                )}
                {loading && onlineResults.length > 0 && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
                )}
              </View>
            )}

            {!loading && query.trim().length > 0 && localResults.length === 0 && (searchMode === 'offline' || onlineResults.length === 0) && (
              <Text style={s.emptyText}>No results found for "{query}"</Text>
            )}
          </>
        )}
      </ScrollView>
      <PlayerBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerContainer: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxxl, color: colors.text, marginBottom: spacing.xl, letterSpacing: -0.5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, padding: 14, borderRadius: borderRadius.md, marginBottom: spacing.lg, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 12, fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.text, paddingVertical: 0 },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.lg },
  toggleBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', borderRadius: borderRadius.sm },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.textSecondary },
  toggleTextActive: { color: colors.background },

  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  chips: { marginHorizontal: -spacing.xxl, marginBottom: spacing.xl },
  chipsPad: { paddingHorizontal: spacing.xxl },
  gap: { height: spacing.section },
  artistCard: { alignItems: 'center', marginRight: spacing.xl, width: 80 },
  artistImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceContainer, marginBottom: 8 },
  artistName: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.text, textAlign: 'center' },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text, marginBottom: spacing.md },
  emptyText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
});

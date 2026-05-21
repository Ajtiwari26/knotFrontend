import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, Mic, Wifi, WifiOff, X, Clock } from 'lucide-react-native';
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
import DownloadService from '@/src/services/DownloadService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = 'online_search_history';
const MAX_SEARCH_HISTORY = 2;

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

const SearchSkeletonItem = () => {
  return (
    <View style={s.skeletonContainer}>
      <View style={s.skeletonArt} />
      <View style={s.skeletonInfo}>
        <View style={s.skeletonTitle} />
        <View style={s.skeletonSubtitle} />
      </View>
    </View>
  );
};

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
  const [pagalworldResults, setPagalworldResults] = useState<any[]>([]);
  const [pagalfreeResults, setPagalfreeResults] = useState<any[]>([]);
  const [jiosaavnResults, setJiosaavnResults] = useState<any[]>([]);
  
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [loadingPagalworld, setLoadingPagalworld] = useState(false);
  const [loadingPagalfree, setLoadingPagalfree] = useState(false);
  const [loadingJiosaavn, setLoadingJiosaavn] = useState(false);
  const loading = loadingYoutube || loadingPagalworld || loadingPagalfree || loadingJiosaavn;

  // Search History State
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Player Actions
  const setCurrentTrack = usePlayerStore(state => state.setCurrentTrack);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    loadKnottedLocal();
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const data = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (data) setSearchHistory(JSON.parse(data));
    } catch (e) {
      console.warn('[Search] Failed to load search history:', e);
    }
  };

  const saveSearchQuery = async (q: string) => {
    try {
      const trimmed = q.trim();
      if (!trimmed) return;
      const updated = [trimmed, ...searchHistory.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Search] Failed to save search history:', e);
    }
  };

  const removeSearchHistoryItem = async (index: number) => {
    try {
      const updated = searchHistory.filter((_, i) => i !== index);
      setSearchHistory(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Search] Failed to remove search history item:', e);
    }
  };

  // Instant local search on every keystroke
  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;

    if (q.length > 0) {
      // Local search is instant (in-memory cache)
      LocalMusicService.searchDeviceSongs(q).then(results => {
        if (latestQuery.current === q) setLocalResults(results);
      });
    } else {
      setLocalResults([]);
      setOnlineResults([]);
      setPagalworldResults([]);
      setPagalfreeResults([]);
      setJiosaavnResults([]);
      setLoadingYoutube(false);
      setLoadingPagalworld(false);
      setLoadingPagalfree(false);
      setLoadingJiosaavn(false);
    }
  }, [query]);

  // Debounced online search
  useEffect(() => {
    const q = query.trim();
    if (q.length > 0 && searchMode === 'online') {
      const delaySearch = setTimeout(() => {
        handleOnlineSearch(q);
      }, 300);
      return () => clearTimeout(delaySearch);
    } else {
      setOnlineResults([]);
      setPagalworldResults([]);
      setPagalfreeResults([]);
      setJiosaavnResults([]);
      setLoadingYoutube(false);
      setLoadingPagalworld(false);
      setLoadingPagalfree(false);
      setLoadingJiosaavn(false);
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

  const handleOnlineSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setOnlineResults([]);
      setPagalworldResults([]);
      setPagalfreeResults([]);
      setJiosaavnResults([]);
      setLoadingYoutube(false);
      setLoadingPagalworld(false);
      setLoadingPagalfree(false);
      setLoadingJiosaavn(false);
      return;
    }

    try {
      console.log(`[Search] Searching online for: "${trimmed}"`);
      
      // Save to search history
      saveSearchQuery(trimmed);
      
      // Reset old results and set all loading states
      setOnlineResults([]);
      setPagalworldResults([]);
      setPagalfreeResults([]);
      setJiosaavnResults([]);

      setLoadingYoutube(true);
      setLoadingPagalworld(true);
      setLoadingPagalfree(true);
      setLoadingJiosaavn(true);
      
      const fetchYoutube = async () => {
        try {
          const baseUrl = await resolveBaseUrl();
          const res = await fetch(`${baseUrl}/api/songs/search?q=${encodeURIComponent(trimmed)}`);
          if (latestQuery.current !== trimmed) return;
          if (res.ok) {
            const data = await res.json();
            setOnlineResults(data ? data.slice(0, 8) : []);
          }
        } catch (e) {
          console.warn('[Search] YouTube search failed', e);
        } finally {
          if (latestQuery.current === trimmed) {
            setLoadingYoutube(false);
          }
        }
      };

      const fetchPagalworld = async () => {
        try {
          const PagalworldService = require('@/src/services/PagalworldService').default;
          const results = await PagalworldService.search(trimmed);
          if (latestQuery.current !== trimmed) return;
          setPagalworldResults(results || []);
        } catch (e) {
          console.warn('[Search] Pagalworld search failed', e);
        } finally {
          if (latestQuery.current === trimmed) {
            setLoadingPagalworld(false);
          }
        }
      };

      const fetchPagalfree = async () => {
        try {
          const PagalfreeService = require('@/src/services/PagalfreeService').default;
          const results = await PagalfreeService.search(trimmed);
          if (latestQuery.current !== trimmed) return;
          setPagalfreeResults(results || []);
        } catch (e) {
          console.warn('[Search] Pagalfree search failed', e);
        } finally {
          if (latestQuery.current === trimmed) {
            setLoadingPagalfree(false);
          }
        }
      };

      const fetchJiosaavn = async () => {
        try {
          const JiosaavnService = require('@/src/services/JiosaavnService').default;
          const results = await JiosaavnService.search(trimmed);
          if (latestQuery.current !== trimmed) return;
          setJiosaavnResults(results || []);
        } catch (e) {
          console.warn('[Search] JioSaavn search failed', e);
        } finally {
          if (latestQuery.current === trimmed) {
            setLoadingJiosaavn(false);
          }
        }
      };

      // Fire all in parallel asynchronously
      fetchYoutube();
      fetchPagalworld();
      fetchPagalfree();
      fetchJiosaavn();
    } catch (e) {
      console.error('[Search] Online search error:', e);
      setLoadingYoutube(false);
      setLoadingPagalworld(false);
      setLoadingPagalfree(false);
      setLoadingJiosaavn(false);
    }
  };

  const handlePlayOnline = async (track: any, index: number) => {
    try {
      const queueTracks: Track[] = onlineResults.map(r => ({
        youtube_id: r.youtube_id,
        source: 'youtube' as const,
        title: r.title,
        artist: r.artist,
        thumbnail: r.thumbnail,
        duration_ms: r.duration_ms,
      }));
      
      setQueue(queueTracks, index);
      setIsPlaying(true);
      
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  const handlePlayPagalworld = async (track: any, index: number) => {
    try {
      const queueTracks: Track[] = pagalworldResults.map(r => ({
        pagalworld_url: r.url,
        source: 'pagalworld' as const,
        title: r.title,
        artist: r.artist || 'Pagalworld',
        thumbnail: r.imageUrl || '',
        duration_ms: 0, // Metadata will be fetched on play
      }));
      
      setQueue(queueTracks, index);
      setIsPlaying(true);
      
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Pagalworld play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  const handlePlayPagalfree = async (track: any, index: number) => {
    try {
      const queueTracks: Track[] = pagalfreeResults.map(r => ({
        pagalfree_url: r.url,
        source: 'pagalfree' as const,
        title: r.title,
        artist: r.artist || 'Pagalfree',
        thumbnail: r.imageUrl || '',
        duration_ms: 0, // Metadata will be fetched on play
      }));
      
      setQueue(queueTracks, index);
      setIsPlaying(true);
      
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('Pagalfree play error:', e);
      alert(`Playback Error: ${(e as Error).message}`);
    }
  };

  const handlePlayJiosaavn = async (track: any, index: number) => {
    try {
      const queueTracks: Track[] = jiosaavnResults.map(r => ({
        jiosaavn_token: r.token,
        source: 'jiosaavn' as const,
        title: r.title,
        artist: r.artist || 'JioSaavn',
        thumbnail: r.imageUrl || '',
        duration_ms: 0, // Metadata will be fetched on play
      }));
      
      setQueue(queueTracks, index);
      setIsPlaying(true);
      
      await AudioService.playQueueTrack(queueTracks[index]);
      router.push('/player');
    } catch (e) {
      console.error('JioSaavn play error:', e);
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

            {searchHistory.length > 0 && (
              <>
                <View style={s.recentHeader}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={s.recentTitle}>Recent Searches</Text>
                </View>
                <View style={s.recentRow}>
                  {searchHistory.map((q, i) => (
                    <TouchableOpacity 
                      key={`hist-${i}`} 
                      style={s.recentChip}
                      onPress={() => { setQuery(q); }}
                    >
                      <Text style={s.recentChipText} numberOfLines={1}>{q}</Text>
                      <TouchableOpacity 
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={(e) => { e.stopPropagation(); removeSearchHistoryItem(i); }}
                      >
                        <X size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.gap} />
              </>
            )}

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
              <>
                {/* JioSaavn Results (Fastest response) */}
                {(loadingJiosaavn || jiosaavnResults.length > 0) && (
                  <View style={s.section}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>JioSaavn Results</Text>
                      {loadingJiosaavn && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
                    </View>
                    {loadingJiosaavn && jiosaavnResults.length === 0 ? (
                      <>
                        <SearchSkeletonItem />
                        <SearchSkeletonItem />
                      </>
                    ) : (
                      jiosaavnResults.map((r, i) => (
                        <TrackItem 
                          key={`js-${i}`} 
                          title={r.title} 
                          artist={r.artist || 'JioSaavn'} 
                          thumbnail={r.imageUrl} 
                          duration="--:--" 
                          showMore 
                          onPress={() => handlePlayJiosaavn(r, i)} 
                          onDownload={() => DownloadService.downloadTrack({
                            jiosaavn_token: r.token,
                            source: 'jiosaavn',
                            title: r.title,
                            artist: r.artist || 'JioSaavn',
                            thumbnail: r.imageUrl || '',
                            duration_ms: 0
                          })}
                        />
                      ))
                    )}
                  </View>
                )}

                {/* YouTube Results */}
                {(loadingYoutube || onlineResults.length > 0) && (
                  <View style={s.section}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>YouTube Results</Text>
                      {loadingYoutube && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
                    </View>
                    {loadingYoutube && onlineResults.length === 0 ? (
                      <>
                        <SearchSkeletonItem />
                        <SearchSkeletonItem />
                      </>
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
                  </View>
                )}

                {/* Pagalworld Results */}
                {(loadingPagalworld || pagalworldResults.length > 0) && (
                  <View style={s.section}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>Pagalworld Results</Text>
                      {loadingPagalworld && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
                    </View>
                    {loadingPagalworld && pagalworldResults.length === 0 ? (
                      <>
                        <SearchSkeletonItem />
                        <SearchSkeletonItem />
                      </>
                    ) : (
                      pagalworldResults.map((r, i) => (
                        <TrackItem 
                          key={`pw-${i}`} 
                          title={r.title} 
                          artist={r.artist || 'Pagalworld'} 
                          thumbnail={r.imageUrl} 
                          duration="--:--" 
                          showMore 
                          onPress={() => handlePlayPagalworld(r, i)} 
                          onDownload={() => DownloadService.downloadTrack({
                            pagalworld_url: r.url,
                            source: 'pagalworld',
                            title: r.title,
                            artist: r.artist || 'Pagalworld',
                            thumbnail: r.imageUrl || '',
                            duration_ms: 0
                          })}
                        />
                      ))
                    )}
                  </View>
                )}

                {/* Pagalfree Results */}
                {(loadingPagalfree || pagalfreeResults.length > 0) && (
                  <View style={s.section}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>Pagalfree Results</Text>
                      {loadingPagalfree && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
                    </View>
                    {loadingPagalfree && pagalfreeResults.length === 0 ? (
                      <>
                        <SearchSkeletonItem />
                        <SearchSkeletonItem />
                      </>
                    ) : (
                      pagalfreeResults.map((r, i) => (
                        <TrackItem 
                          key={`pf-${i}`} 
                          title={r.title} 
                          artist={r.artist || 'Pagalfree'} 
                          thumbnail={r.imageUrl} 
                          duration="--:--" 
                          showMore 
                          onPress={() => handlePlayPagalfree(r, i)} 
                          onDownload={() => DownloadService.downloadTrack({
                            pagalfree_url: r.url,
                            source: 'pagalfree',
                            title: r.title,
                            artist: r.artist || 'Pagalfree',
                            thumbnail: r.imageUrl || '',
                            duration_ms: 0
                          })}
                        />
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            {!loading && query.trim().length > 0 && localResults.length === 0 && 
              ((searchMode === 'offline') || 
               (searchMode === 'online' && onlineResults.length === 0 && pagalworldResults.length === 0 && pagalfreeResults.length === 0 && jiosaavnResults.length === 0)) && (
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  emptyText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

  // Skeletons
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: 12,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    opacity: 0.6,
  },
  skeletonArt: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainer,
  },
  skeletonInfo: {
    flex: 1,
    marginLeft: 14,
    gap: 8,
  },
  skeletonTitle: {
    width: '65%',
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  skeletonSubtitle: {
    width: '45%',
    height: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceContainer,
  },

  // Recent Searches
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  recentTitle: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceContainerLow, paddingHorizontal: 14, paddingVertical: 9, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.surfaceContainerHigh },
  recentChipText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text, maxWidth: 160 },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Share, Alert, LayoutAnimation, Platform, UIManager, Animated, Easing } from 'react-native';
import { Artwork } from '@/src/components/Artwork';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, ListMusic, Share2, Scissors, X, Wand2, Download, Trash2, Plus, Edit2, Check, Copy, Sliders } from 'lucide-react-native';
import { ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { usePlayerStore } from '@/src/store/playerStore';
import LyricsService, { LyricLine } from '@/src/services/LyricsService';
import { AudioService } from '@/src/services/AudioService';
import { KnotService } from '@/src/services/KnotService';
import TrackPlayer, { useProgress, State, usePlaybackState, useActiveTrack } from 'react-native-track-player';
import { RopeSeekbar, Knot } from '@/src/components/RopeSeekbar';
import { useLibraryStore } from '@/src/store/libraryStore';
import { AutoKnotSheet } from '@/src/components/AutoKnotSheet';
import { AutoKnotTier } from '@/src/services/AutoKnotService';
import DownloadService from '@/src/services/DownloadService';
import Svg, { Path, Polyline, Line, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
interface DownloadIconProps {
  progress?: number;
  color: string;
  size: number;
}

const DownloadIcon = ({ progress, color, size }: DownloadIconProps) => {
  const isDownloading = progress !== undefined && progress !== null && progress > 0 && progress < 1;
  const isDownloaded = progress === 1 || color === "#FF6D00";

  // Use gradient if downloading, otherwise solid color
  const strokeColor = isDownloaded
    ? "#FF6D00"
    : isDownloading
      ? "url(#download-progress-grad)"
      : color;

  const progressPercent = isDownloading ? `${Math.min(100, Math.max(0, progress * 100))}%` : "0%";

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDownloading && (
          <Defs>
            <SvgLinearGradient id="download-progress-grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FF6D00" />
              <Stop offset={progressPercent} stopColor="#FF6D00" />
              <Stop offset={progressPercent} stopColor={color} />
              <Stop offset="100%" stopColor={color} />
            </SvgLinearGradient>
          </Defs>
        )}
        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <Polyline points="7 10 12 15 17 10" />
        <Line x1="12" x2="12" y1="15" y2="3" />
      </Svg>
    </View>
  );
};

const { width } = Dimensions.get('window');
const ART_SIZE = width - 180; // Reduced artwork to push controls lower on screen

export default function PlayerScreen() {
  const router = useRouter();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const activeKnot = usePlayerStore(state => state.activeKnot);
  const setIsPlayingStore = usePlayerStore(state => state.setIsPlaying);
  const knottingStatus = usePlayerStore(state => state.knottingStatus);
  const knottingProgress = usePlayerStore(state => state.knottingProgress);
  const knottingPhase = usePlayerStore(state => state.knottingPhase);
  const pendingKnots = usePlayerStore(state => state.pendingKnots);

  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const isPlaying = playbackState?.state === State.Playing;

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isKnotManagerVisible, setIsKnotManagerVisible] = useState(false);
  const [isNewVerModalVisible, setIsNewVerModalVisible] = useState(false);
  const [newVerName, setNewVerName] = useState('');
  const [editingVerId, setEditingVerId] = useState<string | null>(null);
  const [renameVerInput, setRenameVerInput] = useState('');
  const downloadProgress = usePlayerStore(state => state.downloadProgress);
  const songKey = currentTrack ? (
    currentTrack.source === 'local'
      ? (currentTrack.local_uri || currentTrack.filename || currentTrack.youtube_id)
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token)
  ) : null;
  const activeProgress = songKey ? downloadProgress[songKey] : undefined;

  useEffect(() => {
    const checkDownloaded = async () => {
      if (!currentTrack) {
        setIsDownloaded(false);
        return;
      }
      if (currentTrack.source === 'local') {
        setIsDownloaded(true);
        return;
      }
      const trackKey = currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token;
      if (trackKey) {
        const existing = await AsyncStorage.getItem(`downloaded_track_${trackKey}`);
        setIsDownloaded(!!existing);
      } else {
        setIsDownloaded(false);
      }
    };
    checkDownloaded();
  }, [currentTrack]);

  useEffect(() => {
    if (activeProgress === 1.0) {
      setIsDownloaded(true);
    }
  }, [activeProgress]);

  // Sync store with native player if store is empty but player is active
  useEffect(() => {
    if (!currentTrack && activeTrack) {
      const art = activeTrack.artwork;
      const recoveredTrack = {
        source: activeTrack.url?.startsWith('http') ? 'youtube' : 'local',
        title: activeTrack.title || 'Unknown',
        artist: activeTrack.artist || 'Unknown',
        thumbnail: typeof art === 'string' ? art : (typeof art === 'number' ? String(art) : ''),
        duration_ms: (activeTrack.duration || 0) * 1000,
        local_uri: activeTrack.url?.startsWith('file://') ? activeTrack.url : undefined,
        youtube_id: !activeTrack.url?.startsWith('file://') ? 'recovered' : undefined,
      };
      // @ts-ignore - internal state reconstruction
      usePlayerStore.getState().setCurrentTrack(recoveredTrack);
    }
  }, [currentTrack, activeTrack]);

  const { position, duration } = useProgress(100);

  const library = useLibraryStore();
  const trackId = currentTrack ? (currentTrack.source === 'youtube' ? currentTrack.youtube_id : currentTrack.local_uri) : '';
  const liked = library.isLiked(trackId || '');

  const toggleLike = () => {
    if (!currentTrack || !trackId) return;
    if (liked) {
      library.removeLikedSong(trackId);
    } else {
      library.addLikedSong(currentTrack);
    }
  };

  // Multi-knot state (now global)
  const knots = usePlayerStore(state => state.knots);
  const setKnots = usePlayerStore(state => state.setKnots);
  const [pendingA, setPendingA] = useState<number | null>(null);
  const [pendingB, setPendingB] = useState<number | null>(null);
  const [autoKnotVisible, setAutoKnotVisible] = useState(false);

  useEffect(() => {
    setIsPlayingStore(isPlaying);
  }, [isPlaying]);

  // Clear local pending knot markers instantly when track changes to prevent visual layout jank!
  useEffect(() => {
    setPendingA(null);
    setPendingB(null);
  }, [currentTrack]);

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      return;
    }
    const cached = LyricsService.getCachedLyrics(currentTrack);
    if (cached) {
      setLyrics(cached.lyrics);
    } else {
      LyricsService.getLyrics(currentTrack)
        .then((res) => setLyrics(res.lyrics))
        .catch((err) => console.warn('[Player] Error fetching lyrics:', err));
    }
  }, [currentTrack]);

  const lyricOffsets = usePlayerStore((state) => state.lyricOffsets);

  // Trigger LayoutAnimation when active lyric line shifts
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);

  const animatedActiveIdx = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.timing(animatedActiveIdx, {
      toValue: activeLyricIndex,
      duration: 220, // Snappier scroll transitions to align visuals perfectly with audio play
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeLyricIndex]);

  useEffect(() => {
    if (lyrics.length === 0) {
      setActiveLyricIndex(-1);
      return;
    }
    const trackKey = currentTrack ? (
      currentTrack.youtube_id || currentTrack.jiosaavn_token || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.local_uri || 'knot-track'
    ) : 'knot-track';

    const syncOffsetMs = lyricOffsets[trackKey] || 0;
    const positionMs = position * 1000 + syncOffsetMs + 220; // 220ms lookahead to compensate for TrackPlayer polling + transition duration latency!

    let activeIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (positionMs >= lyrics[i].timeMs) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== activeLyricIndex) {
      // Smooth teleprompter layout transition
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveLyricIndex(activeIdx);
    }
  }, [position, lyrics, currentTrack]);

  const getDisplayLines = () => {
    if (lyrics.length === 0) {
      return [
        { text: '• • •' },
        { text: 'Loading lyrics...' },
        { text: '• • •' }
      ];
    }

    if (lyrics.length === 1 && lyrics[0].text === "Lyrics not available for this track") {
      return [
        { text: '• • •' },
        { text: 'Lyrics not available' },
        { text: '• • •' }
      ];
    }

    return [
      { text: '• • •' },
      { text: 'Intro / Instrumental' },
      ...lyrics,
      { text: '• • •' },
      { text: '• • •' }
    ];
  };



  // Auto-save knots when they change (user edits them)
  useEffect(() => {
    const save = async () => {
      if (!currentTrack) return;
      const songKey = currentTrack.source === 'local'
        ? currentTrack.local_uri
        : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);
      if (!songKey) return;

      const currentActiveKnot = usePlayerStore.getState().activeKnot;
      const activeVerId = currentActiveKnot?.activeVersionId || 'v-default';
      const activeVerName = currentActiveKnot?.versions?.find(v => v.id === activeVerId)?.name || currentActiveKnot?.name || 'Saved Loop';

      const updatedJunctions = knots.map(k => ({
        start_ms: k.startTime * 1000,
        end_ms: k.endTime * 1000,
        active: k.active !== false
      }));

      // Reconstruct versions array
      let updatedVersions = currentActiveKnot?.versions || [
        {
          id: 'v-default',
          name: activeVerName,
          junctions: updatedJunctions
        }
      ];

      let found = false;
      updatedVersions = updatedVersions.map(v => {
        if (v.id === activeVerId) {
          found = true;
          return { ...v, junctions: updatedJunctions };
        }
        return v;
      });

      if (!found) {
        updatedVersions.push({
          id: activeVerId,
          name: activeVerName,
          junctions: updatedJunctions
        });
      }

      // If all versions are empty and no knots exist at all anywhere, only then delete the knot completely!
      const totalJunctions = updatedVersions.reduce((acc, curr) => acc + curr.junctions.length, 0);
      if (totalJunctions === 0) {
        await KnotService.deleteKnot(songKey);
        usePlayerStore.getState().setActiveKnot(null);
        return;
      }

      const knotData = {
        ...currentActiveKnot,
        _id: songKey,
        name: activeVerName,
        junctions: updatedJunctions,
        knotted_duration_ms: 0,
        original_duration_ms: currentTrack.duration_ms,
        title: currentTrack.title,
        artist: currentTrack.artist,
        // NOTE: thumbnail and source intentionally NOT stored in knot data
        // — they belong to the track and caused cross-song image bleeding.
        activeVersionId: activeVerId,
        versions: updatedVersions
      };

      await KnotService.saveKnot(songKey, knotData);
      usePlayerStore.getState().setActiveKnot(knotData);

      // Sync to backend for authenticated users & cross-install persistence
      KnotService.syncAllKnotsToBackend().catch(() => {});
      if (currentTrack.source === 'local') {
        KnotService.syncToBackend(currentTrack, knotData);
      }
    };
    save();
  }, [knots, currentTrack]);

  // Knot Version Management Action Handlers
  const handleSwitchVersion = async (versionId: string) => {
    if (!currentTrack || !activeKnot) return;

    const songKey = currentTrack.source === 'local'
      ? currentTrack.local_uri
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);
    if (!songKey) return;

    const version = activeKnot.versions?.find(v => v.id === versionId);
    if (!version) return;

    const updatedKnot = {
      ...activeKnot,
      activeVersionId: versionId,
      name: version.name,
      junctions: version.junctions
    };

    await KnotService.saveKnot(songKey, updatedKnot);

    if (currentTrack.source === 'local') {
      KnotService.syncToBackend(currentTrack, updatedKnot);
    }

    usePlayerStore.getState().setActiveKnot(updatedKnot);
    usePlayerStore.getState().setKnots(version.junctions.map(j => ({
      startTime: j.start_ms / 1000,
      endTime: j.end_ms / 1000,
      active: j.active !== false
    })));
  };

  const handleCreateVersion = async (name: string, cloneCurrent: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (!currentTrack) return;
    const songKey = currentTrack.source === 'local'
      ? currentTrack.local_uri
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);
    if (!songKey) return;

    const newId = `v-${Date.now()}`;
    const newJunctions = cloneCurrent ? knots.map(k => ({
      start_ms: k.startTime * 1000,
      end_ms: k.endTime * 1000,
      active: k.active !== false
    })) : [];

    const newVer = {
      id: newId,
      name: trimmed,
      junctions: newJunctions
    };

    let updatedVersions = activeKnot?.versions || [];
    // If empty versions array, backfill the default current one
    if (updatedVersions.length === 0 && activeKnot) {
      updatedVersions = [{
        id: 'v-default',
        name: activeKnot.name || 'Default Knot',
        junctions: activeKnot.junctions || []
      }];
    }

    updatedVersions.push(newVer);

    const updatedKnot = {
      ...activeKnot,
      _id: songKey,
      name: trimmed,
      activeVersionId: newId,
      junctions: newJunctions,
      versions: updatedVersions
    };

    await KnotService.saveKnot(songKey, updatedKnot);

    if (currentTrack.source === 'local') {
      KnotService.syncToBackend(currentTrack, updatedKnot);
    }

    usePlayerStore.getState().setActiveKnot(updatedKnot as any);
    usePlayerStore.getState().setKnots(cloneCurrent ? knots : []);
    setIsNewVerModalVisible(false);
    setNewVerName('');
  };

  const handleRenameVersion = async (versionId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    if (!currentTrack || !activeKnot || !activeKnot.versions) return;
    const songKey = currentTrack.source === 'local'
      ? currentTrack.local_uri
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);
    if (!songKey) return;

    const updatedVersions = activeKnot.versions.map(v => {
      if (v.id === versionId) {
        return { ...v, name: trimmed };
      }
      return v;
    });

    const isCurrentActive = activeKnot.activeVersionId === versionId;

    const updatedKnot = {
      ...activeKnot,
      name: isCurrentActive ? trimmed : activeKnot.name,
      versions: updatedVersions
    };

    await KnotService.saveKnot(songKey, updatedKnot);

    if (currentTrack.source === 'local') {
      KnotService.syncToBackend(currentTrack, updatedKnot);
    }

    usePlayerStore.getState().setActiveKnot(updatedKnot);
    setEditingVerId(null);
    setRenameVerInput('');
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!currentTrack || !activeKnot || !activeKnot.versions) return;
    if (activeKnot.versions.length <= 1) {
      Alert.alert('Cannot Delete', 'You must keep at least one version.');
      return;
    }

    const songKey = currentTrack.source === 'local'
      ? currentTrack.local_uri
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);
    if (!songKey) return;

    const updatedVersions = activeKnot.versions.filter(v => v.id !== versionId);
    let nextActiveId = activeKnot.activeVersionId;
    let nextName = activeKnot.name;
    let nextJunctions = activeKnot.junctions;

    // If deleting current active version, switch to the first remaining version
    if (activeKnot.activeVersionId === versionId) {
      const fallback = updatedVersions[0];
      nextActiveId = fallback.id;
      nextName = fallback.name;
      nextJunctions = fallback.junctions;
    }

    const updatedKnot = {
      ...activeKnot,
      name: nextName,
      activeVersionId: nextActiveId,
      junctions: nextJunctions,
      versions: updatedVersions
    };

    await KnotService.saveKnot(songKey, updatedKnot);

    if (currentTrack.source === 'local') {
      KnotService.syncToBackend(currentTrack, updatedKnot);
    }

    usePlayerStore.getState().setActiveKnot(updatedKnot);
    if (activeKnot.activeVersionId === versionId) {
      usePlayerStore.getState().setKnots(nextJunctions.map(j => ({
        startTime: j.start_ms / 1000,
        endTime: j.end_ms / 1000,
        active: j.active !== false
      })));
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    try {
      await Share.share({
        message: `Check out "${currentTrack.title}" by ${currentTrack.artist} on Knot!`,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const setKnottingStatus = usePlayerStore(state => state.setKnottingStatus);
  const setKnottingProgress = usePlayerStore(state => state.setKnottingProgress);
  const setKnottingPhase = usePlayerStore(state => state.setKnottingPhase);
  const setPendingKnots = usePlayerStore(state => state.setPendingKnots);

  const handleAutoKnotSelect = async (tier: AutoKnotTier) => {
    if (!currentTrack) return;
    setAutoKnotVisible(false);

    try {
      setKnottingStatus('uploading');
      setKnottingProgress(0.1);
      setKnottingPhase('Initializing Auto-Knot pipeline...');

      const { AutoKnotService } = require('@/src/services/AutoKnotService');
      const result = await AutoKnotService.generateKnots(
        currentTrack,
        tier,
        (progress, phase) => {
          setKnottingProgress(progress);
          setKnottingPhase(phase);
        }
      );

      setKnottingStatus('done');
      setPendingKnots(result.knots);
    } catch (error: any) {
      console.error('[Player] AutoKnot error:', error);
      setKnottingStatus('error');
      setKnottingPhase(error.message || 'Auto-knotting failed');
      Alert.alert('Auto-Knot Failed', error.message || 'Failed to auto-knot track. Please try again.');
    }
  };

  const handleAcceptAutoKnots = async () => {
    if (!pendingKnots || !currentTrack) return;

    // Apply pending knots to store
    setKnots(pendingKnots);

    // Save knot to storage
    const songKey = currentTrack.source === 'local'
      ? currentTrack.local_uri
      : (currentTrack.youtube_id || currentTrack.pagalworld_url || currentTrack.pagalfree_url || currentTrack.jiosaavn_token);

    if (songKey) {
      const junctions = pendingKnots.map(k => ({
        start_ms: k.startTime * 1000,
        end_ms: k.endTime * 1000,
        active: true
      }));

      const activeVerId = activeKnot?.activeVersionId || 'v-default';
      const activeVerName = activeKnot?.versions?.find(v => v.id === activeVerId)?.name || activeKnot?.name || 'Auto-Knot Version';

      let updatedVersions = activeKnot?.versions || [{
        id: 'v-default',
        name: activeVerName,
        junctions
      }];

      let found = false;
      updatedVersions = updatedVersions.map(v => {
        if (v.id === activeVerId) {
          found = true;
          return { ...v, junctions };
        }
        return v;
      });

      if (!found) {
        updatedVersions.push({
          id: activeVerId,
          name: activeVerName,
          junctions
        });
      }

      const knotData = {
        _id: songKey,
        name: activeVerName,
        junctions: junctions,
        knotted_duration_ms: 0,
        original_duration_ms: currentTrack.duration_ms,
        title: currentTrack.title,
        artist: currentTrack.artist,
        activeVersionId: activeVerId,
        versions: updatedVersions
      };

      await KnotService.saveKnot(songKey, knotData);
      usePlayerStore.getState().setActiveKnot(knotData);
    }

    setPendingKnots(null);
    setKnottingStatus('idle');
  };

  const handleDiscardAutoKnots = () => {
    setPendingKnots(null);
    setKnottingStatus('idle');
  };

  const handleSeek = async (value: number) => {
    // Jump seek directly without fading audio down/up to avoid mute drop!
    await AudioService.seekToSmoothly(value);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const repeatMode = usePlayerStore(state => state.repeatMode);
  const shuffle = usePlayerStore(state => state.shuffle);
  const cyclePlaybackMode = usePlayerStore(state => state.cyclePlaybackMode);
  const nextTrack = usePlayerStore(state => state.nextTrack);
  const prevTrack = usePlayerStore(state => state.prevTrack);

  const handleNext = async () => {
    nextTrack();
    const next = usePlayerStore.getState().currentTrack;
    if (next) {
      await AudioService.playQueueTrack(next);
    }
  };

  const handlePrev = async () => {
    prevTrack();
    const prev = usePlayerStore.getState().currentTrack;
    if (prev) {
      await AudioService.playQueueTrack(prev);
    }
  };

  const handleDownload = async () => {
    if (!currentTrack) return;

    if (currentTrack.source === 'local') {
      Alert.alert('Local File', 'This file is already on your device.');
      return;
    }

    if (isDownloaded) {
      Alert.alert('Downloaded', 'This track is already saved to your local downloads.');
      return;
    }

    try {
      await DownloadService.downloadTrack(currentTrack);
      setIsDownloaded(true);
      Alert.alert('Success', `"${currentTrack.title}" saved for offline playback!`);
    } catch (error: any) {
      Alert.alert('Download Failed', error.message || 'Could not download track');
    }
  };

  // Add a knot junction at current playback position
  const handleAddKnot = () => {
    if (duration <= 0) return;
    const defaultLen = Math.min(10, duration - position); // 10s default length or remaining duration
    if (defaultLen <= 0) return;

    const newKnot: Knot = {
      startTime: position,
      endTime: position + defaultLen,
      active: true,
    };

    setKnots(prev => [...prev, newKnot]);
  };

  // Delete a specific knot
  const handleDeleteKnot = (index: number) => {
    setKnots(prev => prev.filter((_, i) => i !== index));
  };

  // Toggle knot active state
  const handleToggleKnot = (index: number) => {
    setKnots(prev => prev.map((k, i) => i === index ? { ...k, active: !k.active } : k));
  };

  // Set A/B points
  const handleSetA = () => {
    setPendingA(position);
  };

  const handleSetB = () => {
    if (pendingA === null) return;
    const start = Math.min(pendingA, position);
    const end = Math.max(pendingA, position);
    if (end - start < 0.5) return; // Min 0.5s knot

    const newKnot: Knot = {
      startTime: start,
      endTime: end,
      active: true,
    };

    setKnots(prev => [...prev, newKnot]);
    setPendingA(null);
  };

  const handleClearAB = () => {
    setPendingA(null);
  };

  if (!currentTrack) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <ChevronDown size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.textSecondary }}>
            No track playing
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Top Bar */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <ChevronDown size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerKicker}>PLAYING FROM SEARCH</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{currentTrack.title}</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/queue')}>
          <ListMusic size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Main Container - Adjusted spacing so controls fit without clipping */}
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Artwork - Reduced size to pull all controls down into view */}
        <View style={s.artContainer}>
          <Artwork
            uri={currentTrack.thumbnail}
            thumbnail={currentTrack.thumbnail}
            alt={currentTrack.title}
            style={[s.art, { width: ART_SIZE, height: ART_SIZE }]}
          />
        </View>

        {/* Live Lyrics Preview Card */}
        <TouchableOpacity
          style={s.lyricsPreviewCard}
          activeOpacity={0.9}
          onPress={() => router.push('/lyrics')}
        >
          <View style={s.lyricsHeaderRow}>
            <View style={s.lyricsHeaderLeft}>
              <View style={s.lyricsLiveDot} />
              <Text style={s.lyricsHeaderTitle}>SYNCED LYRICS</Text>
            </View>
            <Text style={s.lyricsHeaderTapHint}>Tap for full screen ›</Text>
          </View>
          <View style={s.lyricsTeleprompterWrap}>
            {getDisplayLines().map((line, idx) => {
              const isCenter = idx === 2;
              const isNear = idx === 1 || idx === 3;

              return (
                <Animated.View
                  key={idx}
                  style={[
                    s.lyricsLineBox,
                    {
                      transform: [
                        {
                          translateY: animatedActiveIdx.interpolate({
                            inputRange: [-1, 0, 1, 100],
                            outputRange: [0, 0, -2, -200], // Subtle smooth fluid alignment
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.lyricsLineText,
                      isCenter && s.lyricsLineTextActive,
                      isNear && s.lyricsLineTextNear,
                      !isCenter && !isNear && s.lyricsLineTextFar,
                    ]}
                    numberOfLines={1}
                  >
                    {line.text}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        </TouchableOpacity>

        {/* Title & Artist Row */}
        <View style={s.titleRow}>
          <View style={s.titleWrap}>
            <Text style={s.songTitle} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={s.artistName} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <View style={s.titleActions}>
            <TouchableOpacity onPress={handleDownload} style={s.heartBtn}>
              {activeProgress !== undefined && activeProgress > 0 && activeProgress < 1 ? (
                <DownloadIcon progress={activeProgress} color={colors.textSecondary} size={22} />
              ) : isDownloaded ? (
                <DownloadIcon progress={1.0} color="#FF6D00" size={22} />
              ) : (
                <DownloadIcon progress={0} color={colors.textSecondary} size={22} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleLike} style={s.heartBtn}>
              <Heart
                size={22}
                color={liked ? colors.primary : colors.textSecondary}
                fill={liked ? colors.primary : 'none'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Rope Seekbar (Multiknot support) */}
        <View style={s.ropeSeekbarWrapper}>
          <RopeSeekbar
            duration={duration}
            position={position}
            knots={pendingKnots || knots}
            pendingA={pendingA}
            onSeek={handleSeek}
            onKnotChange={setKnots}
          />
        </View>

        {/* Knot Control Bar (Scissors, A/B markers, Auto-Knot) */}
        <View style={s.knotBar}>
          {pendingKnots ? (
            /* Auto-Knot Preview Mode Actions */
            <View style={s.autoKnotPreviewBar}>
              <Text style={s.autoKnotPreviewText}>Auto-Knot Preview ({pendingKnots.length} knots)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.discardBtn} onPress={handleDiscardAutoKnots}>
                  <X size={16} color={colors.text} />
                  <Text style={s.discardBtnText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.acceptBtn} onPress={handleAcceptAutoKnots}>
                  <Check size={16} color={colors.onPrimary} />
                  <Text style={s.acceptBtnText}>Apply Knots</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Standard Manual & AI Knotting Controls */
            <>
              <TouchableOpacity style={s.knotActionBtn} onPress={handleAddKnot}>
                <Scissors size={16} color={colors.primary} />
                <Text style={s.knotActionText}>+ Quick Knot</Text>
              </TouchableOpacity>

              {/* A/B Knot Creator */}
              {pendingA === null ? (
                <TouchableOpacity style={s.knotActionBtn} onPress={handleSetA}>
                  <Text style={s.abText}>Set A</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={[s.knotActionBtn, s.activeAbBtn]} onPress={handleSetB}>
                    <Text style={s.abTextActive}>Set B (End)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.knotActionBtn} onPress={handleClearAB}>
                    <X size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Auto-Knot AI Button */}
              <TouchableOpacity
                style={[s.knotActionBtn, s.autoKnotBtn]}
                onPress={() => setAutoKnotVisible(true)}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  style={s.autoKnotGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Wand2 size={14} color={colors.onPrimary} />
                  <Text style={s.autoKnotText}>Auto-Knot</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Manage Knot Versions Button */}
              <TouchableOpacity
                style={s.knotActionBtn}
                onPress={() => setIsKnotManagerVisible(true)}
              >
                <Sliders size={15} color={colors.textSecondary} />
                <Text style={[s.knotActionText, { color: colors.textSecondary }]}>
                  {activeKnot?.versions && activeKnot.versions.length > 1
                    ? `Vers (${activeKnot.versions.length})`
                    : 'Versions'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Active Knots List (Interactive pills to toggle/delete) */}
        {knots.length > 0 && !pendingKnots && (
          <View style={s.activeKnotsContainer}>
            <View style={s.knotsHeaderRow}>
              <Text style={s.activeKnotsTitle}>ACTIVE KNOTS ({knots.length})</Text>
              <TouchableOpacity onPress={() => setKnots([])}>
                <Text style={s.clearAllKnotsText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.knotsPillScroll}>
              {knots.map((knot, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[s.knotPill, !knot.active && s.inactiveKnotPill]}
                  onPress={() => handleToggleKnot(idx)}
                >
                  <View style={[s.knotColorDot, !knot.active && s.inactiveColorDot]} />
                  <Text style={[s.knotPillText, !knot.active && s.inactivePillText]}>
                    {formatTime(knot.startTime)} - {formatTime(knot.endTime)}
                  </Text>
                  <TouchableOpacity onPress={() => handleDeleteKnot(idx)} style={s.deleteKnotBtn}>
                    <Trash2 size={12} color={knot.active ? colors.primary : colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Primary Playback Controls (Previous, Play/Pause, Next) */}
        <View style={s.controlsRow}>
          <TouchableOpacity onPress={cyclePlaybackMode} style={s.modeBtn}>
            {repeatMode === 'track' ? (
              <Repeat size={20} color={colors.primary} />
            ) : repeatMode === 'list' ? (
              <Repeat size={20} color={colors.primary} />
            ) : shuffle ? (
              <Shuffle size={20} color={colors.primary} />
            ) : (
              <Repeat size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={handlePrev}>
            <SkipBack size={28} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={s.playBtn} onPress={() => AudioService.togglePlayPause()}>
            {isPlaying ? (
              <Pause size={32} color={colors.onPrimary} fill={colors.onPrimary} />
            ) : (
              <Play size={32} color={colors.onPrimary} fill={colors.onPrimary} style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={handleNext}>
            <SkipForward size={28} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={s.modeBtn}>
            <Share2 size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Bottom Utility Bar (Auto-Knot status indicator if running) */}
        {knottingStatus === 'processing' || knottingStatus === 'uploading' ? (
          <View style={s.aiStatusCard}>
            <View style={s.aiStatusHeader}>
              <Wand2 size={16} color={colors.primary} />
              <Text style={s.aiStatusTitle}>{knottingPhase || 'Processing Auto-Knot...'}</Text>
            </View>
            <View style={s.progressBarTrack}>
              <View style={[s.progressBarFill, { width: `${Math.min(100, Math.max(5, knottingProgress * 100))}%` }]} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Auto-Knot Selector Sheet */}
      <AutoKnotSheet
        visible={autoKnotVisible}
        onClose={() => setAutoKnotVisible(false)}
        onSelectTier={handleAutoKnotSelect}
      />

      {/* Knot Version Manager Modal Sheet */}
      {isKnotManagerVisible && (
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsKnotManagerVisible(false)}
        >
          <View style={s.versionSheet} onStartShouldSetResponder={() => true}>
            <View style={s.versionSheetHeader}>
              <Text style={s.versionSheetTitle}>Knot Versions</Text>
              <TouchableOpacity style={s.closeSheetBtn} onPress={() => setIsKnotManagerVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.versionSheetSub}>
              Create, rename, or switch between different knot arrangements for this song.
            </Text>

            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {(activeKnot?.versions || [
                {
                  id: 'v-default',
                  name: activeKnot?.name || 'Default Knot',
                  junctions: activeKnot?.junctions || []
                }
              ]).map((ver) => {
                const isActive = (activeKnot?.activeVersionId || 'v-default') === ver.id;
                const isEditing = editingVerId === ver.id;

                return (
                  <View key={ver.id} style={[s.versionRow, isActive && s.activeVersionRow]}>
                    <TouchableOpacity
                      style={s.versionInfoBtn}
                      onPress={() => {
                        handleSwitchVersion(ver.id);
                        setIsKnotManagerVisible(false);
                      }}
                    >
                      <View style={[s.versionCheckDot, isActive && s.activeCheckDot]}>
                        {isActive && <Check size={12} color={colors.onPrimary} />}
                      </View>

                      {isEditing ? (
                        <TextInput
                          style={s.renameInput}
                          value={renameVerInput}
                          onChangeText={setRenameVerInput}
                          autoFocus
                          onBlur={() => handleRenameVersion(ver.id, renameVerInput)}
                          onSubmitEditing={() => handleRenameVersion(ver.id, renameVerInput)}
                        />
                      ) : (
                        <View>
                          <Text style={[s.versionNameText, isActive && s.activeVersionNameText]}>
                            {ver.name}
                          </Text>
                          <Text style={s.versionMetaText}>
                            {ver.junctions.length} junction{ver.junctions.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={s.versionActionsRow}>
                      {!isEditing ? (
                        <TouchableOpacity
                          style={s.versionActionIcon}
                          onPress={() => {
                            setEditingVerId(ver.id);
                            setRenameVerInput(ver.name);
                          }}
                        >
                          <Edit2 size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={s.versionActionIcon}
                          onPress={() => handleRenameVersion(ver.id, renameVerInput)}
                        >
                          <Check size={16} color={colors.primary} />
                        </TouchableOpacity>
                      )}

                      {(activeKnot?.versions || []).length > 1 && (
                        <TouchableOpacity
                          style={s.versionActionIcon}
                          onPress={() => handleDeleteVersion(ver.id)}
                        >
                          <Trash2 size={16} color={colors.error || '#FF3B30'} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.createNewVerBtn}
              onPress={() => {
                setIsKnotManagerVisible(false);
                setIsNewVerModalVisible(true);
              }}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={s.createNewVerBtnText}>Create New Version</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Create New Version Modal Prompt */}
      {isNewVerModalVisible && (
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsNewVerModalVisible(false)}
        >
          <View style={s.newVerPromptCard} onStartShouldSetResponder={() => true}>
            <Text style={s.promptTitle}>Create Knot Version</Text>
            <Text style={s.promptSub}>Give your new knot arrangement a descriptive name.</Text>

            <TextInput
              style={s.promptInput}
              placeholder="e.g. Chorus Only, Hook Remix"
              placeholderTextColor={colors.textSecondary}
              value={newVerName}
              onChangeText={setNewVerName}
              autoFocus
            />

            <View style={s.promptActionGrid}>
              <TouchableOpacity
                style={s.promptBtnSecondary}
                onPress={() => handleCreateVersion(newVerName || 'New Version', false)}
              >
                <Text style={s.promptBtnSecondaryText}>Start Blank</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.promptBtnPrimary}
                onPress={() => handleCreateVersion(newVerName || 'New Version', true)}
              >
                <Text style={s.promptBtnPrimaryText}>Duplicate Current</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: { padding: spacing.xs },
  headerTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: spacing.sm },
  headerKicker: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  artContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  art: { borderRadius: borderRadius.xxl, backgroundColor: colors.surfaceContainerLow },
  lyricsPreviewCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },
  lyricsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  lyricsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lyricsLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  lyricsHeaderTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 1,
  },
  lyricsHeaderTapHint: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  lyricsTeleprompterWrap: {
    height: 70, // Exactly accommodates 3 teleprompter lines smoothly
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lyricsLineBox: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  lyricsLineText: {
    fontFamily: typography.fontFamily.semibold,
    textAlign: 'center',
  },
  lyricsLineTextActive: {
    fontSize: typography.size.sm,
    color: colors.text,
    fontFamily: typography.fontFamily.bold,
  },
  lyricsLineTextNear: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    opacity: 0.7,
  },
  lyricsLineTextFar: {
    fontSize: typography.size.xs,
    color: colors.outline,
    opacity: 0.3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: spacing.sm,
  },
  titleWrap: { flex: 1, marginRight: spacing.md },
  songTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xl,
    color: colors.text,
    marginBottom: 2,
  },
  artistName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartBtn: { padding: spacing.xs },
  ropeSeekbarWrapper: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  knotBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: spacing.sm,
  },
  knotActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  activeAbBtn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  knotActionText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  abText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  abTextActive: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.onPrimaryContainer,
  },
  autoKnotBtn: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    borderWidth: 0,
  },
  autoKnotGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  autoKnotText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.onPrimary,
  },
  autoKnotPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  autoKnotPreviewText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  acceptBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.onPrimary,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  discardBtnText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  activeKnotsContainer: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  knotsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  activeKnotsTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  clearAllKnotsText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 10,
    color: colors.primary,
  },
  knotsPillScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  knotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  inactiveKnotPill: {
    borderColor: colors.surfaceContainerHigh,
    backgroundColor: colors.background,
  },
  knotColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  inactiveColorDot: {
    backgroundColor: colors.textSecondary,
  },
  knotPillText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 11,
    color: colors.text,
  },
  inactivePillText: {
    color: colors.textSecondary,
  },
  deleteKnotBtn: {
    padding: 2,
    marginLeft: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  modeBtn: { padding: spacing.xs },
  skipBtn: { padding: spacing.sm },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  aiStatusCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  aiStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  aiStatusTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  versionSheet: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  versionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  versionSheetTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  closeSheetBtn: { padding: spacing.xs },
  versionSheetSub: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  activeVersionRow: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  versionInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  versionCheckDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCheckDot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  versionNameText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    color: colors.text,
  },
  activeVersionNameText: {
    color: colors.onPrimaryContainer,
  },
  versionMetaText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  renameInput: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
    minWidth: 120,
  },
  versionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  versionActionIcon: {
    padding: spacing.xs,
  },
  createNewVerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainerHigh,
    marginTop: spacing.md,
  },
  createNewVerBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  newVerPromptCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  promptTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    color: colors.text,
    marginBottom: 4,
  },
  promptSub: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  promptInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.sm,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  promptActionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  promptBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  promptBtnSecondaryText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.text,
  },
  promptBtnPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  promptBtnPrimaryText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs,
    color: colors.onPrimary,
  },
});

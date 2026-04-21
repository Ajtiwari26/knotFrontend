import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, ListMusic, Share2, Scissors, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { usePlayerStore } from '@/src/store/playerStore';
import { AudioService } from '@/src/services/AudioService';
import { KnotService } from '@/src/services/KnotService';
import TrackPlayer, { useProgress, State, usePlaybackState, useActiveTrack } from 'react-native-track-player';
import { RopeSeekbar, Knot } from '@/src/components/RopeSeekbar';

const { width } = Dimensions.get('window');
const ART_SIZE = width - 110;

export default function PlayerScreen() {
  const router = useRouter();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const activeKnot = usePlayerStore(state => state.activeKnot);
  const setIsPlayingStore = usePlayerStore(state => state.setIsPlaying);
  
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const isPlaying = playbackState?.state === State.Playing;

  // Sync store with native player if store is empty but player is active
  useEffect(() => {
    if (!currentTrack && activeTrack) {
      const recoveredTrack = {
        source: activeTrack.url?.startsWith('http') ? 'youtube' : 'local',
        title: activeTrack.title || 'Unknown',
        artist: activeTrack.artist || 'Unknown',
        thumbnail: typeof activeTrack.artwork === 'string' ? activeTrack.artwork : '',
        duration_ms: (activeTrack.duration || 0) * 1000,
        local_uri: activeTrack.url?.startsWith('file://') ? activeTrack.url : undefined,
        youtube_id: !activeTrack.url?.startsWith('file://') ? 'recovered' : undefined,
      };
      // @ts-ignore - internal state reconstruction
      usePlayerStore.getState().setCurrentTrack(recoveredTrack);
    }
  }, [currentTrack, activeTrack]);
  
  const { position, duration } = useProgress(250);
  const [liked, setLiked] = useState(false);

  // Multi-knot state
  const [knots, setKnots] = useState<Knot[]>([]);
  const [pendingA, setPendingA] = useState<number | null>(null);
  const [pendingB, setPendingB] = useState<number | null>(null);

  useEffect(() => {
    setIsPlayingStore(isPlaying);
  }, [isPlaying]);

  // Auto-load saved knots when track changes
  useEffect(() => {
    const loadSaved = async () => {
      if (!currentTrack) return;
      const songKey = currentTrack.source === 'local' ? currentTrack.local_uri : currentTrack.youtube_id;
      if (songKey) {
        const savedKnot = await KnotService.getSavedKnot(songKey);
        if (savedKnot) {
          setKnots(savedKnot.junctions.map(j => ({
            startTime: j.start_ms / 1000,
            endTime: j.end_ms / 1000,
            active: true
          })));
        } else {
          setKnots([]);
        }
      }
    };
    loadSaved();
  }, [currentTrack]);

  // Auto-save knots when they change
  useEffect(() => {
    const save = async () => {
      if (!currentTrack || knots.length === 0) return;
      const songKey = currentTrack.source === 'local' ? currentTrack.local_uri : currentTrack.youtube_id;
      if (songKey) {
        const knotData = {
          _id: songKey,
          name: 'Saved Loop',
          junctions: knots.map(k => ({ start_ms: k.startTime * 1000, end_ms: k.endTime * 1000 })),
          knotted_duration_ms: 0,
          original_duration_ms: currentTrack.duration_ms,
        };
        await KnotService.saveKnot(songKey, knotData);
      }
    };
    save();
  }, [knots, currentTrack]);

  const handlePlayPause = async () => {
    await AudioService.togglePlayPause();
  };

  const handleSeek = (pos: number) => {
    AudioService.seekTo(pos);
  };

  const handleMarkA = () => setPendingA(position);
  const handleMarkB = () => setPendingB(position);

  const handleTieKnot = () => {
    if (pendingA !== null && pendingB !== null) {
      const newKnot: Knot = {
        startTime: Math.min(pendingA, pendingB),
        endTime: Math.max(pendingA, pendingB),
        active: true,
      };
      setKnots(prev => [...prev, newKnot]);
      setPendingA(null);
      setPendingB(null);
    }
  };

  const handleKnotToggle = (index: number) => {
    setKnots(prev => prev.map((k, i) => i === index ? { ...k, active: !k.active } : k));
  };

  const handleKnotMerge = (idx1: number, idx2: number) => {
    setKnots(prev => {
      const k1 = prev[idx1];
      const k2 = prev[idx2];
      if (!k1 || !k2) return prev;

      const newKnot: Knot = {
        startTime: Math.min(k1.startTime, k2.startTime),
        endTime: Math.max(k1.endTime, k2.endTime),
        active: true,
        // Keep track of the original sub-knots so we can un-merge later
        subKnots: [...(k1.subKnots || [k1]), ...(k2.subKnots || [k2])],
      };

      // Filter out both old knots and add the merged one
      const filtered = prev.filter((_, i) => i !== idx1 && i !== idx2);
      return [...filtered, newKnot];
    });
  };

  const handleKnotSplit = (index: number) => {
    setKnots(prev => {
      const knot = prev[index];
      if (!knot || !knot.subKnots || knot.subKnots.length === 0) return prev;
      
      // Remove the merged knot and add its constituent sub-knots back
      const filtered = prev.filter((_, i) => i !== index);
      return [...filtered, ...knot.subKnots];
    });
  };

  const handleClearKnots = () => {
    setKnots([]);
    setPendingA(null);
    setPendingB(null);
  };

  const handleUndoLastKnot = () => {
    setKnots(prev => prev.slice(0, -1));
  };

  // Audio skip logic: when playback enters any ACTIVE knot, jump past it
  useEffect(() => {
    if (knots.length === 0) return;
    for (const knot of knots) {
      // Use a smaller lookahead (0.2s) for tighter "remix" feel
      if (knot.active && position >= knot.startTime && position < knot.endTime - 0.2) {
        AudioService.seekTo(knot.endTime);
        break;
      }
    }
  }, [position, knots]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const getKnottedDuration = () => {
    if (!currentTrack) return 0;
    let knotTime = 0;
    for (const k of knots) {
      if (k.active) knotTime += (k.endTime - k.startTime);
    }
    const total = duration > 0 ? duration : (currentTrack.duration_ms / 1000) || 0;
    return Math.max(0, total - knotTime);
  };

  const knottedDuration = getKnottedDuration();

  if (!currentTrack) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
            <ChevronDown size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', color: colors.text, marginTop: 40 }}>No track playing</Text>
      </SafeAreaView>
    );
  }

  const hasKnots = knots.length > 0;
  const hasPending = pendingA !== null || pendingB !== null;
  const canTie = pendingA !== null && pendingB !== null;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <ChevronDown size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLabel}>PLAYING FROM</Text>
          <Text style={s.headerSource}>Your Library</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/queue')} style={s.headerBtn}>
          <ListMusic size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Album Art */}
      <View style={s.artWrap}>
        <Image source={{ uri: currentTrack.thumbnail || 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg' }} style={s.art} />
      </View>

      {/* Track Info */}
      <View style={s.info}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{currentTrack.title || 'Unknown Track'}</Text>
            <Text style={s.artist} numberOfLines={1}>{currentTrack.artist || 'Unknown Artist'}</Text>
          </View>
          <TouchableOpacity onPress={() => setLiked(!liked)}>
            <Heart size={24} color={colors.primary} fill={liked ? colors.primary : 'transparent'} />
          </TouchableOpacity>
        </View>

        {/* Knot Badge */}
        {activeKnot ? (
          <TouchableOpacity style={s.knotBadge} onPress={() => router.push('/knot-editor')}>
            <View style={s.knotDot} />
            <Text style={s.knotText}>{activeKnot.name} Active</Text>
            <Text style={s.knotEdit}>EDIT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.knotBadge, { backgroundColor: colors.surfaceContainerLowest }]} onPress={() => router.push('/knot-editor')}>
            <Text style={[s.knotText, { color: colors.textSecondary }]}>Create a Knot</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rope Seekbar */}
      <RopeSeekbar 
        duration={duration > 0 ? duration : (currentTrack.duration_ms / 1000) || 0} 
        position={position} 
        knots={knots}
        pendingA={pendingA}
        pendingB={pendingB}
        onSeek={handleSeek}
        onKnotToggle={handleKnotToggle} 
        onKnotMerge={handleKnotMerge}
        onKnotDoubleTap={handleKnotSplit}
      />
      <View style={s.timeRow}>
        <Text style={s.time}>{formatTime(position * 1000)}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {knottedDuration < duration - 1 && (
            <Text style={[s.time, { textDecorationLine: 'line-through', opacity: 0.5 }]}>
              {formatTime(duration * 1000)}
            </Text>
          )}
          <Text style={[s.time, { color: knottedDuration < duration - 1 ? colors.primary : colors.textSecondary, fontWeight: 'bold' }]}>
            {formatTime(knottedDuration * 1000)}
          </Text>
        </View>
      </View>

      {/* Knot Controls */}
      <View style={s.knotActionRow}>
        <TouchableOpacity 
          style={[s.knotActionBtn, pendingA !== null && s.knotActionBtnActive]} 
          onPress={handleMarkA}
        >
          <Text style={[s.knotActionText, pendingA !== null && s.knotActionTextActive]}>Mark A</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.knotActionBtn, pendingB !== null && s.knotActionBtnActive]} 
          onPress={handleMarkB}
        >
          <Text style={[s.knotActionText, pendingB !== null && s.knotActionTextActive]}>Mark B</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.knotTieBtn, canTie && s.knotTieBtnReady]} 
          onPress={handleTieKnot}
          disabled={!canTie}
        >
          <Scissors size={14} color={canTie ? '#FFF' : colors.textSecondary} />
          <Text style={[s.knotTieText, canTie && s.knotTieTextReady]}>Knot</Text>
        </TouchableOpacity>
        {hasKnots ? (
          <TouchableOpacity style={s.knotUndoBtn} onPress={handleUndoLastKnot}>
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Knot count indicator */}
      {hasKnots ? (
        <View style={s.knotCountRow}>
          <Text style={s.knotCountText}>{knots.length} knot{knots.length > 1 ? 's' : ''} tied</Text>
          <TouchableOpacity onPress={handleClearKnots}>
            <Text style={s.knotClearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Transport Controls */}
      <View style={s.controls}>
        <TouchableOpacity style={s.sideControl}><Shuffle size={20} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={() => TrackPlayer.skipToPrevious()}><SkipBack size={28} color={colors.text} fill={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={s.playBtn} onPress={handlePlayPause}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.playGradient}>
            {isPlaying ? <Pause size={32} color={colors.onPrimary} fill={colors.onPrimary} /> : <Play size={32} color={colors.onPrimary} fill={colors.onPrimary} />}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={() => TrackPlayer.skipToNext()}><SkipForward size={28} color={colors.text} fill={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={s.sideControl}><Repeat size={20} color={colors.textSecondary} /></TouchableOpacity>
      </View>

      {/* Bottom Actions */}
      <View style={s.bottomActions}>
        <TouchableOpacity><Share2 size={20} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/queue')}><ListMusic size={20} color={colors.textSecondary} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1.5 },
  headerSource: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text, marginTop: 2 },
  artWrap: { alignItems: 'center', marginBottom: spacing.xl },
  art: { width: ART_SIZE, height: ART_SIZE, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLow },
  info: { marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, letterSpacing: -0.5 },
  artist: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary, marginTop: 4 },
  knotBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12, alignSelf: 'flex-start' },
  knotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContainer, marginRight: 8 },
  knotText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.text, flex: 1 },
  knotEdit: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.primary, letterSpacing: 1, marginLeft: 8 },
  progressWrap: { marginBottom: spacing.xxl },
  progressBg: { height: 4, backgroundColor: colors.surfaceContainerHigh, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 4, zIndex: 20 },
  time: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxxl, zIndex: 20 },
  sideControl: { padding: 12 },
  skipBtn: { padding: 16 },
  playBtn: { marginHorizontal: 12 },
  playGradient: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.hero },

  // Knot controls
  knotActionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4, zIndex: 20 },
  knotActionBtn: { 
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, 
    backgroundColor: colors.surfaceContainerHigh, borderWidth: 1.5, borderColor: 'transparent' 
  },
  knotActionBtnActive: { borderColor: '#FF6D00', backgroundColor: 'rgba(255,109,0,0.15)' },
  knotActionText: { fontFamily: typography.fontFamily.semibold, fontSize: 12, color: colors.textSecondary },
  knotActionTextActive: { color: '#FF6D00' },
  knotTieBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, 
    backgroundColor: colors.surfaceContainerHighest 
  },
  knotTieBtnReady: { backgroundColor: '#E65100' },
  knotTieText: { fontFamily: typography.fontFamily.bold, fontSize: 12, color: colors.textSecondary },
  knotTieTextReady: { color: '#FFF' },
  knotUndoBtn: { 
    width: 32, height: 32, borderRadius: 16, 
    backgroundColor: colors.surfaceContainerHigh, 
    justifyContent: 'center', alignItems: 'center' 
  },
  knotCountRow: { 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, 
    marginBottom: 16 
  },
  knotCountText: { fontFamily: typography.fontFamily.body, fontSize: 11, color: colors.textSecondary },
  knotClearText: { fontFamily: typography.fontFamily.semibold, fontSize: 11, color: '#FF6D00' },
});

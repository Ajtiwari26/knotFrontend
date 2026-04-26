import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Share } from 'react-native';
import { Artwork } from '@/src/components/Artwork';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, ListMusic, Share2, Scissors, X, Wand2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { usePlayerStore } from '@/src/store/playerStore';
import { AudioService } from '@/src/services/AudioService';
import { KnotService } from '@/src/services/KnotService';
import TrackPlayer, { useProgress, State, usePlaybackState, useActiveTrack } from 'react-native-track-player';
import { RopeSeekbar, Knot } from '@/src/components/RopeSeekbar';
import { useLibraryStore } from '@/src/store/libraryStore';
import { AutoKnotSheet } from '@/src/components/AutoKnotSheet';
import { AutoKnotTier } from '@/src/services/AutoKnotService';

const { width } = Dimensions.get('window');
const ART_SIZE = width - 150; // More aggressive reduction for better vertical fit

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

  const { position, duration } = useProgress(250);

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



  // Auto-save knots when they change (user edits them)
  useEffect(() => {
    const save = async () => {
      if (!currentTrack) return;
      if (knots.length === 0) return;
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

        // Sync to backend for cross-install persistence
        if (currentTrack.source === 'local') {
          KnotService.syncToBackend(currentTrack, knotData);
        }
      }
    };
    save();
  }, [knots, currentTrack]);

  const handlePlayPause = async () => {
    await AudioService.togglePlayPause();
  };

  const handleNext = async () => {
    usePlayerStore.getState().nextTrack();
    const newTrack = usePlayerStore.getState().currentTrack;
    if (newTrack) {
      await AudioService.playQueueTrack(newTrack);
    }
  };

  const handlePrev = async () => {
    usePlayerStore.getState().prevTrack();
    const newTrack = usePlayerStore.getState().currentTrack;
    if (newTrack) {
      await AudioService.playQueueTrack(newTrack);
    }
  };

  const toggleShuffle = () => {
    const s = usePlayerStore.getState();
    s.setShuffle(!s.shuffle);
  };

  const toggleRepeat = () => {
    const s = usePlayerStore.getState();
    const modes: ('off' | 'track' | 'list')[] = ['off', 'track', 'list'];
    const nextMode = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
    s.setRepeatMode(nextMode);
  };

  const shareTrack = async () => {
    if (!currentTrack) return;
    try {
      await Share.share({
        message: `Listen to ${currentTrack.title} by ${currentTrack.artist} on Knot!`,
      });
    } catch (error) {
      console.error('Error sharing track:', error);
    }
  };

  const shuffle = usePlayerStore(s => s.shuffle);
  const repeatMode = usePlayerStore(s => s.repeatMode);

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

  const handleKnotDelete = (index: number) => {
    setKnots(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearKnots = () => {
    setKnots([]);
    setPendingA(null);
    setPendingB(null);
  };

  const handleUndoLastKnot = () => {
    // Revert to LIFO (Last-In-First-Out) creation order as clarified by the user
    setKnots(prev => prev.slice(0, -1));
  };

  // Audio skip logic has been moved to GlobalPlayerController for cross-screen support

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
        <Artwork 
          uri={currentTrack.thumbnail || (typeof activeTrack?.artwork === 'string' ? activeTrack.artwork : undefined)} 
          thumbnail={currentTrack.thumbnail || (typeof activeTrack?.artwork === 'string' ? activeTrack.artwork : undefined)} 
          style={s.art} 
          onImageError={() => {
            if (activeTrack) {
              AudioService.setFallbackArtwork();
            }
          }}
        />
      </View>

      {/* Track Info */}
      <View style={s.info}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{currentTrack.title || 'Unknown Track'}</Text>
            <Text style={s.artist} numberOfLines={1}>{currentTrack.artist || 'Unknown Artist'}</Text>
          </View>
          <TouchableOpacity onPress={toggleLike}>
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
        onKnotDelete={handleKnotDelete}
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

      {/* Background Knotting Status Label */}
      {knottingStatus !== 'idle' && (
        <View style={s.knottingStatusRow}>
          {knottingStatus === 'done' ? (
            <TouchableOpacity 
              style={s.applyKnotsBtn} 
              onPress={() => {
                if (pendingKnots) setKnots(pendingKnots);
                usePlayerStore.getState().setKnottingStatus('idle');
                usePlayerStore.getState().setPendingKnots(null);
              }}
            >
              <Wand2 size={14} color="#FFF" />
              <Text style={s.applyKnotsText}>Apply Auto-Knots</Text>
            </TouchableOpacity>
          ) : knottingStatus === 'error' ? (
            <TouchableOpacity onPress={() => usePlayerStore.getState().setKnottingStatus('idle')}>
              <Text style={[s.statusText, { color: colors.error }]}>⚠️ Analysis Failed. Tap to clear.</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.statusLoadingRow}>
              <View style={s.orangeDot} />
              <Text style={s.statusText}>
                {`${knottingPhase} ${Math.round(knottingProgress)}%`}
              </Text>
              <Text style={[s.statusText, { color: colors.textSecondary, fontSize: 10, textTransform: 'none' }]}>
                (Do not close player)
              </Text>
            </View>
          )}
        </View>
      )}

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
        <TouchableOpacity style={s.sideControl} onPress={toggleShuffle}>
          <Shuffle size={20} color={shuffle ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={handlePrev}>
          <SkipBack size={28} color={colors.text} fill={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.playBtn} onPress={handlePlayPause}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.playGradient}>
            {isPlaying ? <Pause size={32} color={colors.onPrimary} fill={colors.onPrimary} /> : <Play size={32} color={colors.onPrimary} fill={colors.onPrimary} />}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={handleNext}>
          <SkipForward size={28} color={colors.text} fill={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.sideControl} onPress={toggleRepeat}>
          <Repeat size={20} color={repeatMode !== 'off' ? colors.primary : colors.textSecondary} />
          {repeatMode === 'track' && <Text style={{ position: 'absolute', color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>1</Text>}
        </TouchableOpacity>
      </View>

      {/* Bottom Actions */}
      <View style={s.bottomActions}>
        <TouchableOpacity onPress={shareTrack}><Share2 size={20} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setAutoKnotVisible(true)}>
          <View style={s.autoKnotBtn}>
            <Wand2 size={18} color="#FF6D00" />
            <Text style={s.autoKnotLabel}>Auto</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/queue')}><ListMusic size={20} color={colors.textSecondary} /></TouchableOpacity>
      </View>

      {/* Auto-Knot Bottom Sheet */}
      <AutoKnotSheet
        visible={autoKnotVisible}
        onClose={() => setAutoKnotVisible(false)}
        songUri={currentTrack.source === 'local' ? (currentTrack.local_uri || '') : (currentTrack.youtube_id || '')}
        songTitle={currentTrack.title || 'Unknown'}
        durationMs={currentTrack.duration_ms || duration * 1000}
        youtubeId={currentTrack.source === 'youtube' ? currentTrack.youtube_id : undefined}
        onKnotsGenerated={(newKnots, tier) => {
          setKnots(newKnots);
          setAutoKnotVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.md, paddingHorizontal: spacing.xxl },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1.5 },
  headerSource: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text, marginTop: 2 },
  artWrap: { alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.xxl },
  art: { width: ART_SIZE, height: ART_SIZE, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLow },
  info: { marginBottom: spacing.sm, paddingHorizontal: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, letterSpacing: -0.5 },
  artist: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary, marginTop: 4 },
  knotBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
  knotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContainer, marginRight: 8 },
  knotText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.text, flex: 1 },
  knotEdit: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.primary, letterSpacing: 1, marginLeft: 8 },
  progressWrap: { marginBottom: spacing.xxl },
  progressBg: { height: 4, backgroundColor: colors.surfaceContainerHigh, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 4, zIndex: 20 },
  time: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, zIndex: 20 },
  sideControl: { padding: 10 },
  skipBtn: { padding: 12 },
  playBtn: { marginHorizontal: 8 },
  playGradient: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.hero, alignItems: 'center', paddingBottom: spacing.md },
  autoKnotBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,109,0,0.1)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,109,0,0.3)' },
  autoKnotLabel: { fontFamily: typography.fontFamily.bold, fontSize: 12, color: '#FF6D00' },

  // Knot controls
  knotActionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 2, zIndex: 20 },
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
    marginBottom: 8
  },
  knotCountText: { fontFamily: typography.fontFamily.body, fontSize: 11, color: colors.textSecondary },
  knotClearText: { fontFamily: typography.fontFamily.semibold, fontSize: 11, color: '#FF6D00' },
  
  // Background Knotting UI

  knottingStatusRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    height: 40,
    justifyContent: 'center',
    zIndex: 30, // Higher than seekbar to ensure clickability
  },
  statusLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FF6D00',
    minWidth: '80%',
    justifyContent: 'center',
  },
  orangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6D00'
  },
  statusText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: '#FF6D00',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  applyKnotsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E65100',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  applyKnotsText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: '#FFF'
  }
});

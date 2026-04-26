import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { AutoKnotService, AutoKnotTier, AutoKnotProgress } from '@/src/services/AutoKnotService';
import { Knot } from '@/src/components/RopeSeekbar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AutoKnotSheetProps {
  visible: boolean;
  onClose: () => void;
  songUri: string;
  songTitle: string;
  durationMs: number;
  youtubeId?: string;
  onKnotsGenerated: (knots: Knot[], tier: AutoKnotTier) => void;
}

/**
 * BatteryProgressBar — Orange battery-shaped loading indicator
 */
function BatteryProgressBar({ percent }: { percent: number }) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percent,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const fillWidth = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={bp.container}>
      {/* Battery body */}
      <View style={bp.body}>
        <Animated.View
          style={[
            bp.fill,
            {
              width: fillWidth,
              backgroundColor:
                percent < 30
                  ? '#FF6D00'
                  : percent < 70
                  ? '#FF9800'
                  : '#4CAF50',
            },
          ]}
        />
        {/* Segment markers */}
        <View style={[bp.segment, { left: '25%' }]} />
        <View style={[bp.segment, { left: '50%' }]} />
        <View style={[bp.segment, { left: '75%' }]} />
      </View>
      {/* Battery cap */}
      <View style={bp.cap} />
    </View>
  );
}

const bp = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  body: {
    width: SCREEN_WIDTH * 0.55,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FF6D00',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,109,0,0.08)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255,109,0,0.2)',
  },
  cap: {
    width: 6,
    height: 14,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: '#FF6D00',
    marginLeft: 2,
  },
});

/**
 * TierCard — Individual tier selection card
 */
function TierCard({
  tier,
  selected,
  onSelect,
  disabled,
}: {
  tier: AutoKnotTier;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const info = AutoKnotService.getTierInfo(tier);
  const isPro = tier === 'pro';

  return (
    <TouchableOpacity
      style={[
        tc.card,
        selected && tc.cardSelected,
        disabled && tc.cardDisabled,
      ]}
      onPress={onSelect}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={tc.header}>
        <Text style={tc.icon}>{info.icon}</Text>
        <Text style={[tc.label, selected && tc.labelSelected]}>{info.label}</Text>
        {isPro && (
          <View style={tc.proBadge}>
            <Text style={tc.proText}>PRO</Text>
          </View>
        )}
      </View>
      <Text style={tc.description}>{info.description}</Text>
      <View style={tc.metaRow}>
        <Text style={tc.meta}>⏱ {info.estimatedTime}</Text>
        <Text style={tc.meta}>🎯 {info.accuracy}</Text>
      </View>
      {!info.requiresInternet && (
        <Text style={tc.offlineBadge}>📶 Works offline</Text>
      )}
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surfaceContainerHigh,
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#FF6D00',
    backgroundColor: 'rgba(255,109,0,0.08)',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    color: colors.text,
    flex: 1,
  },
  labelSelected: {
    color: '#E65100',
  },
  proBadge: {
    backgroundColor: '#FF6D00',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: '#FFF',
    letterSpacing: 1,
  },
  description: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  meta: {
    fontFamily: typography.fontFamily.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  offlineBadge: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 6,
  },
});

/**
 * AutoKnotSheet — Bottom sheet for tier selection + progress
 */
export function AutoKnotSheet({
  visible,
  onClose,
  songUri,
  songTitle,
  durationMs,
  youtubeId,
  onKnotsGenerated,
}: AutoKnotSheetProps) {
  const [selectedTier, setSelectedTier] = useState<AutoKnotTier>('instant');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AutoKnotProgress>({ phase: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState(true);

  // Check cloud availability when sheet opens
  useEffect(() => {
    if (visible) {
      AutoKnotService.isCloudAvailable().then(setCloudAvailable);
      setError(null);
      setProgress({ phase: '', percent: 0 });
      setIsAnalyzing(false);
    }
  }, [visible]);

  const handleAnalyze = async () => {
    setError(null);

    if (selectedTier === 'instant' || selectedTier === 'ultra') {
      setIsAnalyzing(true);
      setProgress({ phase: 'Starting...', percent: 0 });
      try {
        const result = await AutoKnotService.analyze(
          selectedTier,
          songUri,
          songTitle,
          durationMs,
          setProgress,
          youtubeId,
        );
        const knots: Knot[] = result.junctions.map((j) => ({
          startTime: j.start_ms / 1000,
          endTime: j.end_ms / 1000,
          active: true,
        }));
        onKnotsGenerated(knots, selectedTier);
        setTimeout(() => onClose(), 800);
      } catch (err) {
        setError((err as Error).message);
        setIsAnalyzing(false);
      }
    } else {
      // Cloud tiers: Start background analysis and close sheet immediately
      onClose();
      // We don't await this so it runs in background
      AutoKnotService.analyze(
        selectedTier,
        songUri,
        songTitle,
        durationMs,
        undefined,
        youtubeId
      ).catch(err => {
        console.error('[AutoKnotSheet] Background analysis failed:', err);
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handleBar} />

          <Text style={s.sheetTitle}>🪢 Auto-Knot</Text>
          <Text style={s.sheetSubtitle}>
            Choose analysis depth for "{songTitle}"
          </Text>

          {/* Error display */}
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>❌ {error}</Text>
            </View>
          )}

          {/* Tier selection (only when not analyzing) */}
          {!isAnalyzing && (
            <>
              <TierCard
                tier="instant"
                selected={selectedTier === 'instant'}
                onSelect={() => setSelectedTier('instant')}
              />
              <TierCard
                tier="ultra"
                selected={selectedTier === 'ultra'}
                onSelect={() => setSelectedTier('ultra')}
                disabled={!cloudAvailable || !youtubeId}
              />
              <TierCard
                tier="fast"
                selected={selectedTier === 'fast'}
                onSelect={() => setSelectedTier('fast')}
                disabled={!cloudAvailable}
              />
              <TierCard
                tier="pro"
                selected={selectedTier === 'pro'}
                onSelect={() => setSelectedTier('pro')}
                disabled={!cloudAvailable}
              />

              {!cloudAvailable && (
                <Text style={s.offlineNote}>
                  ⚠️ Cloud tiers unavailable — no internet connection
                </Text>
              )}

              <TouchableOpacity
                style={s.analyzeBtn}
                onPress={handleAnalyze}
                activeOpacity={0.8}
              >
                <Text style={s.analyzeBtnText}>
                  {AutoKnotService.getTierInfo(selectedTier).icon} Analyze with{' '}
                  {AutoKnotService.getTierInfo(selectedTier).label}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Progress display */}
          {isAnalyzing && (
            <View style={s.progressSection}>
              <Text style={s.progressPhase}>{progress.phase}</Text>
              <BatteryProgressBar percent={progress.percent} />
              <Text style={s.progressPercent}>{Math.round(progress.percent)}%</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceContainerHigh,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xxl,
    color: colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(179,27,37,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.error,
  },
  offlineNote: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  analyzeBtn: {
    backgroundColor: '#E65100',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  analyzeBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.md,
    color: '#FFF',
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressPhase: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.md,
    color: colors.text,
    marginBottom: 8,
  },
  progressPercent: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    color: '#FF6D00',
    marginTop: 8,
  },
});

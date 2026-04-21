import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Play, SkipForward } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius } from '../theme/spacing';

import { usePlayerStore } from '../store/playerStore';
import { usePlaybackState, State, useActiveTrack } from 'react-native-track-player';

interface PlayerBarProps {
  knotLabel?: string;
}

export const PlayerBar = ({
  knotLabel,
}: PlayerBarProps) => {
  const router = useRouter();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  
  const isPlaying = playbackState.state === State.Playing;
  
  if (!activeTrack) return null;

  const title = activeTrack.title || 'Unknown Track';
  const artist = activeTrack.artist || 'Unknown Artist';
  const thumbnail = typeof activeTrack.artwork === 'string' ? activeTrack.artwork : undefined;

  return (
    <TouchableOpacity
      style={styles.wrapper}
      activeOpacity={0.9}
      onPress={() => router.push('/player')}
    >
      <BlurView intensity={60} tint="light" style={styles.blur}>
        <View style={styles.inner}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artPlaceholder]} />
          )}

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {knotLabel && <Text style={styles.knotLabel}>{knotLabel}</Text>}
            {!knotLabel && artist && (
              <Text style={styles.subtitle} numberOfLines={1}>{artist}</Text>
            )}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn}>
              <Play
                size={22}
                color={colors.text}
                fill={isPlaying ? colors.text : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn}>
              <SkipForward size={22} color={colors.text} fill={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    // Ambient tinted shadow
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  blur: {
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLight,
    borderRadius: borderRadius.xxl,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceContainer,
  },
  artPlaceholder: {},
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xxs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  knotLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  controlBtn: {
    padding: 8,
  },
});

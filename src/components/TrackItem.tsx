import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Play, Heart, MoreHorizontal } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius } from '../theme/spacing';

interface TrackItemProps {
  title: string;
  artist: string;
  thumbnail?: string;
  duration?: string;
  knotBadge?: string;
  showHeart?: boolean;
  showMore?: boolean;
  onPress?: () => void;
  onPlay?: () => void;
}

export const TrackItem = ({
  title,
  artist,
  thumbnail,
  duration,
  knotBadge,
  showHeart = false,
  showMore = false,
  onPress,
  onPlay,
}: TrackItemProps) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.artWrap}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artPlaceholder]}>
            <Play size={16} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {artist}
          {duration ? ` · ${duration}` : ''}
        </Text>
        {knotBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{knotBadge}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {showHeart && (
          <TouchableOpacity style={styles.actionBtn}>
            <Heart size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        {showMore && (
          <TouchableOpacity style={styles.actionBtn}>
            <MoreHorizontal size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: 12,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
  },
  artWrap: {},
  art: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainer,
  },
  artPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.primaryContainer,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  badgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.onPrimaryContainer,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
  },
});

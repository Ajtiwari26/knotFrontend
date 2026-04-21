import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, GripVertical, Trash2 } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';

const QUEUE = [
  { id: 'q1', title: 'Kitne Bechain Hoke', artist: 'Alka Yagnik', thumbnail: 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg', duration: '4:32', active: true },
  { id: 'q2', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration: '3:33' },
  { id: 'q3', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20' },
  { id: 'q4', title: 'Shape of You', artist: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg', duration: '3:54' },
];

export default function QueueScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Up Next</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}><X size={24} color={colors.text} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>NOW PLAYING</Text>
        <View style={s.nowPlaying}>
          <TrackItem title={QUEUE[0].title} artist={QUEUE[0].artist} thumbnail={QUEUE[0].thumbnail} duration={QUEUE[0].duration} knotBadge="No Intro Knot" />
        </View>

        <View style={s.upNextHeader}>
          <Text style={s.sectionLabel}>QUEUE</Text>
          <TouchableOpacity><Text style={s.clearText}>Clear</Text></TouchableOpacity>
        </View>

        {QUEUE.slice(1).map(t => (
          <TrackItem key={t.id} title={t.title} artist={t.artist} thumbnail={t.thumbnail} duration={t.duration} showMore />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  sectionLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md },
  nowPlaying: { marginBottom: spacing.xxl },
  upNextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  clearText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.primary },
});

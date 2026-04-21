import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Download, Clock, Heart, Smartphone } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Chip } from '@/src/components/Chip';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';

const TABS = ['All', 'Knots', 'Playlists', 'Downloads', 'Device'];

const LIBRARY = [
  { id: 'l1', title: 'Kitne Bechain Hoke', artist: 'Alka Yagnik', thumbnail: 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg', duration: '4:32', knotName: 'No Intro Knot' },
  { id: 'l2', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration: '3:33', knotName: 'Clean Intro' },
  { id: 'l3', title: 'Bohemian Rhapsody', artist: 'Queen', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg', duration: '5:55', knotName: 'Guitar Solo' },
  { id: 'l4', title: 'Shape of You', artist: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg', duration: '3:54' },
  { id: 'l5', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20', knotName: 'Drop Only' },
];

const STATS = [
  { label: 'Knots', value: '12', icon: Clock },
  { label: 'Downloads', value: '8', icon: Download },
  { label: 'Liked', value: '34', icon: Heart },
];

export default function LibraryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('All');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Your Library</Text>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {STATS.map(st => (
            <TouchableOpacity key={st.label} style={s.statCard}>
              <st.icon size={20} color={colors.primary} />
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsPad}>
          {TABS.map(t => <Chip key={t} label={t} active={activeTab === t} onPress={() => setActiveTab(t)} />)}
        </ScrollView>

        {/* Library Items */}
        <View style={s.gap} />
        {LIBRARY.map(item => (
          <TrackItem
            key={item.id}
            title={item.title}
            artist={item.artist}
            thumbnail={item.thumbnail}
            duration={item.duration}
            knotBadge={item.knotName}
            showHeart
            showMore
            onPress={() => router.push('/song-detail')}
          />
        ))}

        {/* Device Songs Quick Link */}
        <TouchableOpacity style={s.downloadCard} onPress={() => router.push('/local-songs')}>
          <Smartphone size={24} color={colors.primary} />
          <View style={s.downloadInfo}>
            <Text style={s.downloadTitle}>Device Songs</Text>
            <Text style={s.downloadSub}>Browse & knot your local music</Text>
          </View>
          <Text style={s.arrow}>→</Text>
        </TouchableOpacity>

        {/* Downloads Quick Link */}
        <TouchableOpacity style={[s.downloadCard, { marginTop: 12 }]} onPress={() => router.push('/downloads')}>
          <Download size={24} color={colors.primary} />
          <View style={s.downloadInfo}>
            <Text style={s.downloadTitle}>Offline Downloads</Text>
            <Text style={s.downloadSub}>8 tracks • 42 MB</Text>
          </View>
          <Text style={s.arrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
      <PlayerBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxxl, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.xxl, letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.xxl },
  statCard: { flex: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  statValue: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginTop: 6 },
  statLabel: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  chips: { marginHorizontal: -spacing.xxl },
  chipsPad: { paddingHorizontal: spacing.xxl },
  gap: { height: spacing.xxl },
  downloadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.lg, padding: spacing.lg, marginTop: spacing.xxl },
  downloadInfo: { flex: 1, marginLeft: 14 },
  downloadTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text },
  downloadSub: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  arrow: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.primary },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, TrendingUp, Mic } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Chip } from '@/src/components/Chip';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TrackItem } from '@/src/components/TrackItem';
import { PlayerBar } from '@/src/components/PlayerBar';

const { width } = Dimensions.get('window');
const GENRES = ['All', 'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'R&B'];

const MOODS = [
  { id: 'm1', label: 'Chill Vibes', emoji: '🌊', bg: '#e8f4fd' },
  { id: 'm2', label: 'Workout', emoji: '🔥', bg: '#fde8e8' },
  { id: 'm3', label: 'Focus', emoji: '🎯', bg: '#e8fde8' },
  { id: 'm4', label: 'Party', emoji: '🎉', bg: '#fdf4e8' },
];

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
  const [activeGenre, setActiveGenre] = useState('All');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Explore</Text>

        <TouchableOpacity style={s.searchBar} onPress={() => router.push('/search-results')}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <Text style={s.searchPlaceholder}>Search tracks, artists, knots...</Text>
          <Mic size={20} color={colors.primary} />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsPad}>
          {GENRES.map(g => <Chip key={g} label={g} active={activeGenre === g} onPress={() => setActiveGenre(g)} />)}
        </ScrollView>

        <View style={s.gap} />
        <SectionHeader title="Browse by Mood" />
        <View style={s.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.id} style={[s.moodCard, { backgroundColor: m.bg }]} activeOpacity={0.8}>
              <Text style={s.moodEmoji}>{m.emoji}</Text>
              <Text style={s.moodLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
      </ScrollView>
      <PlayerBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxxl, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.xxl, letterSpacing: -0.5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, padding: 16, borderRadius: borderRadius.md, marginBottom: spacing.xxl, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  searchPlaceholder: { flex: 1, marginLeft: 12, fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary },
  chips: { marginHorizontal: -spacing.xxl },
  chipsPad: { paddingHorizontal: spacing.xxl },
  gap: { height: spacing.section },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodCard: { width: (width - spacing.xxl * 2 - 12) / 2, borderRadius: borderRadius.lg, padding: spacing.xl },
  moodEmoji: { fontSize: 32, marginBottom: 10 },
  moodLabel: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text },
  artistCard: { alignItems: 'center', marginRight: spacing.xl, width: 80 },
  artistImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceContainer, marginBottom: 8 },
  artistName: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, color: colors.text, textAlign: 'center' },
});

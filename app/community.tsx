import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Users, Clock } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Chip } from '@/src/components/Chip';

const { width } = Dimensions.get('window');
const FILTERS = ['Popular', 'New', 'Following'];

const KNOTS = [
  { id: 'c1', name: 'Epic Drop Only', track: 'Blinding Lights', creator: 'djmaster', uses: 1240, thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
  { id: 'c2', name: 'No Intro Clean', track: 'Shape of You', creator: 'musiclover', uses: 890, thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg' },
  { id: 'c3', name: 'Chorus Loop', track: 'Levitating', creator: 'beatsmith', uses: 567, thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg' },
  { id: 'c4', name: 'Guitar Solo', track: 'Bohemian Rhapsody', creator: 'rockfan', uses: 2100, thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
  { id: 'c5', name: 'Best Part', track: 'Stay', creator: 'ajayknots', uses: 340, thumbnail: 'https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg' },
  { id: 'c6', name: 'Bass Boost', track: 'Bad Guy', creator: 'basshead', uses: 780, thumbnail: 'https://i.ytimg.com/vi/DyDfgMOUjCI/hqdefault.jpg' },
];

export default function CommunityScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('Popular');
  const cardW = (width - spacing.xxl * 2 - 12) / 2;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.title}>Community Knots</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsPad}>
          {FILTERS.map(f => <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />)}
        </ScrollView>

        <View style={s.grid}>
          {KNOTS.map(k => (
            <TouchableOpacity key={k.id} style={[s.card, { width: cardW }]} activeOpacity={0.85} onPress={() => router.push('/song-detail')}>
              <Image source={{ uri: k.thumbnail }} style={[s.img, { width: cardW, height: cardW }]} />
              <Text style={s.knotName} numberOfLines={1}>{k.name}</Text>
              <Text style={s.trackName} numberOfLines={1}>{k.track}</Text>
              <View style={s.metaRow}>
                <Text style={s.creator}>@{k.creator}</Text>
                <Text style={s.uses}>{k.uses} uses</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.lg },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginLeft: 8 },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  chips: { marginHorizontal: -spacing.xxl, marginBottom: spacing.xxl },
  chipsPad: { paddingHorizontal: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {},
  img: { borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLow },
  knotName: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.text, marginTop: 8 },
  trackName: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  creator: { fontFamily: typography.fontFamily.body, fontSize: 10, color: colors.primary },
  uses: { fontFamily: typography.fontFamily.body, fontSize: 10, color: colors.outline },
});

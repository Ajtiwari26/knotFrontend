import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Edit3, Music, Users, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { SectionHeader } from '@/src/components/SectionHeader';
import { PlayerBar } from '@/src/components/PlayerBar';

const { width } = Dimensions.get('window');

const STATS = [
  { label: 'Knots', value: '12', icon: Music },
  { label: 'Followers', value: '248', icon: Users },
  { label: 'Liked', value: '34', icon: Heart },
];

const MY_KNOTS = [
  { id: 'k1', title: 'No Intro Knot', track: 'Kitne Bechain Hoke', thumbnail: 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg' },
  { id: 'k2', title: 'Clean Intro', track: 'Never Gonna Give You Up', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  { id: 'k3', title: 'Guitar Solo', track: 'Bohemian Rhapsody', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
  { id: 'k4', title: 'Drop Only', track: 'Blinding Lights', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
];

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Actions */}
        <View style={s.headerActions}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/settings')}>
            <Settings size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Avatar & Info */}
        <View style={s.profileSection}>
          <View style={s.avatarWrap}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.avatarRing}>
              <Image source={{ uri: 'https://i.pravatar.cc/200?img=12' }} style={s.avatar} />
            </LinearGradient>
            <TouchableOpacity style={s.editBadge} onPress={() => router.push('/edit-profile')}>
              <Edit3 size={14} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={s.name}>Ajay Kumar</Text>
          <Text style={s.handle}>@ajayknots</Text>
          <Text style={s.bio}>Music enthusiast. Creating the perfect listening experience, one knot at a time. 🎵</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {STATS.map(st => (
            <View key={st.label} style={s.statCard}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* My Knots Grid */}
        <SectionHeader title="My Knots" onAction={() => {}} />
        <View style={s.knotGrid}>
          {MY_KNOTS.map(k => (
            <TouchableOpacity key={k.id} style={s.knotCard} activeOpacity={0.85} onPress={() => router.push('/song-detail')}>
              <Image source={{ uri: k.thumbnail }} style={s.knotImg} />
              <Text style={s.knotTitle} numberOfLines={1}>{k.title}</Text>
              <Text style={s.knotTrack} numberOfLines={1}>{k.track}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions */}
        <View style={s.gap} />
        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/edit-profile')}>
          <Edit3 size={20} color={colors.primary} />
          <Text style={s.menuLabel}>Edit Profile</Text>
          <Text style={s.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/settings')}>
          <Settings size={20} color={colors.primary} />
          <Text style={s.menuLabel}>Settings</Text>
          <Text style={s.menuArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
      <PlayerBar />
    </SafeAreaView>
  );
}

const cardW = (width - spacing.xxl * 2 - 12) / 2;
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  headerActions: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' },
  profileSection: { alignItems: 'center', marginBottom: spacing.xxl },
  avatarWrap: { position: 'relative', marginBottom: spacing.lg },
  avatarRing: { width: 108, height: 108, borderRadius: 54, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.background },
  editBadge: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },
  name: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text },
  handle: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  bio: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20, paddingHorizontal: spacing.xxl },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.section },
  statCard: { flex: 1, backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  statValue: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text },
  statLabel: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  knotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  knotCard: { width: cardW },
  knotImg: { width: '100%', height: cardW, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLow },
  knotTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.text, marginTop: 8 },
  knotTrack: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  gap: { height: spacing.section },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 12 },
  menuLabel: { flex: 1, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md, color: colors.text, marginLeft: 14 },
  menuArrow: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.primary },
});

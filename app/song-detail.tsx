import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Play, Share2, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Button } from '@/src/components/Button';
import { TrackItem } from '@/src/components/TrackItem';

const { width } = Dimensions.get('window');

const KNOTS = [
  { id: 'k1', name: 'No Intro Knot', desc: 'Skips the 15s intro', creator: 'ajayknots', uses: 248 },
  { id: 'k2', name: 'Chorus Only', desc: 'Loops the chorus section', creator: 'musiclover', uses: 89 },
  { id: 'k3', name: 'Clean Version', desc: 'Skips explicit segments', creator: 'djmaster', uses: 156 },
];

const RELATED = [
  { id: 'r1', title: 'Dil To Pagal Hai', artist: 'Lata Mangeshkar', thumbnail: 'https://i.ytimg.com/vi/pGr9u1V1Pq0/hqdefault.jpg', duration: '5:12' },
  { id: 'r2', title: 'Tujhe Dekha Toh', artist: 'Kumar Sanu', thumbnail: 'https://i.ytimg.com/vi/gGPSgyEL7AE/hqdefault.jpg', duration: '4:45' },
];

export default function SongDetailScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={s.artWrap}>
          <Image source={{ uri: 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg' }} style={s.art} />
          <TouchableOpacity style={s.playOverlay}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.playCircle}>
              <Play size={28} color={colors.onPrimary} fill={colors.onPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={s.title}>Kitne Bechain Hoke</Text>
        <Text style={s.artist}>Alka Yagnik, Udit Narayan</Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>DURATION</Text><Text style={s.metaVal}>4:32</Text>
          <Text style={[s.meta, { marginLeft: 20 }]}>BITRATE</Text><Text style={s.metaVal}>128 kbps</Text>
        </View>

        <View style={s.actionRow}>
          <Button title="Play with Knot" variant="primary" size="md" style={{ flex: 1 }} icon={<Play size={16} color={colors.onPrimary} fill={colors.onPrimary} />} />
          <TouchableOpacity style={s.shareBtn}><Share2 size={20} color={colors.primary} /></TouchableOpacity>
        </View>

        {/* Available Knots */}
        <View style={s.sectionGap} />
        <Text style={s.sectionTitle}>Available Knots</Text>
        {KNOTS.map(k => (
          <TouchableOpacity key={k.id} style={s.knotCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.knotName}>{k.name}</Text>
              <Text style={s.knotDesc}>{k.desc}</Text>
              <Text style={s.knotMeta}>by @{k.creator} · {k.uses} uses</Text>
            </View>
            <TouchableOpacity style={s.applyBtn}><Text style={s.applyText}>Apply</Text></TouchableOpacity>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.createKnotBtn} onPress={() => router.push('/knot-editor')}>
          <Plus size={18} color={colors.primary} />
          <Text style={s.createKnotText}>Create Your Own Knot</Text>
        </TouchableOpacity>

        {/* Related */}
        <View style={s.sectionGap} />
        <Text style={s.sectionTitle}>Related Tracks</Text>
        {RELATED.map(r => (
          <TrackItem key={r.id} title={r.title} artist={r.artist} thumbnail={r.thumbnail} duration={r.duration} showHeart />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  backBtn: { marginTop: spacing.md, marginBottom: spacing.lg, width: 44, height: 44, justifyContent: 'center' },
  artWrap: { alignItems: 'center', marginBottom: spacing.xxl, position: 'relative' },
  art: { width: width - 80, height: width - 80, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLow },
  playOverlay: { position: 'absolute', bottom: -24 },
  playCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginTop: spacing.xxl, letterSpacing: -0.5 },
  artist: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  meta: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1, marginRight: 6 },
  metaVal: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.text },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.xxl },
  shareBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
  sectionGap: { height: spacing.section },
  sectionTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text, marginBottom: spacing.lg },
  knotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 12 },
  knotName: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text },
  knotDesc: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  knotMeta: { fontFamily: typography.fontFamily.body, fontSize: 10, color: colors.outline, marginTop: 4 },
  applyBtn: { backgroundColor: colors.primaryContainer, paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full },
  applyText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs, color: colors.onPrimaryContainer },
  createKnotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.ghostBorder, padding: 14, marginTop: 8, gap: 8 },
  createKnotText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.primary },
});

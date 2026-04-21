import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Play, Save, SkipForward, Scissors, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Button } from '@/src/components/Button';

const { width } = Dimensions.get('window');

export default function KnotEditorScreen() {
  const router = useRouter();
  const [segments] = useState([
    { id: 's1', start: 0, end: 15, type: 'skip', label: 'Intro' },
    { id: 's2', start: 45, end: 120, type: 'keep', label: 'Verse + Chorus' },
    { id: 's3', start: 180, end: 210, type: 'skip', label: 'Outro' },
  ]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}><X size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.title}>Knot Editor</Text>
        <TouchableOpacity onPress={() => router.push('/save-knot')} style={s.saveBtn}><Save size={20} color={colors.primary} /></TouchableOpacity>
      </View>

      {/* Track Info */}
      <View style={s.trackInfo}>
        <Text style={s.trackTitle}>Kitne Bechain Hoke</Text>
        <Text style={s.trackArtist}>Alka Yagnik, Udit Narayan · 4:32</Text>
      </View>

      {/* Waveform Placeholder */}
      <View style={s.waveformWrap}>
        <View style={s.waveform}>
          {Array.from({ length: 50 }).map((_, i) => (
            <View key={i} style={[s.bar, { height: 8 + Math.random() * 40, backgroundColor: i < 18 ? colors.primaryContainer : colors.surfaceContainerHigh }]} />
          ))}
        </View>
        <View style={s.playhead} />
        <View style={s.timeRow}>
          <Text style={s.time}>1:35</Text>
          <Text style={s.time}>4:32</Text>
        </View>
      </View>

      {/* Segments */}
      <View style={s.segmentSection}>
        <Text style={s.sectionLabel}>SEGMENTS</Text>
        {segments.map(seg => (
          <View key={seg.id} style={s.segmentCard}>
            <View style={[s.segType, seg.type === 'skip' ? s.segSkip : s.segKeep]}>
              <Text style={s.segTypeText}>{seg.type === 'skip' ? 'SKIP' : 'KEEP'}</Text>
            </View>
            <View style={s.segInfo}>
              <Text style={s.segLabel}>{seg.label}</Text>
              <Text style={s.segTime}>{formatTime(seg.start)} → {formatTime(seg.end)}</Text>
            </View>
            <TouchableOpacity style={s.segDelete}><X size={16} color={colors.textSecondary} /></TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Tools */}
      <View style={s.tools}>
        <TouchableOpacity style={s.tool}><Scissors size={20} color={colors.primary} /><Text style={s.toolLabel}>Split</Text></TouchableOpacity>
        <TouchableOpacity style={s.tool}><SkipForward size={20} color={colors.primary} /><Text style={s.toolLabel}>Skip</Text></TouchableOpacity>
        <TouchableOpacity style={s.tool}><RotateCcw size={20} color={colors.primary} /><Text style={s.toolLabel}>Loop</Text></TouchableOpacity>
      </View>

      {/* Bottom */}
      <View style={s.footer}>
        <TouchableOpacity style={s.previewBtn}>
          <Play size={20} color={colors.text} fill={colors.text} />
          <Text style={s.previewText}>Preview</Text>
        </TouchableOpacity>
        <Button title="Save Knot" onPress={() => router.push('/save-knot')} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text },
  saveBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { paddingHorizontal: spacing.xxl, marginTop: spacing.lg, marginBottom: spacing.xxl },
  trackTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, color: colors.text },
  trackArtist: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  waveformWrap: { paddingHorizontal: spacing.xxl, marginBottom: spacing.xxl },
  waveform: { flexDirection: 'row', alignItems: 'center', height: 60, gap: 2, backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.md, padding: 8, overflow: 'hidden' },
  bar: { width: 3, borderRadius: 1.5 },
  playhead: { position: 'absolute', left: spacing.xxl + 8 + (50 * 5 * 0.35), top: 0, width: 2, height: 60, backgroundColor: colors.primary },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary },
  segmentSection: { paddingHorizontal: spacing.xxl, flex: 1 },
  sectionLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md },
  segmentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.md, padding: 12, marginBottom: 8 },
  segType: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.xs },
  segSkip: { backgroundColor: colors.errorContainer + '30' },
  segKeep: { backgroundColor: colors.primaryContainer + '30' },
  segTypeText: { fontFamily: typography.fontFamily.bold, fontSize: 9, letterSpacing: 1 },
  segInfo: { flex: 1, marginLeft: 12 },
  segLabel: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text },
  segTime: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  segDelete: { padding: 8 },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: spacing.xxl },
  tool: { alignItems: 'center', gap: 4 },
  toolLabel: { fontFamily: typography.fontFamily.semibold, fontSize: 10, color: colors.primary },
  footer: { flexDirection: 'row', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: 12, alignItems: 'center' },
  previewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  previewText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.text },
});

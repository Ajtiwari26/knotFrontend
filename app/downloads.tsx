import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Download, Trash2, CheckCircle } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';

const DOWNLOADS = [
  { id: 'd1', title: 'Kitne Bechain Hoke', artist: 'Alka Yagnik', thumbnail: 'https://i.ytimg.com/vi/0JCLpa-r4Lg/hqdefault.jpg', duration: '4:32', size: '5.2 MB' },
  { id: 'd2', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration: '3:33', size: '4.1 MB' },
  { id: 'd3', title: 'Bohemian Rhapsody', artist: 'Queen', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg', duration: '5:55', size: '7.8 MB' },
  { id: 'd4', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20', size: '3.9 MB' },
];

export default function DownloadsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.title}>Downloads</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Storage Info */}
        <View style={s.storageCard}>
          <View style={s.storageRow}>
            <Download size={20} color={colors.primary} />
            <View style={s.storageInfo}>
              <Text style={s.storageTitle}>{DOWNLOADS.length} tracks downloaded</Text>
              <Text style={s.storageSub}>21.0 MB used</Text>
            </View>
          </View>
          <View style={s.storageBar}>
            <View style={s.storageFill} />
          </View>
        </View>

        {/* Downloaded Tracks */}
        <Text style={s.sectionLabel}>DOWNLOADED TRACKS</Text>
        {DOWNLOADS.map(d => (
          <TrackItem key={d.id} title={d.title} artist={`${d.artist} · ${d.size}`} thumbnail={d.thumbnail} duration={d.duration} showMore onPress={() => router.push('/song-detail')} />
        ))}

        <TouchableOpacity style={s.clearBtn}>
          <Trash2 size={18} color={colors.error} />
          <Text style={s.clearText}>Clear All Downloads</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.xxl },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginLeft: 8 },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  storageCard: { backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.lg, padding: spacing.xl, marginBottom: spacing.xxl, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  storageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  storageInfo: { marginLeft: 12 },
  storageTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.text },
  storageSub: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  storageBar: { height: 6, backgroundColor: colors.surfaceContainerHigh, borderRadius: 3, overflow: 'hidden' },
  storageFill: { height: 6, width: '15%', backgroundColor: colors.primaryContainer, borderRadius: 3 },
  sectionLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, padding: spacing.lg, marginTop: spacing.xxl, gap: 8 },
  clearText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.error },
});

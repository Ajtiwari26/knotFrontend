import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Globe, Lock } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Input } from '@/src/components/Input';
import { Button } from '@/src/components/Button';
import { Chip } from '@/src/components/Chip';

export default function SaveKnotScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Save Knot</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={s.content}>
        <Input label="Knot Name" placeholder="e.g. No Intro Knot" />
        <Input label="Description" placeholder="What does this knot do?" multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top', paddingTop: 14 }} />

        <Text style={s.label}>Visibility</Text>
        <View style={s.visRow}>
          <Chip label="Public" active />
          <Chip label="Private" />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Track</Text>
          <Text style={s.infoValue}>Kitne Bechain Hoke</Text>
          <Text style={s.infoTitle}>Segments</Text>
          <Text style={s.infoValue}>3 segments (2 skip, 1 keep)</Text>
          <Text style={s.infoTitle}>Duration saved</Text>
          <Text style={s.infoValue}>~45 seconds skipped</Text>
        </View>
      </View>
      <View style={s.footer}>
        <Button title="Save & Publish" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text },
  content: { flex: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl },
  label: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text, marginBottom: 8 },
  visRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.xxl },
  infoCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.lg, padding: spacing.xl },
  infoTitle: { fontFamily: typography.fontFamily.bold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1, marginTop: 12 },
  infoValue: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.text, marginTop: 2 },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl },
});

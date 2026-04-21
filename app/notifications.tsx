import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart, UserPlus, Music, Bell } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';

const NOTIFS = [
  { id: 'n1', icon: Heart, color: colors.error, title: 'New like on your knot', desc: 'musiclover liked your "No Intro" knot', time: '2m ago', read: false },
  { id: 'n2', icon: UserPlus, color: colors.primary, title: 'New follower', desc: 'djmaster started following you', time: '1h ago', read: false },
  { id: 'n3', icon: Music, color: colors.tertiary, title: 'Trending knot', desc: 'Your "Clean Intro" knot is trending!', time: '3h ago', read: true },
  { id: 'n4', icon: Bell, color: colors.secondary, title: 'System update', desc: 'Knot v1.1 is now available', time: '1d ago', read: true },
  { id: 'n5', icon: Heart, color: colors.error, title: 'Multiple likes', desc: '12 people liked your knots today', time: '1d ago', read: true },
];

export default function NotificationsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {NOTIFS.map(n => (
          <TouchableOpacity key={n.id} style={[s.notifCard, !n.read && s.unread]}>
            <View style={[s.iconWrap, { backgroundColor: n.color + '18' }]}>
              <n.icon size={18} color={n.color} />
            </View>
            <View style={s.notifInfo}>
              <Text style={s.notifTitle}>{n.title}</Text>
              <Text style={s.notifDesc}>{n.desc}</Text>
              <Text style={s.notifTime}>{n.time}</Text>
            </View>
            {!n.read && <View style={s.unreadDot} />}
          </TouchableOpacity>
        ))}
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
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: 12 },
  unread: { backgroundColor: colors.surfaceContainerLowest },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifInfo: { flex: 1, marginLeft: 14 },
  notifTitle: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.text },
  notifDesc: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  notifTime: { fontFamily: typography.fontFamily.body, fontSize: 10, color: colors.outline, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContainer, marginTop: 4 },
});

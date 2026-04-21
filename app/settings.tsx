import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Mail, Lock, Volume2, Wifi, HardDrive, Info, FileText, Shield, LogOut } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';

const MenuItem = ({ icon: Icon, label, value, onPress, isToggle, toggled }: any) => (
  <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
    <Icon size={20} color={colors.primary} />
    <Text style={s.menuLabel}>{label}</Text>
    {isToggle ? <Switch value={toggled} trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHigh }} thumbColor={colors.surfaceContainerLowest} /> : value ? <Text style={s.menuValue}>{value}</Text> : <Text style={s.menuArrow}>→</Text>}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>

        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <MenuItem icon={User} label="Profile" onPress={() => router.push('/edit-profile')} />
        <MenuItem icon={Mail} label="Email" value="ajay@example.com" />
        <MenuItem icon={Lock} label="Change Password" />

        <Text style={s.sectionLabel}>PLAYBACK</Text>
        <MenuItem icon={Volume2} label="Audio Quality" value="High (256kbps)" />
        <MenuItem icon={Wifi} label="Stream over Wi-Fi only" isToggle toggled={false} />

        <Text style={s.sectionLabel}>STORAGE</Text>
        <MenuItem icon={HardDrive} label="Downloads" onPress={() => router.push('/downloads')} />
        <MenuItem icon={HardDrive} label="Clear Cache" value="24 MB" />

        <Text style={s.sectionLabel}>ABOUT</Text>
        <MenuItem icon={Info} label="Version" value="1.0.0" />
        <MenuItem icon={FileText} label="Terms of Service" />
        <MenuItem icon={Shield} label="Privacy Policy" />

        <TouchableOpacity style={s.logoutBtn}>
          <LogOut size={20} color={colors.error} />
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xxxl },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginLeft: 8 },
  sectionLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, marginTop: spacing.xxl, marginBottom: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 10 },
  menuLabel: { flex: 1, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md, color: colors.text, marginLeft: 14 },
  menuValue: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary },
  menuArrow: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, color: colors.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, padding: spacing.lg, marginTop: spacing.section, gap: 8 },
  logoutText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.error },
});

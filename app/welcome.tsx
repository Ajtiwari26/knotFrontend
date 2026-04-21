import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Button } from '@/src/components/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.logo}>
          <Text style={s.logoText}>K</Text>
        </LinearGradient>
        <Text style={s.brand}>Knot</Text>
        <Text style={s.tagline}>Your music.{'\n'}Your rules.</Text>
        <Text style={s.desc}>Skip intros, loop choruses, and create the perfect version of every song.</Text>
      </View>
      <View style={s.footer}>
        <Button title="Get Started" onPress={() => router.replace('/onboarding')} />
        <Button title="I have an account" variant="ghost" onPress={() => router.replace('/login')} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xxxl },
  logo: { width: 80, height: 80, borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
  logoText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.display, color: colors.onPrimary },
  brand: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.displayLg, color: colors.text, letterSpacing: -2 },
  tagline: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.primary, textAlign: 'center', marginTop: spacing.xl, lineHeight: 32 },
  desc: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 24 },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: 12 },
});

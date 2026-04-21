import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Button } from '@/src/components/Button';

const { width } = Dimensions.get('window');

const STEPS = [
  { title: 'Find Your Song', desc: 'Search for any track on YouTube. We handle the audio — you just enjoy.', emoji: '🔍' },
  { title: 'Create a Knot', desc: 'Mark segments to skip, loop, or remix. Make the song truly yours.', emoji: '✂️' },
  { title: 'Listen Your Way', desc: 'Play your knotted tracks seamlessly. Share with the community.', emoji: '🎧' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.replace('/login');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <View style={s.emojiWrap}>
          <Text style={s.emoji}>{STEPS[step].emoji}</Text>
        </View>

        <Text style={s.stepLabel}>STEP {step + 1} OF {STEPS.length}</Text>
        <Text style={s.title}>{STEPS[step].title}</Text>
        <Text style={s.desc}>{STEPS[step].desc}</Text>

        {/* Dots */}
        <View style={s.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>
      </View>

      <View style={s.footer}>
        <Button title={step === STEPS.length - 1 ? 'Get Started' : 'Next'} onPress={next} />
        {step < STEPS.length - 1 && (
          <TouchableOpacity style={s.skipBtn} onPress={() => router.replace('/login')}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xxxl },
  emojiWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.section },
  emoji: { fontSize: 56 },
  stepLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.primary, letterSpacing: 1.5, marginBottom: spacing.md },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxxl, color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  desc: { fontFamily: typography.fontFamily.body, fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, marginTop: spacing.section },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
  dotActive: { width: 24, backgroundColor: colors.primaryContainer },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: 12 },
  skipBtn: { alignItems: 'center', padding: 12 },
  skipText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.md, color: colors.textSecondary },
});

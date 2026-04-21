import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Input } from '@/src/components/Input';
import { Button } from '@/src/components/Button';
import { useAuthStore } from '@/src/store/authStore';
import { resolveBaseUrl } from '@/src/config/api';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    try {
      setLoading(true);
      const baseUrl = await resolveBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      setAuth(data.token, data, false);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    try {
      setLoading(true);
      // Fully offline guest login - bypasses backend check
      const dummyToken = 'guest-token-' + Date.now();
      const dummyUser = {
        id: 'guest',
        email: 'guest@knot.local',
        name: 'Guest User',
      };
      
      setAuth(dummyToken, dummyUser, true);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Guest Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        {/* Brand */}
        <View style={s.brandWrap}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.logo}>
            <Text style={s.logoText}>K</Text>
          </LinearGradient>
          <Text style={s.brand}>Knot</Text>
        </View>

        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.subtitle}>Sign in to continue your listening experience</Text>

        <Input 
          label="Email" 
          placeholder="your@email.com" 
          keyboardType="email-address" 
          autoCapitalize="none" 
          value={email}
          onChangeText={setEmail}
        />
        <Input 
          label="Password" 
          placeholder="••••••••" 
          secureTextEntry 
          value={password}
          onChangeText={setPassword}
        />

        <Button 
          title={loading ? "Loading..." : "Sign In"} 
          onPress={handleLogin} 
          style={{ marginTop: 8 }} 
          disabled={loading}
        />

        <TouchableOpacity style={s.forgotBtn}>
          <Text style={s.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        <Button 
          title="Skip → Guest Mode" 
          variant="secondary" 
          onPress={handleGuest} 
          disabled={loading}
        />
      </View>

      <Text style={s.terms}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  brandWrap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.section },
  logo: { width: 48, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.onPrimary },
  brand: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxxl, color: colors.text, marginLeft: 12, letterSpacing: -1 },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxxl },
  forgotBtn: { alignItems: 'center', paddingVertical: 12 },
  forgotText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.primary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xxl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.surfaceContainerHigh },
  dividerText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, marginHorizontal: 16 },
  terms: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.outline, textAlign: 'center', paddingHorizontal: spacing.xxxl, paddingBottom: spacing.xxl },
});

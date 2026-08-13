import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Mail, Phone, Lock, ChevronLeft, ArrowRight } from 'lucide-react-native';
import auth, { getAuth, signInWithPhoneNumber, signInWithCredential, GoogleAuthProvider, FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Input } from '@/src/components/Input';
import { Button } from '@/src/components/Button';
import { useAuthStore } from '@/src/store/authStore';
import { resolveBaseUrl } from '@/src/config/api';
import { KnotService } from '@/src/services/KnotService';

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const token = useAuthStore((state) => state.token);
  
  // Auto-redirect if already logged in
  useEffect(() => {
    if (token) {
      router.replace('/(tabs)');
    }
  }, [token]);
  
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');
  
  // Email states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Phone/OTP states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  // Initialize native Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1065921681712-0khbve5squpjic18srs7r8ah7ocn4mv4.apps.googleusercontent.com',
    });
  }, []);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleFinishAuth = async (data: any) => {
    setAuth(data.token, data, false);
    try {
      await KnotService.syncAllKnotsToBackend();
      await KnotService.pullKnotsFromBackend();
    } catch (err) {
      console.warn('[Login] Mobile knot sync error:', err);
    }
    router.replace('/(tabs)');
  };

  const handleEmailLogin = async () => {
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
      
      await handleFinishAuth(data);
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      const baseUrl = await resolveBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS');

      setIsOtpSent(true);
      setCountdown(60);
      Alert.alert('Code Sent', 'Please check your SMS messages for the 6-digit verification code.');
    } catch (e: any) {
      Alert.alert('Failed to send SMS', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the 6-digit OTP code');
      return;
    }

    try {
      setLoading(true);
      const baseUrl = await resolveBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, otp })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      await handleFinishAuth(data);
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit OTP when it reaches exactly 6 digits (Auto-login)
  useEffect(() => {
    if (otp && otp.length === 6) {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // Ensure Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Trigger native Google authentication sheet
      const signInResult = await GoogleSignin.signIn();
      const googleIdToken = signInResult.data?.idToken || (signInResult as any).idToken;

      if (!googleIdToken) {
        throw new Error('Failed to retrieve Google ID Token.');
      }

      // Authenticate inside Firebase Auth client using modular calls
      const googleCredential = GoogleAuthProvider.credential(googleIdToken);
      const userCredential = await signInWithCredential(getAuth(), googleCredential);

      // Fetch live Firebase ID Token for backend verification
      const firebaseIdToken = await userCredential.user.getIdToken();

      const baseUrl = await resolveBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: firebaseIdToken })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google account sync failed');

      await handleFinishAuth(data);
    } catch (e: any) {
      // Avoid alerts if the user closed the sign-in sheet manually
      if (e.code !== 'ASYNC_OP_IN_PROGRESS' && e.code !== '12501') {
        Alert.alert('Google Sign-In Failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        {/* Brand Header */}
        <View style={s.brandWrap}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.logo}>
            <Text style={s.logoText}>K</Text>
          </LinearGradient>
          <Text style={s.brand}>Knot</Text>
        </View>

        <Text style={s.title}>{isOtpSent ? "Enter Code" : "Welcome to Knot"}</Text>
        <Text style={s.subtitle}>
          {isOtpSent 
            ? `We sent a 6-digit verification code to ${phone}`
            : "Sign in to remix, loop, and customize your tracks."}
        </Text>

        {/* --- OTP Verification Mode --- */}
        {isOtpSent ? (
          <View style={s.formBlock}>
            <Input 
              label="Verification Code" 
              placeholder="123456" 
              keyboardType="number-pad" 
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
            <Button 
              title={loading ? "Verifying..." : "Verify & Continue"} 
              onPress={handleVerifyOtp} 
              disabled={loading}
              style={{ marginTop: 8 }}
            />
            <View style={s.otpResendRow}>
              <TouchableOpacity 
                disabled={countdown > 0} 
                onPress={handleSendOtp}
              >
                <Text style={[s.resendText, countdown > 0 && s.resendTextDisabled]}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : "Resend Verification Code"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={s.changePhoneBtn}
                onPress={() => setIsOtpSent(false)}
              >
                <ChevronLeft size={16} color={colors.primary} />
                <Text style={s.changePhoneText}>Change phone</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* --- Regular Auth Mode --- */
          <View style={s.formBlock}>
            {/* Login Method Tabs */}
            <View style={s.tabContainer}>
              <TouchableOpacity 
                style={[s.tabButton, authMode === 'phone' && s.tabActive]}
                onPress={() => setAuthMode('phone')}
              >
                <Phone size={16} color={authMode === 'phone' ? colors.primary : colors.textSecondary} />
                <Text style={[s.tabText, authMode === 'phone' && s.tabTextActive]}>Phone Number</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.tabButton, authMode === 'email' && s.tabActive]}
                onPress={() => setAuthMode('email')}
              >
                <Mail size={16} color={authMode === 'email' ? colors.primary : colors.textSecondary} />
                <Text style={[s.tabText, authMode === 'email' && s.tabTextActive]}>Email</Text>
              </TouchableOpacity>
            </View>

            {/* Inputs based on active tab */}
            {authMode === 'phone' ? (
              <View>
                <Input 
                  label="Phone Number" 
                  placeholder="+1 (555) 000-0000" 
                  keyboardType="phone-pad" 
                  value={phone}
                  onChangeText={setPhone}
                />
                <Button 
                  title={loading ? "Sending OTP..." : "Send Verification Code"} 
                  onPress={handleSendOtp} 
                  disabled={loading}
                  icon={<ArrowRight size={18} color={colors.onPrimary} />}
                  style={{ marginTop: 8 }}
                />
              </View>
            ) : (
              <View>
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
                  title={loading ? "Signing In..." : "Sign In"} 
                  onPress={handleEmailLogin} 
                  disabled={loading}
                  style={{ marginTop: 8 }}
                />
                <TouchableOpacity style={s.forgotBtn}>
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or continue with</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <Button 
              title="Continue with Google" 
              variant="secondary" 
              icon={<GoogleIcon />}
              onPress={handleGoogleLogin}
              disabled={loading}
            />


          </View>
        )}
      </View>

      <Text style={s.terms}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  brandWrap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  logo: { width: 44, height: 44, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.onPrimary },
  brand: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, marginLeft: 12, letterSpacing: -0.5 },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontFamily: typography.fontFamily.body, fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.xl },
  formBlock: { width: '100%' },
  tabContainer: { flexDirection: 'row', backgroundColor: colors.surfaceContainerLow, borderRadius: borderRadius.full, padding: 4, marginBottom: spacing.xl },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: borderRadius.full },
  tabActive: { backgroundColor: colors.surfaceContainerHighest },
  tabText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.text },
  forgotBtn: { alignItems: 'center', paddingVertical: 12 },
  forgotText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.primary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.surfaceContainerHigh },
  dividerText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.xs, color: colors.textSecondary, marginHorizontal: 12 },

  otpResendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 4 },
  resendText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.primary },
  resendTextDisabled: { color: colors.textSecondary },
  changePhoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changePhoneText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, color: colors.primary },
  terms: { fontFamily: typography.fontFamily.body, fontSize: 10, color: colors.outline, textAlign: 'center', paddingHorizontal: spacing.xxxl, paddingBottom: spacing.lg },
});

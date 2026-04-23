import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { BeVietnamPro_400Regular, BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro';
import { colors } from '@/src/theme/colors';
import { initApiConfig } from '@/src/config/api';
import { AudioService } from '@/src/services/AudioService';
import TrackPlayer from 'react-native-track-player';

import CustomSplashScreen from '@/components/SplashScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
  });

  const [forceRender, setForceRender] = useState(false);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Resolve API backend (local vs production)
    initApiConfig();
    
    // Initialize TrackPlayer
    AudioService.setupPlayer().then(() => {
      setAppReady(true);
    });

    // Hide native splash immediately to let our CustomSplashScreen handle it
    // This solves the "small icon in center" issue on Android 12+
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn(e);
      }
    };
    hideNativeSplash();
  }, []);

  // Fallback to ensure app renders even if fonts fail
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceRender(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if ((!loaded || !appReady) && !forceRender) {
    return <CustomSplashScreen />;
  }

  // If fonts failed but we are forced to render, this will still run
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="song-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="queue" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="community" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="knot-editor" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="downloads" />
        <Stack.Screen name="search-results" />
        <Stack.Screen name="save-knot" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

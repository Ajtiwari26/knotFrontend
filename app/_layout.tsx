import { useEffect } from 'react';
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

SplashScreen.preventAutoHideAsync();

// Playback service is registered in index.ts

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
  });

  useEffect(() => {
    // Resolve API backend (local vs production)
    initApiConfig();
    
    // Initialize TrackPlayer
    AudioService.setupPlayer();
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

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

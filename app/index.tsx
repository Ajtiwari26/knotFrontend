import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/authStore';

export default function Index() {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

import { Redirect } from 'expo-router';

export default function Index() {
  // Eventually, we will check if the user is logged in and redirect to onboarding if not.
  // For now, redirect to the home tab.
  return <Redirect href="/(tabs)" />;
}

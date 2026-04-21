import TrackPlayer from 'react-native-track-player';
TrackPlayer.registerPlaybackService(() => require('./src/services/PlaybackService'));

// Delegate to expo-router after our service is registered
import 'expo-router/entry';

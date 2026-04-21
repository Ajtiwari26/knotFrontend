import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, GripVertical, Trash2 } from 'lucide-react-native';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { TrackItem } from '@/src/components/TrackItem';

import { usePlayerStore } from '@/src/store/playerStore';
import { AudioService } from '@/src/services/AudioService';

// Function to format duration in ms to mm:ss
const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function QueueScreen() {
  const router = useRouter();
  const queue = usePlayerStore(state => state.queue);
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const currentIndex = usePlayerStore(state => state.currentIndex);
  
  const clearQueue = () => {
    usePlayerStore.getState().setQueue([], -1);
  };
  
  const upNext = queue.slice(currentIndex + 1);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Up Next</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}><X size={24} color={colors.text} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {currentTrack && (
          <>
            <Text style={s.sectionLabel}>NOW PLAYING</Text>
            <View style={s.nowPlaying}>
              <TrackItem 
                title={currentTrack.title} 
                artist={currentTrack.artist} 
                thumbnail={currentTrack.thumbnail || ''} 
                duration={formatDuration(currentTrack.duration_ms)} 
                knotBadge="No Intro Knot" 
              />
            </View>
          </>
        )}

        <View style={s.upNextHeader}>
          <Text style={s.sectionLabel}>QUEUE ({upNext.length})</Text>
          <TouchableOpacity onPress={clearQueue}><Text style={s.clearText}>Clear</Text></TouchableOpacity>
        </View>

        {upNext.map((t, idx) => (
          <TrackItem 
            key={`${t.source === 'youtube' ? t.youtube_id : t.local_uri}-${idx}`} 
            title={t.title} 
            artist={t.artist} 
            thumbnail={t.thumbnail || ''} 
            duration={formatDuration(t.duration_ms)} 
            showMore 
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xxl, color: colors.text },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  sectionLabel: { fontFamily: typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 1.5, marginBottom: spacing.md },
  nowPlaying: { marginBottom: spacing.xxl },
  upNextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  clearText: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.primary },
});

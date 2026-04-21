import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, borderRadius } from '@/src/theme/spacing';
import { Input } from '@/src/components/Input';
import { Button } from '@/src/components/Button';

export default function EditProfileScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.title}>Edit Profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            <Image source={{ uri: 'https://i.pravatar.cc/200?img=12' }} style={s.avatar} />
            <TouchableOpacity style={s.cameraBadge}>
              <Camera size={16} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity><Text style={s.changePhoto}>Change Photo</Text></TouchableOpacity>
        </View>

        <Input label="Display Name" placeholder="Ajay Kumar" defaultValue="Ajay Kumar" />
        <Input label="Username" placeholder="@ajayknots" defaultValue="ajayknots" />
        <Input label="Bio" placeholder="Tell us about yourself..." defaultValue="Music enthusiast. Creating the perfect listening experience, one knot at a time. 🎵" multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        <Input label="Website" placeholder="https://yoursite.com" keyboardType="url" autoCapitalize="none" />

        <View style={s.btnGap} />
        <Button title="Save Changes" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.md, marginBottom: spacing.xxl },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.xl, color: colors.text },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.hero },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceContainer },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },
  changePhoto: { fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm, color: colors.primary },
  btnGap: { height: spacing.xxl },
});

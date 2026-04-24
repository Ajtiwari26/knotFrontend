import React, { useState } from 'react';
import { StyleSheet, StyleProp, ImageStyle, Image } from 'react-native';

interface ArtworkProps {
  uri?: string;
  thumbnail?: string; // We'll use this primarily
  style?: StyleProp<ImageStyle>;
}

export const Artwork = ({ uri, thumbnail, style }: ArtworkProps) => {
  const [hasError, setHasError] = useState(false);
  let sourceUri = thumbnail || uri;

  // Auto-fix old cached URIs from the player store
  if (sourceUri && sourceUri.includes('/audio/albumart/')) {
    const match = sourceUri.match(/\/audio\/albumart\/(-?\d+)/);
    if (match) {
      sourceUri = `content://media/external/audio/media/${match[1]}/albumart`;
    }
  }

  if (!sourceUri || hasError) {
    return <Image source={require('@/assets/icon.png')} style={[style, { resizeMode: 'cover' }]} />;
  }

  return (
    <Image 
      source={{ uri: sourceUri }} 
      style={[style, { resizeMode: 'cover' }]} 
      onError={(e) => {
        console.log('[Artwork] RN Image Failed to load:', sourceUri, e.nativeEvent.error);
        setHasError(true);
      }}
    />
  );
};

const styles = StyleSheet.create({});

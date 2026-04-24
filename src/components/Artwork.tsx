import React, { useState } from 'react';
import { StyleSheet, StyleProp } from 'react-native';
import { Image, ImageStyle } from 'expo-image';

interface ArtworkProps {
  uri?: string;
  thumbnail?: string;
  style?: StyleProp<ImageStyle>;
  onImageError?: () => void;
}

export const Artwork = ({ uri, thumbnail, style, onImageError }: ArtworkProps) => {
  const [hasError, setHasError] = useState(false);
  let sourceUri = thumbnail || uri;

  // Auto-fix old cached URIs if they are in the wrong format
  if (sourceUri && sourceUri.includes('/audio/albumart/')) {
    const match = sourceUri.match(/\/audio\/albumart\/(-?\d+)/);
    if (match) {
      sourceUri = `content://media/external/audio/media/${match[1]}/albumart`;
    }
  }

  const placeholder = require('@/assets/icon.png');

  return (
    <Image 
      source={hasError || !sourceUri ? placeholder : { uri: sourceUri }} 
      style={[style]} 
      contentFit="cover"
      transition={200}
      cachePolicy="disk"
      onError={(e) => {
        console.log('[Artwork] Image Failed to load:', sourceUri);
        setHasError(true);
        if (onImageError) onImageError();
      }}
    />
  );
};

const styles = StyleSheet.create({});

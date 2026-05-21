import React, { useState } from 'react';
import { StyleSheet, StyleProp, Image as RNImage } from 'react-native';
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

  React.useEffect(() => {
    setHasError(false);
  }, [sourceUri]);

  // Auto-fix old cached URIs if they are in the wrong format
  if (sourceUri && sourceUri.includes('/audio/albumart/')) {
    const match = sourceUri.match(/\/audio\/albumart\/(-?\d+)/);
    if (match) {
      sourceUri = `content://media/external/audio/media/${match[1]}/albumart`;
    }
  }

  const placeholder = require('@/assets/icon.png');
  
  // expo-image sometimes double-encodes URLs that already have %20. 
  // We decode it first so expo-image can encode it safely.
  let finalUri = sourceUri;
  if (finalUri && finalUri.startsWith('http')) {
    try {
      finalUri = decodeURI(finalUri);
    } catch (e) {
      // ignore decode errors
    }
  }

  const handleError = () => {
    console.log('[Artwork] Image Failed to load:', finalUri);
    setHasError(true);
    if (onImageError) onImageError();
  };

  const source = hasError || !finalUri ? placeholder : { uri: finalUri };

  return (
    <Image 
      source={source} 
      style={[style]} 
      contentFit="cover"
      transition={200}
      cachePolicy="disk"
      onError={handleError}
    />
  );
};

const styles = StyleSheet.create({});

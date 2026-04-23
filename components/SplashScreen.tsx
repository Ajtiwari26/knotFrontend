import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Dimensions, Text } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function CustomSplashScreen() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.9,
      duration: 3000,
      useNativeDriver: false,
    }).start();
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/splash-icon.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      {/* 
        The image already has a "Loading..." text and a bar. 
        We overlay our animated bar exactly on top of it.
        Based on the image aspect ratio, we'll try to position it.
      */}
      <View style={styles.overlay}>
        <View style={styles.barContainer}>
          <View style={styles.barBackground}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED', // Matching the cream color of the image
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    bottom: height * 0.05, // Adjust this percentage to align with the image's bar
    width: '100%',
    alignItems: 'center',
  },
  barContainer: {
    width: '65%', // Matches the width of the bar in the image
    height: 10,
    justifyContent: 'center',
  },
  barBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#8B4513', // A brown shade matching the rope theme
    borderRadius: 3,
  }
});

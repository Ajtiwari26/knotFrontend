import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { borderRadius as br } from '../theme/spacing';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'flat' | 'glass';
  radius?: number;
  style?: ViewStyle;
}

export const Card = ({ children, variant = 'elevated', radius = br.lg, style, ...props }: CardProps) => {
  return (
    <View
      style={[
        styles.card,
        { borderRadius: radius },
        variant === 'elevated' && styles.elevated,
        variant === 'flat' && styles.flat,
        variant === 'glass' && styles.glass,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
  },
  elevated: {
    // Tinted ambient shadow per design system
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  flat: {
    backgroundColor: colors.surfaceContainerLow,
  },
  glass: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLight,
  },
});

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button = ({ title, variant = 'primary', isLoading = false, style, textStyle, ...props }: ButtonProps) => {
  return (
    <TouchableOpacity 
      style={[styles.button, styles[variant], style]} 
      activeOpacity={0.8}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.primary} />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
  },
  primaryText: {
    color: colors.textInverse,
  },
  secondaryText: {
    color: colors.text,
  },
  ghostText: {
    color: colors.primary,
  },
});

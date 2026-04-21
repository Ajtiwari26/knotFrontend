import React, { useState } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius } from '../theme/spacing';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, style, ...props }: InputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text,
    // No border by default — minimalist per design system
  },
  inputFocused: {
    backgroundColor: colors.surfaceContainerLow,
    // 2px inner glow effect via shadow
    shadowColor: colors.primaryFixedDim,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.error,
    marginTop: 4,
    fontFamily: typography.fontFamily.body,
  },
});

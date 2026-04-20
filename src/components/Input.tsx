import React, { useState } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

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
          style
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: '#FFF4F0', // Slight orange inner glow tint
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.error,
    marginTop: 4,
    fontFamily: typography.fontFamily.medium,
  }
});

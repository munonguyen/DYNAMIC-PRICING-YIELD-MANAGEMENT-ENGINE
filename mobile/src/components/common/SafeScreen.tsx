import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/theme';

interface SafeScreenProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  backgroundColor = COLORS.canvas,
}) => (
  <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top', 'left', 'right']}>
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
    <View style={styles.inner}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1 },
});


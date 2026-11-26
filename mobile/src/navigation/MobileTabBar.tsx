import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MobileTabId } from '@/types/domain';
import { MOBILE_TABS } from '@/constants/navigation';
import { COLORS, RADII, SPACING } from '@/theme';

interface MobileTabBarProps {
  activeTab: MobileTabId;
  onSelectTab: (tab: MobileTabId) => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onSelectTab }) => (
  <SafeAreaView edges={['bottom']} style={styles.safeWrap}>
    <View style={styles.row}>
      {MOBILE_TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={styles.tabItem}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeWrap: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 46,
  },
  iconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  iconWrapActive: { backgroundColor: COLORS.forest },
  icon: { fontSize: 15, color: COLORS.muted },
  iconActive: { color: COLORS.mint },
  label: { fontSize: 10.5, fontWeight: '600', color: COLORS.muted },
  labelActive: { color: COLORS.forest, fontWeight: '700' },
});


import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING } from '@/theme';

export interface ShopTabOption {
  id: string;
  label: string;
}

interface ShopTabsBarProps {
  tabs: ShopTabOption[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
}

export const ShopTabsBar: React.FC<ShopTabsBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
}) => (
  <View style={styles.bar}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  tabBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.forest,
  },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  tabLabelActive: { color: COLORS.forest, fontWeight: '700' },
});


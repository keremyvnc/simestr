import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import CoursesScreen from './src/screens/CoursesScreen';
import { useReminderSync } from './src/notifications';
import HomeScreen from './src/screens/HomeScreen';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import type { Route } from './src/types';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { route: Route; label: string; icon: IconName; iconActive: IconName }[] = [
  { route: 'home', label: 'Program', icon: 'calendar-outline', iconActive: 'calendar' },
  { route: 'courses', label: 'Dersler', icon: 'book-outline', iconActive: 'book' },
];

function Shell() {
  const { data, loaded } = useStore();
  useReminderSync(data.courses, data.settings.notifications, loaded);
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route>('home');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {!loaded ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : route === 'home' ? (
          <HomeScreen onNavigate={setRoute} />
        ) : (
          <CoursesScreen />
        )}
      </View>

      {/* Alt gezinme çubuğu */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((tab) => {
          const active = tab.route === route;
          return (
            <Pressable
              key={tab.route}
              onPress={() => setRoute(tab.route)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.tabPill, active && styles.tabPillActive]}>
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={22}
                  color={active ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: colors.primarySoft },
  tabLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
});

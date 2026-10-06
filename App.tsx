import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import CoursesScreen from './src/screens/CoursesScreen';
import HomeScreen from './src/screens/HomeScreen';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import type { Route } from './src/types';

const NAV: { route: Route; label: string }[] = [
  { route: 'home', label: 'Haftalık Program' },
  { route: 'courses', label: 'Dersler' },
];

function Shell() {
  const { loaded } = useStore();
  const [route, setRoute] = useState<Route>('home');

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <Text style={styles.brand}>Simestr</Text>
        <Text style={styles.brandSub}>Lisansüstü ders takibi</Text>
        <View style={{ marginTop: 28, gap: 4 }}>
          {NAV.map((item) => {
            const active = item.route === route;
            return (
              <Pressable
                key={item.route}
                onPress={() => setRoute(item.route)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.content}>
        {!loaded ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : route === 'home' ? (
          <HomeScreen onNavigate={setRoute} />
        ) : (
          <CoursesScreen />
        )}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  sidebar: { width: 230, backgroundColor: colors.sidebar, paddingVertical: 28, paddingHorizontal: 16 },
  brand: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: 0.5, paddingHorizontal: 12 },
  brandSub: { color: colors.sidebarText, fontSize: 12, paddingHorizontal: 12, marginTop: 2 },
  navItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  navItemActive: { backgroundColor: colors.sidebarActive },
  navText: { color: colors.sidebarText, fontSize: 14, fontWeight: '500' },
  navTextActive: { color: '#FFFFFF', fontWeight: '700' },
  content: { flex: 1 },
});

/**
 * Kauridorr — BottomNavBar
 * React Native bottom navigation component.
 *
 * Usage:
 *   import BottomNavBar from './BottomNavBar';
 *
 *   <BottomNavBar
 *     activeTab="home"
 *     onTabPress={(tab) => navigation.navigate(tab)}
 *   />
 *
 * Dependencies:
 *   - react-native (core)
 *   - react-native-safe-area-context  →  useSafeAreaInsets()
 *
 * Install safe-area-context if not already present:
 *   npx expo install react-native-safe-area-context
 *   # or
 *   yarn add react-native-safe-area-context
 *
 * Wrap your app root with <SafeAreaProvider> from that package.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Brand tokens ────────────────────────────────────────────────────────────
const ORANGE      = '#D85A30';
const ORANGE_DARK = '#993C1D';
const ORANGE_LIGHT = '#FAE8E0';
const BG          = '#FFFFFF';
const BORDER      = 'rgba(0,0,0,0.09)';
const TEXT_MUTED  = '#888780';

// ─── Tab definition ──────────────────────────────────────────────────────────
export type TabKey = 'home' | 'clients' | 'history' | 'profile';

interface Tab {
  key: TabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

// ─── SVG-like icons via View compositions ────────────────────────────────────
// Pure RN — no external icon library required.
// Swap with your preferred icon set (lucide-react-native, @expo/vector-icons…).

function IconHome({ active }: { active: boolean }) {
  const c = active ? ORANGE : TEXT_MUTED;
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* 2×2 grid of squares = dashboard icon */}
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={[styles.iconSquare, { backgroundColor: c }]} />
        <View style={[styles.iconSquare, { backgroundColor: c }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 3 }}>
        <View style={[styles.iconSquare, { backgroundColor: c }]} />
        <View style={[styles.iconSquare, { backgroundColor: c }]} />
      </View>
    </View>
  );
}

function IconClients({ active }: { active: boolean }) {
  const c = active ? ORANGE : TEXT_MUTED;
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* Head */}
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: c, marginBottom: 2,
      }} />
      {/* Shoulders arc */}
      <View style={{
        width: 18, height: 7, borderRadius: 9,
        backgroundColor: c,
      }} />
    </View>
  );
}

function IconHistory({ active }: { active: boolean }) {
  const c = active ? ORANGE : TEXT_MUTED;
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bar chart icon */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <View style={{ width: 4, height: 8,  borderRadius: 2, backgroundColor: c }} />
        <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: c }} />
        <View style={{ width: 4, height: 11, borderRadius: 2, backgroundColor: c }} />
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: c }} />
      </View>
    </View>
  );
}

function IconProfile({ active }: { active: boolean }) {
  const c = active ? ORANGE : TEXT_MUTED;
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* Head */}
      <View style={{
        width: 9, height: 9, borderRadius: 4.5,
        backgroundColor: c, marginBottom: 2,
      }} />
      {/* Body / shoulders */}
      <View style={{
        width: 16, height: 6,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        backgroundColor: c,
      }} />
    </View>
  );
}

// ─── FAB (center action button) ──────────────────────────────────────────────
interface FABProps {
  onPress: () => void;
}

function FAB({ onPress }: FABProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      accessibilityLabel="Nouveau client"
      accessibilityRole="button"
      style={styles.fabTouchArea}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        {/* Plus icon */}
        <View style={styles.plusH} />
        <View style={styles.plusV} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Single tab button ────────────────────────────────────────────────────────
interface TabButtonProps {
  tab: Tab;
  active: boolean;
  onPress: () => void;
}

function TabButton({ tab, active, onPress }: TabButtonProps) {
  // Animated scale + opacity on activation
  const scale   = useRef(new Animated.Value(active ? 1 : 0.92)).current;
  const opacity = useRef(new Animated.Value(active ? 1 : 0.55)).current;
  // Dot indicator below active tab
  const dotScale = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 1 : 0.92,
        useNativeDriver: true,
        speed: 30,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: active ? 1 : 0.55,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: active ? 1 : 0,
        useNativeDriver: true,
        speed: 30,
        bounciness: 10,
      }),
    ]).start();
  }, [active]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={tab.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tabButton}
    >
      <Animated.View style={[
        styles.tabInner,
        active && styles.tabInnerActive,
        { transform: [{ scale }], opacity },
      ]}>
        {tab.icon(active)}
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </Animated.View>

      {/* Active indicator dot */}
      <Animated.View style={[styles.activeDot, { transform: [{ scale: dotScale }] }]} />
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface BottomNavBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  /** Called when the center FAB (+) is pressed */
  onAddPress?: () => void;
}

const TABS: Tab[] = [
  {
    key: 'home',
    label: 'Accueil',
    icon: (active) => <IconHome active={active} />,
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: (active) => <IconClients active={active} />,
  },
  // FAB slot goes here (rendered separately)
  {
    key: 'history',
    label: 'Historique',
    icon: (active) => <IconHistory active={active} />,
  },
  {
    key: 'profile',
    label: 'Profil',
    icon: (active) => <IconProfile active={active} />,
  },
];

export default function BottomNavBar({
  activeTab,
  onTabPress,
  onAddPress,
}: BottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const leftTabs  = TABS.slice(0, 2);   // home, clients
  const rightTabs = TABS.slice(2);       // history, profile

  return (
    <View style={[
      styles.container,
      { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
    ]}>
      {/* Left group */}
      <View style={styles.tabGroup}>
        {leftTabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onPress={() => onTabPress(tab.key)}
          />
        ))}
      </View>

      {/* Center FAB */}
      <FAB onPress={onAddPress ?? (() => {})} />

      {/* Right group */}
      <View style={styles.tabGroup}>
        {rightTabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onPress={() => onTabPress(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
    paddingHorizontal: 4,
    // Elevation for Android
    elevation: 12,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  tabGroup: {
    flex: 1,
    flexDirection: 'row',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 48, // minimum tap target
  },

  tabInner: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },

  tabInnerActive: {
    // subtle background on active tab
    backgroundColor: ORANGE_LIGHT,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
    includeFontPadding: false,
  },

  tabLabelActive: {
    color: ORANGE_DARK,
  },

  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ORANGE,
    marginTop: 3,
  },

  // ── FAB ──
  fabTouchArea: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    // lift fab above bar
    marginTop: -28,
  },

  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    // Android elevation
    elevation: 8,
  },

  plusH: {
    position: 'absolute',
    width: 20,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFF',
  },

  plusV: {
    position: 'absolute',
    width: 2.5,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: '#FFF',
  },

  // ── Icon sub-shapes ──
  iconSquare: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
});

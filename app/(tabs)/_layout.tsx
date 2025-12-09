import { Tabs } from "expo-router";
import { Home, Settings } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, getRoleAccentColor } from "@/constants/colors";
import HeaderSyncStatus from "@/components/HeaderSyncStatus";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const roleAccentColor = getRoleAccentColor(user?.role);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: '#666666',
        headerShown: true,
        tabBarShowLabel: false,

        headerStyle: {
          backgroundColor: Colors.headerBg,
          borderBottomWidth: 2,
          borderBottomColor: roleAccentColor,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: '600' as const,
          color: Colors.text,
        },
        headerTitleAlign: 'left',
        headerRight: () => <HeaderSyncStatus />,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8),
            height: Platform.OS === 'web' ? 60 : 60 + Math.max(insets.bottom, 0),
          }
        ],
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 2,
    borderTopColor: Colors.accent,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  tabBarIcon: {
    marginBottom: -4,
  },
});

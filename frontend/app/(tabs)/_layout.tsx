import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const unread = user?.unread_notifications || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#52525B',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <Ionicons name="map" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Agent',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <Ionicons name="megaphone" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="person" size={22} color={color} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#27272A',
    paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    height: Platform.OS === 'ios' ? 84 : 64,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  tabItem: { paddingTop: 4 },
  badge: {
    position: 'absolute', top: -4, right: -10,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
});

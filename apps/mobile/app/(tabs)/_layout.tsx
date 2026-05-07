import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0D0D1A', borderTopColor: '#1A1A2E' },
        tabBarActiveTintColor: '#5B4FE8',
        tabBarInactiveTintColor: '#6B6B8A',
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarLabel: 'Plan' }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarLabel: 'Log' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarLabel: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}

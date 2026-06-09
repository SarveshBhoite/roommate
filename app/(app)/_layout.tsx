import { Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { useEffect } from 'react';
import { Home, CheckSquare, DollarSign, MessageSquare, User } from 'lucide-react-native';
import tw from 'twrnc';

export default function AppLayout() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Not logged in -> send to login
        router.replace('/(auth)/login');
      } else if (!user?.roomId) {
        // Logged in but no room -> send to join room screen
        router.replace('/join-room');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-slate-50`}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!isAuthenticated || !user?.roomId) {
    return null; // Let the redirect handle it
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: tw`bg-white border-t border-slate-100 py-1.5 h-14`,
        tabBarLabelStyle: tw`text-xs font-semibold pb-1`,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chores"
        options={{
          title: 'Chores',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

    </Tabs>
  );
}

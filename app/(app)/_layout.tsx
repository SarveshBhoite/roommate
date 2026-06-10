import { Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { useEffect } from 'react';
import { Home, CheckSquare, DollarSign, MessageSquare, User } from 'lucide-react-native';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';

export default function AppLayout() {
  const { user, isLoading, isAuthenticated, lastViewedChat } = useAuth();
  const router = useRouter();

  // Queries for notification badges
  const { data: chores } = trpc.chore.list.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.roomId,
    refetchInterval: 10000,
  });
  const { data: swapRequests } = trpc.chore.listSwapRequests.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.roomId,
    refetchInterval: 10000,
  });
  const { data: bills } = trpc.bill.list.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.roomId,
    refetchInterval: 10000,
  });
  const { data: messages } = trpc.chat.getMessages.useQuery(undefined, {
    enabled: isAuthenticated && !!user?.roomId,
    refetchInterval: 5000,
  });

  // Calculate Badge Counts
  const choresBadgeCount =
    (chores
      ? chores.filter((chore: any) => {
          const activeUser = chore.rotationOrder[chore.currentIndex];
          return activeUser && activeUser._id === user?._id;
        }).length
      : 0) +
    (swapRequests ? swapRequests.length : 0);

  const billsBadgeCount = bills
    ? bills.filter((bill: any) => {
        const split = bill.splits.find((s: any) => s.userId?._id === user?._id);
        return split && split.status === 'unpaid';
      }).length
    : 0;

  const chatBadgeCount = messages
    ? messages.filter(
        (m: any) =>
          m.senderId !== user?._id &&
          (!lastViewedChat || new Date(m.createdAt) > new Date(lastViewedChat))
      ).length
    : 0;

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
        tabBarHideOnKeyboard: true,
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
          tabBarBadge: choresBadgeCount > 0 ? choresBadgeCount : undefined,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
          tabBarBadge: billsBadgeCount > 0 ? billsBadgeCount : undefined,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
          tabBarBadge: chatBadgeCount > 0 ? chatBadgeCount : undefined,
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

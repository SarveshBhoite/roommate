import { Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, View, Platform, Alert, Linking } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { useEffect } from 'react';
import { Home, CheckSquare, DollarSign, MessageSquare, User } from 'lucide-react-native';
import tw from 'twrnc';
import Constants from 'expo-constants';
import { trpc } from '@/lib/trpc';

export default function AppLayout() {
  const { user, isLoading, isAuthenticated, lastViewedChat } = useAuth();
  const router = useRouter();

  // In-App Update Check
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const { data: updateInfo } = trpc.health.checkUpdate.useQuery(
    { currentVersion },
    {
      enabled: isAuthenticated,
      refetchInterval: 600000, // Check every 10 minutes
    }
  );

  useEffect(() => {
    if (updateInfo?.needsUpdate) {
      Alert.alert(
        'Update Available 🚀',
        `A new version (${updateInfo.latestVersion}) of Hubmate is available. Please update now to get the latest features and bug fixes.`,
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Update Now', 
            onPress: () => {
              if (Platform.OS === 'android') {
                // Try opening the native Google Play Store app first
                Linking.openURL('market://details?id=com.hubmate.app').catch(() => {
                  Linking.openURL(updateInfo.updateUrl || 'https://play.google.com/store/apps/details?id=com.hubmate.app');
                });
              } else {
                Linking.openURL(updateInfo.updateUrl || 'https://play.google.com/store/apps/details?id=com.hubmate.app');
              }
            } 
          }
        ],
        { cancelable: false }
      );
    }
  }, [updateInfo]);

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
          const activeUser = chore.activeUser;
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
        <ActivityIndicator size="large" color="#721c3b" />
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
        tabBarActiveTintColor: '#721c3b',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: [
          tw`bg-white border-t border-slate-100`,
          Platform.OS === 'web'
            ? { height: 72, paddingBottom: 12, paddingTop: 6 }
            : tw`py-1.5 h-14`
        ],
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

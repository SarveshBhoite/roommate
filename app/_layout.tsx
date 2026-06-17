import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { trpc, trpcClient } from '@/lib/trpc';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('Project ID not found in Expo config. Check app.json.');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#721c3b',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

function RootLayoutNav() {
  const { isAuthenticated, user } = useAuth();
  const savePushToken = trpc.auth.savePushToken.useMutation();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Register for push notifications and save to DB
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          savePushToken.mutate({ token });
        }
      });

      // Handle notification clicks
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data && data.screen) {
          if (data.screen === 'chores') {
            router.push('/(app)/chores');
          } else if (data.screen === 'bills') {
            router.push('/(app)/bills');
          } else if (data.screen === 'home') {
            router.push('/');
          }
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [isAuthenticated, user]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const prepare = async () => {
      // Simulate splash time or initial setup
      await new Promise(resolve => setTimeout(resolve, 500));
      await SplashScreen.hideAsync().catch(() => {});
    };
    prepare();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

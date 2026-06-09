import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import tw from 'twrnc';

export default function RootIndex() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      } else if (!user?.roomId) {
        router.replace('/join-room');
      } else {
        router.replace('/(app)' as any);
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View style={tw`flex-1 items-center justify-center bg-slate-50`}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );
}

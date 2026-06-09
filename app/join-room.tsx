import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Home, LogOut, ArrowRight, UserCheck } from 'lucide-react-native';

export default function JoinRoomScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Lazy query to check the latest user state (e.g. if their join request has been approved)
  const { refetch, isFetching } = trpc.auth.me.useQuery(undefined, {
    enabled: false,
  });

  const handleRecheckStatus = async () => {
    try {
      const { data } = await refetch();
      if (data) {
        updateUser({
          _id: data._id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role as 'admin' | 'member',
          roomId: data.roomId,
          isOptedIn: data.isOptedIn,
        });

        if (data.roomId) {
          Alert.alert('Approved!', 'Your request to join the room has been approved.', [
            { text: 'Go to Dashboard', onPress: () => router.replace('/(app)' as any) }
          ]);
        } else {
          Alert.alert('Pending', 'Your request is still pending admin approval.');
        }
      } else {
        Alert.alert('Error', 'Could not fetch user status');
      }
    } catch (error: any) {
      Alert.alert('Error checking status', error.message || 'Something went wrong');
    }
  };

  const createMutation = trpc.room.create.useMutation({
    onSuccess: (data: any) => {
      setLoadingCreate(false);
      updateUser(data.user);
      Alert.alert('Room Created!', `Share your Room Code to invite roommates:\n\n${data.room.code}`, [
        { text: 'Enter Room', onPress: () => router.replace('/(app)' as any) }
      ]);
    },
    onError: (error: any) => {
      setLoadingCreate(false);
      Alert.alert('Failed to Create Room', error.message || 'Something went wrong');
    }
  });

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (data: any) => {
      setLoadingJoin(false);
      setIsPending(true);
      Alert.alert('Request Sent', 'Your request to join the room is pending admin approval.');
    },
    onError: (error: any) => {
      setLoadingJoin(false);
      Alert.alert('Failed to Join Room', error.message || 'Something went wrong');
    }
  });

  const handleCreate = () => {
    if (!roomName.trim()) {
      Alert.alert('Validation Error', 'Please enter a room name');
      return;
    }
    setLoadingCreate(true);
    createMutation.mutate({ name: roomName.trim() });
  };

  const handleJoin = () => {
    if (!roomCode.trim()) {
      Alert.alert('Validation Error', 'Please enter a room code');
      return;
    }
    setLoadingJoin(true);
    joinMutation.mutate({ code: roomCode.trim().toUpperCase() });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={tw`px-6 py-8 flex-grow justify-center`}>
        {/* Header */}
        <View style={tw`flex-row justify-between items-center mb-8`}>
          <View>
            <Text style={tw`text-2xl font-extrabold text-slate-800`}>Welcome, {user?.name}!</Text>
            <Text style={tw`text-sm text-slate-400 mt-1`}>To get started, create a room or join one.</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={tw`p-2 bg-slate-100 rounded-full`}>
            <LogOut size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {isPending ? (
          <View style={tw`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 items-center py-10`}>
            <View style={tw`w-14 h-14 bg-amber-50 rounded-2xl items-center justify-center mb-4`}>
              <UserCheck size={28} color="#f59e0b" />
            </View>
            <Text style={tw`text-lg font-bold text-slate-800`}>Awaiting Admin Approval</Text>
            <Text style={tw`text-sm text-slate-400 text-center mt-2 mb-6 px-4`}>
              Your request was sent. Once the room admin approves your profile, you will automatically enter the dashboard.
            </Text>
            <TouchableOpacity
              onPress={handleRecheckStatus}
              disabled={isFetching}
              style={tw`bg-slate-100 rounded-xl px-5 py-3 flex-row items-center justify-center`}
            >
              {isFetching ? (
                <ActivityIndicator size="small" color="#475569" style={tw`mr-2`} />
              ) : null}
              <Text style={tw`text-slate-700 font-semibold text-sm`}>
                {isFetching ? 'Checking...' : 'Recheck Status'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={tw`gap-6`}>
            {/* Card 1: Join Room */}
            <View style={tw`bg-white rounded-3xl p-6 shadow-sm border border-slate-100`}>
              <View style={tw`flex-row items-center gap-3 mb-4`}>
                <View style={tw`w-10 h-10 bg-indigo-50 rounded-xl items-center justify-center`}>
                  <ArrowRight size={20} color="#4f46e5" />
                </View>
                <Text style={tw`text-lg font-bold text-slate-800`}>Join Existing Room</Text>
              </View>
              <Text style={tw`text-xs text-slate-400 mb-4`}>
                Enter the 6-character code shared by your room's admin (e.g. APT101).
              </Text>
              <TextInput
                style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base font-bold uppercase tracking-wider mb-4 bg-slate-50`}
                placeholder="ENTER ROOM CODE"
                placeholderTextColor="#94a3b8"
                maxLength={6}
                value={roomCode}
                onChangeText={setRoomCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={tw`bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-indigo-100 ${loadingJoin ? 'opacity-80' : ''}`}
                onPress={handleJoin}
                disabled={loadingJoin}
              >
                {loadingJoin ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={tw`text-white font-bold text-sm`}>Request to Join</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={tw`flex-row items-center my-2`}>
              <View style={tw`flex-1 h-px bg-slate-200`} />
              <Text style={tw`mx-4 text-xs font-bold text-slate-400 uppercase`}>Or</Text>
              <View style={tw`flex-1 h-px bg-slate-200`} />
            </View>

            {/* Card 2: Create Room */}
            <View style={tw`bg-white rounded-3xl p-6 shadow-sm border border-slate-100`}>
              <View style={tw`flex-row items-center gap-3 mb-4`}>
                <View style={tw`w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center`}>
                  <Home size={20} color="#10b981" />
                </View>
                <Text style={tw`text-lg font-bold text-slate-800`}>Create New Room</Text>
              </View>
              <Text style={tw`text-xs text-slate-400 mb-4`}>
                Start a new room group. You will become the Admin and can approve other roommates.
              </Text>
              <TextInput
                style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm mb-4 bg-slate-50`}
                placeholder="e.g. Apartment 4B"
                placeholderTextColor="#94a3b8"
                value={roomName}
                onChangeText={setRoomName}
              />
              <TouchableOpacity
                style={tw`bg-emerald-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-emerald-100 ${loadingCreate ? 'opacity-80' : ''}`}
                onPress={handleCreate}
                disabled={loadingCreate}
              >
                {loadingCreate ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={tw`text-white font-bold text-sm`}>Create Room</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

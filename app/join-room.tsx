import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tw from 'twrnc';
import { trpc, formatError } from '@/lib/trpc';
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
      Alert.alert('Error checking status', formatError(error));
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
      Alert.alert('Failed to Create Room', formatError(error));
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
      Alert.alert('Failed to Join Room', formatError(error));
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}
      >
        <ScrollView contentContainerStyle={tw`px-6 py-10 flex-grow justify-center`} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={tw`flex-row justify-between items-center mb-8`}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-2xl font-black text-slate-900 tracking-tight`}>Welcome, {user?.name}!</Text>
              <Text style={tw`text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider`}>Create or join a roommate hub</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={tw`p-3.5 bg-white border border-slate-100 shadow-sm rounded-2xl`}>
              <LogOut size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {isPending ? (
            <View style={tw`bg-white rounded-[32px] p-8 shadow-xl shadow-slate-100/70 border border-slate-100/60 items-center py-12`}>
              <View style={tw`w-16 h-16 bg-amber-50 border border-amber-100 rounded-3xl items-center justify-center mb-5`}>
                <UserCheck size={30} color="#d97706" />
              </View>
              <Text style={tw`text-xl font-bold text-slate-900 tracking-tight`}>Awaiting Admin Approval</Text>
              <Text style={tw`text-sm text-slate-400 text-center mt-3 mb-8 px-2 leading-relaxed`}>
                Your join request was sent. Once the room admin approves your profile, you will automatically enter the dashboard.
              </Text>
              <TouchableOpacity
                onPress={handleRecheckStatus}
                disabled={isFetching}
                style={tw`bg-slate-900 rounded-2xl px-6 py-4 flex-row items-center justify-center w-full shadow-lg shadow-slate-900/10`}
              >
                {isFetching ? (
                  <ActivityIndicator size="small" color="#ffffff" style={tw`mr-2.5`} />
                ) : null}
                <Text style={tw`text-white font-bold text-sm tracking-wide uppercase`}>
                  {isFetching ? 'Checking Status...' : 'Recheck Status'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={tw`gap-6`}>
              {/* Card 1: Join Room */}
              <View style={tw`bg-white rounded-[32px] p-7 shadow-xl shadow-slate-100/70 border border-slate-100/60`}>
                <View style={tw`flex-row items-center gap-3.5 mb-4`}>
                  <View style={tw`w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-2xl items-center justify-center`}>
                    <ArrowRight size={20} color="#4f46e5" />
                  </View>
                  <Text style={tw`text-lg font-bold text-slate-900 tracking-tight`}>Join Existing Room</Text>
                </View>
                <Text style={tw`text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider`}>
                  Enter the 6-character code shared by your room admin.
                </Text>
                <TextInput
                  style={tw`bg-slate-50 border border-slate-200/50 rounded-2xl px-4 py-3.5 text-slate-900 text-base font-black uppercase tracking-widest mb-4 text-center`}
                  placeholder="ENTER ROOM CODE"
                  placeholderTextColor="#94a3b8"
                  maxLength={6}
                  value={roomCode}
                  onChangeText={setRoomCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={tw`bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center shadow-lg shadow-indigo-200/60 ${loadingJoin ? 'opacity-85' : ''}`}
                  onPress={handleJoin}
                  disabled={loadingJoin}
                >
                  {loadingJoin ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={tw`text-white font-bold text-sm tracking-wide uppercase`}>Request to Join</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={tw`flex-row items-center my-1`}>
                <View style={tw`flex-1 h-px bg-slate-200/60`} />
                <Text style={tw`mx-4 text-[10px] font-black text-slate-400 uppercase tracking-widest`}>Or</Text>
                <View style={tw`flex-1 h-px bg-slate-200/60`} />
              </View>

              {/* Card 2: Create Room */}
              <View style={tw`bg-white rounded-[32px] p-7 shadow-xl shadow-slate-100/70 border border-slate-100/60`}>
                <View style={tw`flex-row items-center gap-3.5 mb-4`}>
                  <View style={tw`w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl items-center justify-center`}>
                    <Home size={20} color="#10b981" />
                  </View>
                  <Text style={tw`text-lg font-bold text-slate-900 tracking-tight`}>Create New Room</Text>
                </View>
                <Text style={tw`text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider`}>
                  Start a new room group and invite your roommates.
                </Text>
                <TextInput
                  style={tw`bg-slate-50 border border-slate-200/50 rounded-2xl px-4 py-3.5 text-slate-900 text-sm mb-4`}
                  placeholder="e.g. Apartment 4B"
                  placeholderTextColor="#94a3b8"
                  value={roomName}
                  onChangeText={setRoomName}
                />
                <TouchableOpacity
                  style={tw`bg-emerald-600 rounded-2xl py-4 flex-row items-center justify-center shadow-lg shadow-emerald-200/60 ${loadingCreate ? 'opacity-85' : ''}`}
                  onPress={handleCreate}
                  disabled={loadingCreate}
                >
                  {loadingCreate ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={tw`text-white font-bold text-sm tracking-wide uppercase`}>Create Room</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

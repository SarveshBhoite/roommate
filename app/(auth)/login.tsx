import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tw from 'twrnc';
import { trpc, formatError } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Mail, Lock, LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data: any) => {
      await login(data.token, data.user);
      setLoading(false);
      
      // If user has a room, redirect to dashboard. Else, send to join/create room page.
      if (data.user.roomId) {
        router.replace('/(app)' as any);
      } else {
        router.replace('/join-room');
      }
    },
    onError: (error: any) => {
      setLoading(false);
      Alert.alert('Login Failed', formatError(error));
    }
  });

  const handleLogin = () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={tw`flex-1`}
      >
        <ScrollView 
          contentContainerStyle={tw`flex-grow justify-center px-6 py-12`}
          automaticallyAdjustKeyboardInsets={true}
        >
        {/* Brand/Header */}
        <View style={tw`items-center mb-10`}>
          <View style={tw`w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-200 mb-4`}>
            <LogIn size={32} color="#ffffff" />
          </View>
          <Text style={tw`text-2xl font-extrabold text-slate-800`}>Roommate Hub</Text>
          <Text style={tw`text-sm text-slate-400 mt-1`}>Manage chores, notices, & bills together</Text>
        </View>

        {/* Form */}
        <View style={tw`bg-white rounded-3xl p-6 shadow-sm border border-slate-100`}>
          <Text style={tw`text-lg font-bold text-slate-800 mb-6`}>Sign In</Text>

          {/* Email/Phone Input */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-2 uppercase`}>Email or Phone Number</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-4`}>
            <Mail size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-3 text-slate-800 text-sm`}
              placeholder="e.g. alex@mail.com or 9876543210"
              placeholderTextColor="#94a3b8"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-2 uppercase`}>Password</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-6`}>
            <Lock size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-3 text-slate-800 text-sm`}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-indigo-100 ${loading ? 'opacity-80' : ''}`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={tw`text-white font-bold text-base`}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={tw`flex-row justify-center mt-8`}>
          <Text style={tw`text-slate-400 text-sm`}>New roommate? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={tw`text-indigo-600 font-bold text-sm`}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

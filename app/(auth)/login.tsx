import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tw from 'twrnc';
import { trpc, formatError } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          contentContainerStyle={tw`flex-grow justify-center px-6 py-10`}
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand/Header */}
          <View style={tw`items-center mb-8`}>
            <View style={tw`w-20 h-20 bg-gradient-to-tr bg-indigo-600 rounded-[24px] items-center justify-center shadow-lg shadow-indigo-200 mb-5`}>
              <LogIn size={36} color="#ffffff" />
            </View>
            <Text style={tw`text-3xl font-black text-slate-900 tracking-tight`}>Roommate Hub</Text>
            <Text style={tw`text-xs font-semibold text-slate-400 mt-1.5 uppercase tracking-wider`}>Chores • Notices • Bills</Text>
          </View>

          {/* Form */}
          <View style={tw`bg-white rounded-[32px] p-8 shadow-xl shadow-slate-100/70 border border-slate-100/60`}>
            <Text style={tw`text-xl font-bold text-slate-900 tracking-tight mb-6`}>Sign In</Text>

            {/* Email/Phone Input */}
            <Text style={tw`text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider`}>Email or Phone Number</Text>
            <View style={tw`flex-row items-center bg-slate-50 border border-slate-200/50 rounded-2xl px-4 mb-4.5`}>
              <Mail size={18} color="#64748b" style={tw`mr-3`} />
              <TextInput
                style={tw`flex-1 py-3.5 text-slate-800 text-sm`}
                placeholder="e.g. alex@mail.com or 9876543210"
                placeholderTextColor="#94a3b8"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password Input */}
            <Text style={tw`text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider`}>Password</Text>
            <View style={tw`flex-row items-center bg-slate-50 border border-slate-200/50 rounded-2xl px-4 mb-7`}>
              <Lock size={18} color="#64748b" style={tw`mr-3`} />
              <TextInput
                style={tw`flex-1 py-3.5 text-slate-800 text-sm`}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={tw`p-1.5`}>
                {showPassword ? (
                  <EyeOff size={18} color="#64748b" />
                ) : (
                  <Eye size={18} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={tw`bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center shadow-lg shadow-indigo-200/60 ${loading ? 'opacity-85' : ''}`}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={tw`text-white font-bold text-sm tracking-wide uppercase`}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={tw`flex-row justify-center mt-8`}>
            <Text style={tw`text-slate-400 text-sm font-medium`}>New roommate? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={tw`text-indigo-600 font-bold text-sm`}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

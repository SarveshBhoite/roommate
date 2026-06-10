import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import tw from 'twrnc';
import { trpc, formatError } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { User, Mail, Phone, Lock, UserPlus, Eye, EyeOff } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data: any) => {
      await login(data.token, data.user);
      setLoading(false);
      router.replace('/join-room');
    },
    onError: (error: any) => {
      setLoading(false);
      Alert.alert('Registration Failed', formatError(error));
    }
  });

  const handleRegister = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 digits');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    registerMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password
    });
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
        {/* Header */}
        <View style={tw`items-center mb-8`}>
          <View style={tw`w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-200 mb-4`}>
            <UserPlus size={32} color="#ffffff" />
          </View>
          <Text style={tw`text-2xl font-extrabold text-slate-800`}>Get Started</Text>
          <Text style={tw`text-sm text-slate-400 mt-1`}>Create a profile to connect with roommates</Text>
        </View>

        {/* Form */}
        <View style={tw`bg-white rounded-3xl p-6 shadow-sm border border-slate-100`}>
          <Text style={tw`text-lg font-bold text-slate-800 mb-5`}>Register Profile</Text>

          {/* Name */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-1.5 uppercase`}>Full Name</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-3.5`}>
            <User size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-2.5 text-slate-800 text-sm`}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-1.5 uppercase`}>Email Address</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-3.5`}>
            <Mail size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-2.5 text-slate-800 text-sm`}
              placeholder="e.g. alex@mail.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Phone */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-1.5 uppercase`}>Phone Number</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-3.5`}>
            <Phone size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-2.5 text-slate-800 text-sm`}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Password */}
          <Text style={tw`text-xs font-semibold text-slate-500 mb-1.5 uppercase`}>Password</Text>
          <View style={tw`flex-row items-center border border-slate-200 rounded-xl px-3 mb-5.5`}>
            <Lock size={18} color="#94a3b8" style={tw`mr-2`} />
            <TextInput
              style={tw`flex-1 py-2.5 text-slate-800 text-sm`}
              placeholder="Min. 6 characters"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={tw`p-1.5`}>
              {showPassword ? (
                <EyeOff size={18} color="#94a3b8" />
              ) : (
                <Eye size={18} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-indigo-100 ${loading ? 'opacity-80' : ''}`}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={tw`text-white font-bold text-base`}>Register</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={tw`flex-row justify-center mt-6`}>
          <Text style={tw`text-slate-400 text-sm`}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={tw`text-indigo-600 font-bold text-sm`}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

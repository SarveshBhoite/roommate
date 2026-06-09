import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Send, RefreshCw, MessageSquare } from 'lucide-react-native';

export default function ChatScreen() {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Queries & Mutations
  const { data: messages, refetch: refetchMessages, isLoading: loadingMessages } = trpc.chat.getMessages.useQuery(undefined, {
    retry: false
  });

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setInputText('');
      setSending(false);
      refetchMessages().then(() => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      });
    },
    onError: () => {
      setSending(false);
    }
  });

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      refetchMessages();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refetchMessages().then(() => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
      });
    }, [])
  );

  const handleSend = () => {
    if (!inputText.trim()) return;
    setSending(true);
    sendMessageMutation.mutate({ message: inputText.trim() });
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Room Chat</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>Announcements & Chat</Text>
        </View>
        <TouchableOpacity onPress={() => refetchMessages()} style={tw`p-2 bg-slate-100 rounded-full`}>
          <RefreshCw size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Chat Feed */}
        {loadingMessages && !messages ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator size="small" color="#4f46e5" />
          </View>
        ) : !messages || messages.length === 0 ? (
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={tw`flex-grow items-center justify-center p-8`}
          >
            <MessageSquare size={36} color="#94a3b8" />
            <Text style={tw`text-slate-500 font-bold text-base mt-3`}>No Messages Yet</Text>
            <Text style={tw`text-slate-400 text-xs text-center mt-1`}>
              Say hello to your roommates! Messages will sync in real time.
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={tw`flex-1 px-4 py-3`}
            contentContainerStyle={tw`pb-6`}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg: any) => {
              const isMe = msg.senderId === user?._id;

              return (
                <View 
                  key={msg._id} 
                  style={tw`mb-4.5 max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  {/* Sender Name */}
                  {!isMe && (
                    <Text style={tw`text-[11px] font-bold text-slate-400 mb-1 ml-1`}>
                      {msg.senderName}
                    </Text>
                  )}

                  {/* Message Bubble */}
                  <View 
                    style={tw`rounded-2xl px-4 py-2.5 shadow-sm border ${
                      isMe 
                        ? 'bg-indigo-600 border-indigo-600 rounded-tr-none' 
                        : 'bg-white border-slate-100 rounded-tl-none'
                    }`}
                  >
                    <Text style={tw`text-sm leading-5 ${isMe ? 'text-white' : 'text-slate-800'}`}>
                      {msg.message}
                    </Text>
                  </View>

                  {/* Timestamp */}
                  <Text style={tw`text-[9px] text-slate-400 mt-1 mx-1.5`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Input Bar */}
        <View style={tw`flex-row items-center gap-2.5 px-4 py-3 bg-white border-t border-slate-100`}>
          <TextInput
            style={tw`flex-grow bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-slate-800 text-sm max-h-20`}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !inputText.trim()}
            style={tw`w-10 h-10 bg-indigo-600 rounded-full items-center justify-center shadow-lg shadow-indigo-100 ${
              !inputText.trim() ? 'opacity-55' : ''
            }`}
          >
            {sending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Send size={16} color="#ffffff" style={tw`ml-0.5`} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

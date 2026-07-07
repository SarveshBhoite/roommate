import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import tw from 'twrnc';
import * as ImagePicker from 'expo-image-picker';
import { trpc, formatError } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Send, RefreshCw, MessageSquare, Camera, X } from 'lucide-react-native';

export default function ChatScreen() {
  const { user, lastViewedChat, setLastViewedChat } = useAuth();
  const isFocused = useIsFocused();
  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Queries & Mutations
  const { data: messages, refetch: refetchMessages, isLoading: loadingMessages } = trpc.chat.getMessages.useQuery(undefined, {
    retry: false
  });

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setInputText('');
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setSending(false);
      refetchMessages().then(() => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      });
    },
    onError: (err: any) => {
      setSending(false);
      Alert.alert('Send Error', formatError(err));
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
      refetchMessages().then((res: any) => {
        if (res.data && res.data.length > 0) {
          const lastMsg = res.data[res.data.length - 1];
          if (lastMsg && lastMsg.createdAt !== lastViewedChat) {
            setLastViewedChat(lastMsg.createdAt);
          }
        }
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
      });
    }, [setLastViewedChat, lastViewedChat])
  );

  useEffect(() => {
    if (isFocused && messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.createdAt !== lastViewedChat) {
        setLastViewedChat(lastMsg.createdAt);
      }
    }
  }, [messages, isFocused, lastViewedChat, setLastViewedChat]);

function getMessageDateLabel(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

  const handlePickImage = async () => {
    Alert.alert(
      'Attach Photo',
      'Select where you want to choose the photo from:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera 📷',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera permission is required.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.3,
              base64: true
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImageUri(result.assets[0].uri);
              setSelectedImageBase64(result.assets[0].base64 || null);
            }
          }
        },
        {
          text: 'Photo Library 🖼️',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery permission is required.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.3,
              base64: true
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImageUri(result.assets[0].uri);
              setSelectedImageBase64(result.assets[0].base64 || null);
            }
          }
        }
      ]
    );
  };

  const handleSend = () => {
    if (!inputText.trim() && !selectedImageUri) return;
    setSending(true);

    const photoData = selectedImageBase64 ? `data:image/jpeg;base64,${selectedImageBase64}` : undefined;

    sendMessageMutation.mutate({
      message: inputText.trim() || undefined,
      photoBase64: photoData
    });
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#faf7f2]`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center shadow-sm shadow-slate-100`}>
        <View>
          <Text style={tw`text-[10px] font-bold text-[#721c3b] tracking-widest uppercase`}>Room Chat</Text>
          <Text style={tw`text-xl font-extrabold text-slate-900 tracking-tight mt-0.5`}>Group Discussion</Text>
        </View>
        <TouchableOpacity 
          onPress={() => refetchMessages()} 
          style={tw`p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl`}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color="#721c3b" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat Feed */}
        {loadingMessages && !messages ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator size="small" color="#721c3b" />
          </View>
        ) : !messages || messages.length === 0 ? (
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={tw`flex-grow items-center justify-center p-8`}
          >
            <View style={tw`w-16 h-16 bg-[#fdf3f5] rounded-2xl items-center justify-center mb-4`}>
              <MessageSquare size={28} color="#721c3b" />
            </View>
            <Text style={tw`text-slate-800 font-extrabold text-lg`}>No Messages Yet</Text>
            <Text style={tw`text-slate-500 text-sm text-center mt-2 max-w-[240px] leading-5`}>
              Start the conversation! Share updates, notes, or plan household tasks here.
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={tw`flex-1 px-4 py-4`}
            contentContainerStyle={tw`pb-8`}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg: any, index: number) => {
              const isMe = msg.senderId === user?._id;

              // Calculate if we need a date separator
              const currentDateStr = new Date(msg.createdAt).toDateString();
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevDateStr = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
              const showDateSeparator = currentDateStr !== prevDateStr;

              return (
                <View key={msg._id}>
                  {showDateSeparator && (
                    <View style={tw`self-center my-4 bg-[#f1ebdf] border border-[#e8dfcf] px-3.5 py-1.5 rounded-full shadow-sm`}>
                      <Text style={tw`text-[10px] font-black text-[#721c3b] tracking-wider uppercase`}>
                        {getMessageDateLabel(msg.createdAt)}
                      </Text>
                    </View>
                  )}

                  <View 
                    style={tw`mb-4 max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    {/* Sender Name */}
                    {!isMe && (
                      <Text style={tw`text-xs font-bold text-[#721c3b] mb-1 ml-1`}>
                        {msg.senderName}
                      </Text>
                    )}

                    {/* Message Bubble */}
                    <View 
                      style={tw`rounded-2xl p-1 shadow-sm ${
                        isMe 
                          ? 'bg-[#721c3b] rounded-tr-sm border border-[#5c162f]' 
                          : 'bg-white border border-slate-100 rounded-tl-sm'
                      }`}
                    >
                      {msg.imageUrl && (
                        <Image 
                          source={{ uri: msg.imageUrl }} 
                          style={tw`w-56 h-40 rounded-xl ${msg.message ? 'mb-1' : ''}`} 
                          resizeMode="cover"
                        />
                      )}
                      {msg.message ? (
                        <Text style={tw`text-sm leading-5 px-3 py-2 ${isMe ? 'text-white' : 'text-slate-800 font-medium'}`}>
                          {msg.message}
                        </Text>
                      ) : null}
                    </View>

                    {/* Timestamp */}
                    <Text style={tw`text-[10px] text-slate-400 mt-1 mx-1.5`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Selected image preview */}
        {selectedImageUri && (
          <View style={tw`px-4 py-3 bg-slate-50 border-t border-slate-100 flex-row items-center gap-3`}>
            <View style={tw`relative`}>
              <Image source={{ uri: selectedImageUri }} style={tw`w-14 h-14 rounded-xl`} />
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUri(null);
                  setSelectedImageBase64(null);
                }}
                style={tw`absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full items-center justify-center border border-white`}
              >
                <X size={10} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={tw`text-xs text-slate-500 font-semibold flex-1`}>Photo selected. Type a caption or press send.</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={tw`flex-row items-end gap-3 px-4 py-4.5 bg-white border-t border-slate-100`}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={tw`w-11 h-11 bg-slate-50 border border-slate-200 rounded-2xl items-center justify-center`}
            activeOpacity={0.7}
          >
            <Camera size={18} color="#721c3b" />
          </TouchableOpacity>

          <TextInput
            style={tw`flex-grow bg-slate-50 border border-slate-200 rounded-2xl px-4.5 py-2.5 text-slate-800 text-sm max-h-24 font-medium`}
            placeholder="Write a message..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || (!inputText.trim() && !selectedImageUri)}
            style={tw`w-11 h-11 bg-[#721c3b] rounded-2xl items-center justify-center shadow-md shadow-rose-900/20 ${
              (!inputText.trim() && !selectedImageUri) ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Send size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

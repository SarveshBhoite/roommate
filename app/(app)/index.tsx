import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { Bell, Home, Users, CheckCircle, Clock } from 'lucide-react-native';

export default function DashboardScreen() {
  const [marqueeText, setMarqueeText] = useState('');
  const scrollX = useRef(new Animated.Value(0)).current;
  const marqueeContainerWidth = useRef(0);
  const marqueeTextWidth = useRef(0);

  // Queries
  const { data: room, refetch: refetchRoom, isLoading: loadingRoom } = trpc.room.getRoomDetails.useQuery(undefined, {
    retry: false
  });
  const { data: members, refetch: refetchMembers, isLoading: loadingMembers } = trpc.room.listMembers.useQuery(undefined, {
    retry: false
  });
  const { data: logs, refetch: refetchLogs, isLoading: loadingLogs } = trpc.chore.getLogs.useQuery(undefined, {
    retry: false
  });

  // Re-fetch when screen becomes active
  useFocusEffect(
    React.useCallback(() => {
      refetchRoom();
      refetchMembers();
      refetchLogs();
    }, [])
  );

  useEffect(() => {
    if (room?.noticeMarquee) {
      setMarqueeText(room.noticeMarquee);
    } else {
      setMarqueeText('');
    }
  }, [room]);

  // Marquee Animation Controller
  useEffect(() => {
    if (!marqueeText) return;

    scrollX.setValue(350); // Start from off-screen right
    
    const startAnimation = () => {
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -350, // Scroll off-screen left
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    startAnimation();

    return () => scrollX.setValue(0);
  }, [marqueeText]);

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const getStatusColor = (isOptedIn: boolean) => {
    return isOptedIn ? 'bg-emerald-500' : 'bg-slate-400';
  };

  const getStatusText = (isOptedIn: boolean) => {
    return isOptedIn ? 'On Duty' : 'Away (Skipped)';
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header Banner */}
      <View style={tw`px-6 py-4 flex-row justify-between items-center bg-white border-b border-slate-100`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Roommate Hub</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>{room?.name || 'Loading Room...'}</Text>
        </View>
        <View style={tw`flex-row gap-2`}>
          {room?.code && (
            <View style={tw`bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100`}>
              <Text style={tw`text-xs font-bold text-indigo-600`}>Code: {room.code}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Notice Marquee Board */}
      {marqueeText ? (
        <View style={tw`bg-indigo-600 py-2.5 overflow-hidden flex-row border-b border-indigo-700`}>
          <Animated.View style={{ transform: [{ translateX: scrollX }], width: 600 }}>
            <Text style={tw`text-white text-xs font-bold tracking-wide`} numberOfLines={1}>
              📢 NOTICE: {marqueeText}
            </Text>
          </Animated.View>
        </View>
      ) : null}

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* Roommates presence list */}
        <View style={tw`mb-6`}>
          <Text style={tw`text-sm font-bold text-slate-600 mb-3 uppercase tracking-wider`}>Active Roommates</Text>
          {loadingMembers ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`gap-4`}>
              {members?.map((member: any) => (
                <View key={member._id} style={tw`bg-white px-4 py-3.5 rounded-2xl items-center shadow-sm border border-slate-100 w-28`}>
                  <View style={tw`w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center mb-2`}>
                    <Text style={tw`text-indigo-600 font-extrabold text-base`}>{getInitials(member.name)}</Text>
                  </View>
                  <Text style={tw`text-sm font-bold text-slate-800 text-center`} numberOfLines={1}>{member.name}</Text>
                  <View style={tw`flex-row items-center gap-1 mt-1.5`}>
                    <View style={tw`w-2 h-2 rounded-full ${getStatusColor(member.isOptedIn)}`} />
                    <Text style={tw`text-[10px] text-slate-500 font-medium`}>{member.role === 'admin' ? 'Admin' : getStatusText(member.isOptedIn)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Activity Logs Feed */}
        <View style={tw`mb-10`}>
          <Text style={tw`text-sm font-bold text-slate-600 mb-3 uppercase tracking-wider`}>Chore Activity Log</Text>
          <View style={tw`bg-white rounded-3xl p-5 shadow-sm border border-slate-100`}>
            {loadingLogs ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : !logs || logs.length === 0 ? (
              <View style={tw`items-center py-6`}>
                <Clock size={24} color="#94a3b8" />
                <Text style={tw`text-sm text-slate-400 mt-2 font-medium`}>No chores completed yet.</Text>
              </View>
            ) : (
              logs.map((log: any) => (
                <View key={log._id} style={tw`flex-row items-start gap-3.5 py-3 border-b border-slate-50`}>
                  <View style={tw`p-2 bg-emerald-50 rounded-xl mt-0.5`}>
                    <CheckCircle size={16} color="#10b981" />
                  </View>
                  <View style={tw`flex-grow`}>
                    <Text style={tw`text-sm font-semibold text-slate-800`}>
                      {log.userName} <Text style={tw`font-normal text-slate-500`}>completed</Text> {log.choreName}
                    </Text>
                    <Text style={tw`text-xs text-slate-400 mt-1`}>
                      {new Date(log.completedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

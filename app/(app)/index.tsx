import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, ActivityIndicator, FlatList, Clipboard, Alert, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { Bell, Home, Users, CheckCircle, Clock, Volume2, Copy, User, Camera, X } from 'lucide-react-native';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [marqueeText, setMarqueeText] = useState('');
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
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
  const { data: chores, refetch: refetchChores, isLoading: loadingChores } = trpc.chore.list.useQuery(undefined, {
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
      refetchChores();
      refetchLogs();
    }, [])
  );

  const copyToClipboard = () => {
    if (room?.code) {
      Clipboard.setString(room.code);
      Alert.alert('Code Copied!', 'Room Code has been copied to your clipboard.');
    }
  };

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
    <SafeAreaView style={tw`flex-1 bg-[#faf7f2]`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header Banner */}
      <View style={tw`px-6 py-4 flex-row justify-between items-center bg-white border-b border-slate-100/80 shadow-sm shadow-slate-100/10`}>
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-[10px] font-black text-[#721c3b] tracking-widest uppercase`}>Roommate Hub</Text>
          <Text style={tw`text-xl font-bold text-slate-900 tracking-tight`}>{room?.name || 'Loading Room...'}</Text>
        </View>
        {room?.code && (
          <TouchableOpacity 
            onPress={copyToClipboard}
            style={tw`bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5`}
          >
            <Text style={tw`text-xs font-bold text-slate-700 tracking-tight`}>Code: {room.code}</Text>
            <Copy size={13} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {/* Notice Marquee Board */}
      {marqueeText ? (
        <View style={tw`bg-[#4a1024] py-3 overflow-hidden flex-row border-b border-[#3c0d1e] items-center px-4`}>
          <Volume2 size={14} color="#f8d3de" style={tw`mr-2`} />
          <View style={tw`flex-1 overflow-hidden`}>
            <Animated.View style={{ transform: [{ translateX: scrollX }], width: 600 }}>
              <Text style={tw`text-slate-100 text-xs font-bold tracking-wide`} numberOfLines={1}>
                NOTICE: {marqueeText}
              </Text>
            </Animated.View>
          </View>
        </View>
      ) : null}

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* Roommates presence list */}
        <View style={tw`mb-6`}>
          <Text style={tw`text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Active Roommates</Text>
          {loadingMembers ? (
            <ActivityIndicator size="small" color="#721c3b" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`gap-3.5 py-1`}>
              {members?.map((member: any) => (
                <View key={member._id} style={tw`bg-white px-4 py-4 rounded-[24px] items-center border border-slate-100 shadow-sm shadow-slate-100/40 w-28`}>
                  <View style={tw`w-12 h-12 rounded-[18px] bg-[#fdf3f5] border border-[#f8e3e7] items-center justify-center mb-2.5`}>
                    <Text style={tw`text-[#721c3b] font-extrabold text-sm`}>{getInitials(member.name)}</Text>
                  </View>
                  <Text style={tw`text-xs font-bold text-slate-800 text-center`} numberOfLines={1}>{member.name}</Text>
                  <View style={tw`flex-row items-center gap-1.5 mt-2`}>
                    <View style={tw`w-1.5 h-1.5 rounded-full ${getStatusColor(member.isOptedIn)}`} />
                    <Text style={tw`text-[9px] text-slate-400 font-semibold uppercase tracking-wide`}>
                      {member.role === 'admin' ? 'Admin' : getStatusText(member.isOptedIn).split(' ')[0]}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Chore Rotations / Active Turns */}
        <View style={tw`mb-6`}>
          <Text style={tw`text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Active Chore Duties</Text>
          <View style={tw`bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm shadow-slate-100/40`}>
            {loadingChores ? (
              <ActivityIndicator size="small" color="#721c3b" />
            ) : !chores || chores.length === 0 ? (
              <View style={tw`items-center py-6`}>
                <Text style={tw`text-xs text-slate-400 font-bold`}>No active chore duties setup.</Text>
              </View>
            ) : (
              chores.map((chore: any, idx: number) => {
                const activeUser = chore.rotationOrder[chore.currentIndex];
                const isActiveUserSelf = activeUser?._id === user?._id;
                return (
                  <View 
                    key={chore._id} 
                    style={tw`flex-row justify-between items-center py-3.5 border-b border-slate-50 ${
                      idx === chores.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <View style={tw`w-2 h-2 rounded-full ${isActiveUserSelf ? 'bg-[#721c3b]' : 'bg-slate-300'}`} />
                      <Text style={tw`text-sm font-bold text-slate-700`}>{chore.name}</Text>
                    </View>
                    <View style={tw`flex-row items-center gap-2`}>
                      <View style={tw`px-3 py-1.5 rounded-xl flex-row items-center gap-1 bg-slate-50 border border-slate-100/60`}>
                        <User size={12} color="#64748b" />
                        <Text style={tw`text-xs font-semibold ${isActiveUserSelf ? 'text-[#721c3b]' : 'text-slate-600'}`}>
                          {activeUser ? activeUser.name : 'Nobody'} {isActiveUserSelf ? '(You)' : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Activity Logs Feed (Timeline Redesign) */}
        <View style={tw`mb-10`}>
          <Text style={tw`text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Activity History Log</Text>
          <View style={tw`bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm shadow-slate-100/40 relative`}>
            {loadingLogs ? (
              <ActivityIndicator size="small" color="#721c3b" />
            ) : !logs || logs.length === 0 ? (
              <View style={tw`items-center py-8`}>
                <Clock size={22} color="#94a3b8" />
                <Text style={tw`text-xs text-slate-400 mt-2 font-bold`}>No activity completed yet.</Text>
              </View>
            ) : (
              <View style={tw`relative pl-4`}>
                {/* Timeline Line */}
                <View style={tw`absolute left-1.5 top-2 bottom-2 w-px bg-slate-200/80`} />
                
                {logs.map((log: any) => {
                  const hasProof = !!log.imageUrl;
                  const formattedDate = new Date(log.completedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <View key={log._id} style={tw`mb-5 last:mb-0 relative`}>
                      {/* Timeline Bullet Node */}
                      <View style={tw`absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm`} />
                      
                      <View style={tw`flex-row justify-between items-start`}>
                        <View style={tw`flex-1 mr-3`}>
                          <Text style={tw`text-sm font-bold text-slate-800`}>
                            {log.userName} <Text style={tw`font-medium text-slate-400`}>completed</Text> {log.choreName}
                          </Text>
                          <Text style={tw`text-[10px] text-slate-400 font-semibold mt-1`}>{formattedDate}</Text>
                        </View>
                        {hasProof && (
                          <TouchableOpacity
                            onPress={() => setActivePhotoUrl(log.imageUrl)}
                            style={tw`bg-[#fdf3f5]/80 border border-[#f8e3e7] px-2.5 py-1 rounded-xl flex-row items-center gap-1`}
                          >
                            <Camera size={11} color="#721c3b" />
                            <Text style={tw`text-[10px] font-extrabold text-[#721c3b]`}>Proof</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Photo Proof Viewer Modal */}
      <Modal
        visible={!!activePhotoUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePhotoUrl(null)}
      >
        <View style={tw`flex-1 bg-slate-950/90 justify-center items-center p-6`}>
          <TouchableOpacity
            style={tw`absolute top-12 right-6 p-3 bg-white/10 rounded-full flex-row items-center gap-1`}
            onPress={() => setActivePhotoUrl(null)}
          >
            <X size={16} color="#ffffff" />
            <Text style={tw`text-white font-bold text-xs`}>Close</Text>
          </TouchableOpacity>
          {activePhotoUrl && (
            <Image
              source={{ uri: activePhotoUrl }}
              style={tw`w-full h-4/5 rounded-3xl border border-white/5 shadow-2xl`}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

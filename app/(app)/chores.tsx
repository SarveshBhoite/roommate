import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import * as ImagePicker from 'expo-image-picker';
import { trpc, formatError } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { CheckSquare, ArrowLeftRight, Check, X, RefreshCw, Settings, User } from 'lucide-react-native';

export default function ChoresScreen() {
  const { user } = useAuth();
  
  // Modal states
  const [selectedChore, setSelectedChore] = useState<any | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedChoreToEdit, setSelectedChoreToEdit] = useState<any | null>(null);
  const [editedRotationUsers, setEditedRotationUsers] = useState<string[]>([]);

  // Queries & Mutations
  const { data: chores, refetch: refetchChores, isLoading: loadingChores } = trpc.chore.list.useQuery(undefined, {
    retry: false
  });
  const { data: swapRequests, refetch: refetchSwaps, isLoading: loadingSwaps } = trpc.chore.listSwapRequests.useQuery(undefined, {
    retry: false
  });
  const { data: members, refetch: refetchMembers } = trpc.room.listMembers.useQuery(undefined, {
    retry: false
  });

  const markDoneMutation = trpc.chore.markDone.useMutation({
    onSuccess: () => {
      refetchChores();
      Alert.alert('Success', 'Chore completed! Active turn rotated.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  const swapRequestMutation = trpc.chore.createSwapRequest.useMutation({
    onSuccess: () => {
      setSwapModalVisible(false);
      Alert.alert('Request Sent', 'Swap request sent successfully! Awaiting response.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  const respondSwapMutation = trpc.chore.respondToSwap.useMutation({
    onSuccess: (data: any) => {
      refetchChores();
      refetchSwaps();
      Alert.alert('Success', data.status === 'accepted' ? 'Swap request accepted!' : 'Swap request declined.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  const updateRotationMutation = trpc.chore.updateRotation.useMutation({
    onSuccess: () => {
      refetchChores();
      setEditModalVisible(false);
      Alert.alert('Chore Updated', 'Chore rotation sequence has been updated successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  const deleteChoreMutation = trpc.chore.delete.useMutation({
    onSuccess: () => {
      refetchChores();
      setEditModalVisible(false);
      Alert.alert('Chore Deleted', 'The chore has been deleted successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  useFocusEffect(
    React.useCallback(() => {
      refetchChores();
      refetchSwaps();
      refetchMembers();
    }, [])
  );

  const handleMarkDone = async (choreId: string) => {
    Alert.alert(
      'Photo Proof Required',
      'Please take a photo proof of the completed chore to submit as validation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Launch Camera 📷',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera permission is required to submit photo proof.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.25, // Compress image to reduce base64 size for fast upload
                base64: true,
              });

              if (!result.canceled && result.assets && result.assets[0]?.base64) {
                const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                markDoneMutation.mutate({ choreId, photoBase64: base64Image });
              }
            } catch (error: any) {
              Alert.alert('Camera Error', error.message || 'Failed to capture photo');
            }
          }
        }
      ]
    );
  };

  const openSwapModal = (chore: any) => {
    setSelectedChore(chore);
    setSwapModalVisible(true);
  };

  const openEditModal = (chore: any) => {
    setSelectedChoreToEdit(chore);
    // Initialize sequence check order from originalRotationOrder if populated, else rotationOrder
    const currentOrderIds = chore.originalRotationOrder 
      ? chore.originalRotationOrder.map((m: any) => m._id) 
      : chore.rotationOrder.map((m: any) => m._id);
    setEditedRotationUsers(currentOrderIds);
    setEditModalVisible(true);
  };

  const handleSendSwapRequest = (toUserId: string) => {
    if (!selectedChore) return;
    swapRequestMutation.mutate({
      choreId: selectedChore._id,
      toUserId
    });
  };

  const handleRespondSwap = (requestId: string, accept: boolean) => {
    respondSwapMutation.mutate({ requestId, accept });
  };

  const handleUpdateRotation = () => {
    if (!selectedChoreToEdit) return;
    if (editedRotationUsers.length === 0) {
      Alert.alert('Validation Error', 'You must select at least 1 roommate for the chore loop');
      return;
    }
    updateRotationMutation.mutate({
      choreId: selectedChoreToEdit._id,
      rotationOrder: editedRotationUsers
    });
  };

  const handleDeleteChore = () => {
    if (!selectedChoreToEdit) return;

    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm(`Are you sure you want to delete the chore "${selectedChoreToEdit.name}"? This will delete all completion logs and active swap requests.`);
      if (confirmDelete) {
        deleteChoreMutation.mutate({ choreId: selectedChoreToEdit._id });
      }
    } else {
      Alert.alert(
        'Delete Chore',
        `Are you sure you want to delete "${selectedChoreToEdit.name}"? This will permanently delete all logs and pending swap requests for this chore.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: () => deleteChoreMutation.mutate({ choreId: selectedChoreToEdit._id }) 
          }
        ]
      );
    }
  };

  const toggleEditUserCheckbox = (id: string) => {
    setEditedRotationUsers(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  // Helper: check if a user index in rotationOrder appears AFTER the current active index
  const getEligibleSwapUsers = (chore: any) => {
    if (!chore) return [];
    return chore.rotationOrder.filter((m: any) => m._id !== user?._id);
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#faf7f2]`} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100/80 flex-row justify-between items-center shadow-sm shadow-slate-100/15`}>
        <View>
          <Text style={tw`text-[10px] font-black text-[#721c3b] tracking-widest uppercase`}>Roommate Chores</Text>
          <Text style={tw`text-xl font-bold text-slate-900 tracking-tight`}>Work Rotations</Text>
        </View>
        <TouchableOpacity onPress={() => { refetchChores(); refetchSwaps(); }} style={tw`p-2.5 bg-slate-50 border border-slate-100 rounded-full shadow-sm`}>
          <RefreshCw size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* Pending Swap Requests */}
        {swapRequests && swapRequests.length > 0 && (
          <View style={tw`mb-6`}>
            <Text style={tw`text-[10px] font-black text-amber-600 mb-3 uppercase tracking-wider`}>Incoming Swap Requests</Text>
            {swapRequests.map((req: any) => (
              <View key={req._id} style={tw`bg-amber-50/70 rounded-2xl p-4 border border-amber-100 flex-row justify-between items-center mb-3 shadow-sm`}>
                <View style={tw`flex-1 mr-3`}>
                  <Text style={tw`text-sm font-bold text-amber-900`}>{req.fromUserId.name} requests swap</Text>
                  <Text style={tw`text-xs text-amber-700 font-medium mt-1`}>Chore: {req.choreId.name}</Text>
                </View>
                <View style={tw`flex-row gap-2`}>
                  <TouchableOpacity
                    onPress={() => handleRespondSwap(req._id, false)}
                    style={tw`p-2.5 bg-white rounded-xl border border-amber-200`}
                  >
                    <X size={15} color="#d97706" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespondSwap(req._id, true)}
                    style={tw`p-2.5 bg-amber-600 rounded-xl`}
                  >
                    <Check size={15} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Chores List */}
        <Text style={tw`text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Active Chores</Text>
        {loadingChores ? (
          <ActivityIndicator size="small" color="#721c3b" />
        ) : !chores || chores.length === 0 ? (
          <View style={tw`bg-white rounded-[24px] p-8 items-center border border-slate-100 shadow-sm shadow-slate-100/40`}>
            <CheckSquare size={32} color="#94a3b8" />
            <Text style={tw`text-slate-700 font-bold text-sm mt-3`}>No Chores Setup</Text>
            <Text style={tw`text-slate-400 text-xs text-center mt-1.5 leading-relaxed px-4`}>
              Ask the room admin to create chore lists and assign roommates rotation loops.
            </Text>
          </View>
        ) : (
          chores.map((chore: any) => {
            const activeUser = chore.activeUser;
            const isMyTurn = activeUser?._id === user?._id;

            return (
              <View key={chore._id} style={tw`bg-white rounded-[28px] p-5.5 mb-4 border border-slate-100 shadow-sm shadow-slate-100/40`}>
                <View style={tw`flex-row justify-between items-center mb-4.5`}>
                  <View style={tw`flex-1 mr-2`}>
                    <Text style={tw`text-base font-bold text-slate-900 tracking-tight`}>{chore.name}</Text>
                    <Text style={tw`text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider`}>Sequence Loop</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-2`}>
                    {user?.role === 'admin' && (
                      <TouchableOpacity 
                        onPress={() => openEditModal(chore)}
                        style={tw`bg-slate-50 border border-slate-100 p-2 rounded-xl flex-row items-center shadow-sm`}
                      >
                        <Settings size={14} color="#64748b" />
                      </TouchableOpacity>
                    )}
                    <View style={tw`bg-[#fdf3f5] border border-[#f8e3e7] px-3 py-1.5 rounded-xl flex-row items-center gap-1`}>
                      <User size={12} color="#721c3b" />
                      <Text style={tw`text-[10px] font-bold text-[#721c3b] uppercase`}>Turn: {activeUser?.name || 'None'}</Text>
                    </View>
                  </View>
                </View>

                {/* Member sequence indicator */}
                <View style={tw`flex-row flex-wrap gap-2 py-3 mb-4 border-t border-b border-slate-50`}>
                  {chore.rotationOrder.map((m: any, idx: number) => {
                    const isActive = m._id === activeUser?._id;
                    return (
                      <View
                        key={m._id}
                        style={tw`flex-row items-center px-3 py-2 rounded-xl border ${
                          isActive 
                            ? 'bg-[#721c3b] border-[#721c3b] shadow-md shadow-rose-900/10' 
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <Text style={tw`text-[11px] font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                          {idx + 1}. {m.name} {!m.isOptedIn && '(Away)'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Action layout */}
                {isMyTurn ? (
                  <View style={tw`flex-row gap-3 mt-1`}>
                    <TouchableOpacity
                      onPress={() => openSwapModal(chore)}
                      style={tw`flex-row items-center justify-center border border-slate-200 rounded-2xl px-4 py-3.5 flex-1 gap-2 bg-slate-50 shadow-sm`}
                    >
                      <ArrowLeftRight size={16} color="#721c3b" />
                      <Text style={tw`text-[#721c3b] font-bold text-xs uppercase tracking-wider`}>Swap Turn</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleMarkDone(chore._id)}
                      style={tw`flex-row items-center justify-center bg-[#721c3b] rounded-2xl px-4 py-3.5 flex-2 gap-2 shadow-lg shadow-rose-900/20`}
                    >
                      <Check size={16} color="#ffffff" />
                      <Text style={tw`text-white font-bold text-xs uppercase tracking-wider`}>Mark Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={tw`text-xs text-slate-400 font-medium italic mt-1 text-center`}>
                    Waiting for {activeUser?.name} to complete loop turn.
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Swap Turn Modal Selection */}
      <Modal
        visible={swapModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSwapModalVisible(false)}
      >
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 shadow-2xl`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`text-lg font-bold text-slate-900 tracking-tight`}>Swap Turn</Text>
              <TouchableOpacity onPress={() => setSwapModalVisible(false)} style={tw`p-1 bg-slate-50 border border-slate-100 rounded-full shadow-sm`}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={tw`text-xs text-slate-400 font-semibold mb-4`}>
              Rule: You can only swap turns with roommates scheduled after you in this cycle.
            </Text>

            {selectedChore && getEligibleSwapUsers(selectedChore).length === 0 ? (
              <Text style={tw`text-xs text-slate-400 font-semibold py-8 text-center italic`}>
                No eligible roommates found after you in the current loop.
              </Text>
            ) : (
              <FlatList
                data={selectedChore ? getEligibleSwapUsers(selectedChore) : []}
                keyExtractor={(item: any) => item._id}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    onPress={() => handleSendSwapRequest(item._id)}
                    style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-50`}
                  >
                    <View style={tw`flex-row items-center gap-3`}>
                      <View style={tw`w-8 h-8 rounded-full bg-slate-100 items-center justify-center border border-slate-200/50`}>
                        <Text style={tw`text-slate-600 font-black text-xs`}>{item.name[0]}</Text>
                      </View>
                      <Text style={tw`text-sm font-semibold text-slate-800`}>{item.name}</Text>
                    </View>
                    <ArrowLeftRight size={15} color="#721c3b" />
                  </TouchableOpacity>
                )}
                style={tw`max-h-60 mb-4`}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ADMIN EDIT CHORE ROTATION MODAL */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 max-h-[85%] shadow-2xl`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-900 tracking-tight`}>Chore Loop Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={tw`p-1 bg-slate-50 border border-slate-100 rounded-full`}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={tw`text-xs text-slate-400 font-semibold mb-4.5`}>
              Configure the default original loop order. Add new members or edit sequence.
            </Text>

            {/* Selected sequence display */}
            {editedRotationUsers.length > 0 && (
              <View style={tw`bg-[#fdf3f5]/70 p-4 rounded-2xl mb-5 border border-[#f8e3e7]`}>
                <Text style={tw`text-[10px] font-black text-[#721c3b] uppercase tracking-wider mb-2`}>Configured Loop Order:</Text>
                <Text style={tw`text-xs font-semibold text-slate-700 leading-relaxed`}>
                  {editedRotationUsers.map((uid, idx) => {
                    const name = members?.find((m: any) => m._id === uid)?.name || '';
                    return `${idx + 1}. ${name}`;
                  }).join(' ➔ ')}
                </Text>
              </View>
            )}

            <Text style={tw`text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider`}>Select Roommates (order dictates sequence)</Text>
            <ScrollView style={tw`max-h-50 mb-5`}>
              {members?.map((m: any) => {
                const isChecked = editedRotationUsers.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleEditUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-50`}
                  >
                    <Text style={tw`text-sm font-semibold text-slate-700`}>{m.name}</Text>
                    <View style={tw`w-5 h-5 rounded-md border items-center justify-center ${isChecked ? 'bg-[#721c3b] border-[#721c3b]' : 'border-slate-300'}`}>
                      {isChecked && <Check size={10} color="#ffffff" style={{ alignSelf: 'center' }} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleUpdateRotation}
              style={tw`bg-[#721c3b] rounded-2xl py-4 items-center justify-center shadow-lg shadow-rose-900/20`}
            >
              <Text style={tw`text-white font-bold text-sm uppercase tracking-wider`}>Save Sequence</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteChore}
              style={tw`border border-red-200 rounded-2xl py-4 items-center justify-center mt-3 bg-red-50/50`}
            >
              {deleteChoreMutation.isPending || deleteChoreMutation.isLoading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={tw`text-red-600 font-bold text-sm uppercase tracking-wider`}>Delete Chore</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay for Chore Verification Upload */}
      {(markDoneMutation.isLoading || markDoneMutation.isPending) && (
        <View style={tw`absolute inset-0 bg-slate-950/60 items-center justify-center z-50`}>
          <View style={tw`bg-white p-6 rounded-[24px] shadow-2xl items-center border border-slate-100`}>
            <ActivityIndicator size="large" color="#721c3b" />
            <Text style={tw`text-slate-900 font-bold text-sm mt-3`}>Uploading Photo Proof...</Text>
            <Text style={tw`text-slate-400 text-xs mt-1.5`}>Please wait, updating chore turns</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

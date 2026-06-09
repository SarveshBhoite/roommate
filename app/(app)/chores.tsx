import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { CheckSquare, ArrowLeftRight, Check, X, RefreshCw, Settings } from 'lucide-react-native';

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
      Alert.alert('Error', err.message || 'Could not complete task');
    }
  });

  const swapRequestMutation = trpc.chore.createSwapRequest.useMutation({
    onSuccess: () => {
      setSwapModalVisible(false);
      Alert.alert('Request Sent', 'Swap request sent successfully! Awaiting response.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not send swap request');
    }
  });

  const respondSwapMutation = trpc.chore.respondToSwap.useMutation({
    onSuccess: (data: any) => {
      refetchChores();
      refetchSwaps();
      Alert.alert('Success', data.status === 'accepted' ? 'Swap request accepted!' : 'Swap request declined.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Action failed');
    }
  });

  const updateRotationMutation = trpc.chore.updateRotation.useMutation({
    onSuccess: () => {
      refetchChores();
      setEditModalVisible(false);
      Alert.alert('Chore Updated', 'Chore rotation sequence has been updated successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not update chore sequence');
    }
  });

  useFocusEffect(
    React.useCallback(() => {
      refetchChores();
      refetchSwaps();
      refetchMembers();
    }, [])
  );

  const handleMarkDone = (choreId: string) => {
    markDoneMutation.mutate({ choreId });
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

  const toggleEditUserCheckbox = (id: string) => {
    setEditedRotationUsers(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  // Helper: check if a user index in rotationOrder appears AFTER the current active index
  const getEligibleSwapUsers = (chore: any) => {
    if (!chore) return [];
    const fromIndex = chore.currentIndex;
    return chore.rotationOrder.filter((m: any, idx: number) => idx > fromIndex);
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Roommate Chores</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>Work Rotations</Text>
        </View>
        <TouchableOpacity onPress={() => { refetchChores(); refetchSwaps(); }} style={tw`p-2 bg-slate-100 rounded-full`}>
          <RefreshCw size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* Pending Swap Requests */}
        {swapRequests && swapRequests.length > 0 && (
          <View style={tw`mb-6`}>
            <Text style={tw`text-sm font-bold text-amber-600 mb-3 uppercase tracking-wider`}>Incoming Swap Requests</Text>
            {swapRequests.map((req: any) => (
              <View key={req._id} style={tw`bg-amber-50 rounded-2xl p-4 border border-amber-100 flex-row justify-between items-center mb-3 shadow-sm`}>
                <View style={tw`flex-1 mr-3`}>
                  <Text style={tw`text-sm font-bold text-amber-900`}>{req.fromUserId.name} wants to swap</Text>
                  <Text style={tw`text-xs text-amber-700 mt-1`}>Chore: {req.choreId.name}</Text>
                </View>
                <View style={tw`flex-row gap-2`}>
                  <TouchableOpacity
                    onPress={() => handleRespondSwap(req._id, false)}
                    style={tw`p-2.5 bg-white rounded-xl border border-amber-200`}
                  >
                    <X size={16} color="#d97706" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespondSwap(req._id, true)}
                    style={tw`p-2.5 bg-amber-600 rounded-xl`}
                  >
                    <Check size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Chores List */}
        <Text style={tw`text-sm font-bold text-slate-600 mb-3 uppercase tracking-wider`}>Active Chores</Text>
        {loadingChores ? (
          <ActivityIndicator size="small" color="#4f46e5" />
        ) : !chores || chores.length === 0 ? (
          <View style={tw`bg-white rounded-3xl p-8 items-center border border-slate-100 shadow-sm`}>
            <CheckSquare size={36} color="#94a3b8" />
            <Text style={tw`text-slate-500 font-bold text-base mt-3`}>No Chores Setup</Text>
            <Text style={tw`text-slate-400 text-xs text-center mt-1`}>
              Ask the room admin to create chore lists and assign roommates rotation loops.
            </Text>
          </View>
        ) : (
          chores.map((chore: any) => {
            const activeUser = chore.rotationOrder[chore.currentIndex];
            const isMyTurn = activeUser?._id === user?._id;

            return (
              <View key={chore._id} style={tw`bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100`}>
                <View style={tw`flex-row justify-between items-center mb-3`}>
                  <View style={tw`flex-1 mr-2`}>
                    <Text style={tw`text-base font-bold text-slate-800`}>{chore.name}</Text>
                    <Text style={tw`text-xs text-slate-400 mt-0.5`}>Current cycle: temporary swaps reset next loop</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-2`}>
                    {user?.role === 'admin' && (
                      <TouchableOpacity 
                        onPress={() => openEditModal(chore)}
                        style={tw`bg-slate-100 p-2 rounded-xl flex-row items-center`}
                      >
                        <Settings size={14} color="#64748b" />
                      </TouchableOpacity>
                    )}
                    <View style={tw`bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100`}>
                      <Text style={tw`text-[10px] font-bold text-indigo-600 uppercase`}>Turn: {activeUser?.name || 'None'}</Text>
                    </View>
                  </View>
                </View>

                {/* Member sequence indicator */}
                <View style={tw`flex-row flex-wrap gap-2.5 py-2 mb-3 border-t border-slate-50 border-b`}>
                  {chore.rotationOrder.map((m: any, idx: number) => {
                    const isActive = idx === chore.currentIndex;
                    return (
                      <View
                        key={m._id}
                        style={tw`flex-row items-center px-2.5 py-1.5 rounded-xl border ${
                          isActive 
                            ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-100' 
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <Text style={tw`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>
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
                      style={tw`flex-row items-center justify-center border border-indigo-200 rounded-xl px-4 py-3 flex-1 gap-2 bg-indigo-50/50`}
                    >
                      <ArrowLeftRight size={18} color="#4f46e5" />
                      <Text style={tw`text-indigo-600 font-bold text-sm`}>Swap Turn</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleMarkDone(chore._id)}
                      style={tw`flex-row items-center justify-center bg-indigo-600 rounded-xl px-4 py-3 flex-2 gap-2 shadow-lg shadow-indigo-100`}
                    >
                      <Check size={18} color="#ffffff" />
                      <Text style={tw`text-white font-bold text-sm`}>Mark Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={tw`text-xs text-slate-400 font-medium italic mt-1.5 text-center`}>
                    Waiting for {activeUser?.name}'s completion to advance loop.
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
        <View style={tw`flex-1 bg-black/40 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>Select Roommate to Swap With</Text>
              <TouchableOpacity onPress={() => setSwapModalVisible(false)} style={tw`p-1`}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={tw`text-xs text-slate-400 mb-4`}>
              Rule: You can only swap turns with roommates scheduled after you in this cycle.
            </Text>

            {selectedChore && getEligibleSwapUsers(selectedChore).length === 0 ? (
              <Text style={tw`text-sm text-slate-500 italic py-6 text-center`}>
                No eligible roommates found after you in the current loop.
              </Text>
            ) : (
              <FlatList
                data={selectedChore ? getEligibleSwapUsers(selectedChore) : []}
                keyExtractor={(item: any) => item._id}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    onPress={() => handleSendSwapRequest(item._id)}
                    style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                  >
                    <View style={tw`flex-row items-center gap-3`}>
                      <View style={tw`w-8 h-8 rounded-full bg-slate-100 items-center justify-center`}>
                        <Text style={tw`text-slate-600 font-bold text-xs`}>{item.name[0]}</Text>
                      </View>
                      <Text style={tw`text-sm font-semibold text-slate-800`}>{item.name}</Text>
                    </View>
                    <ArrowLeftRight size={16} color="#4f46e5" />
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
        <View style={tw`flex-1 bg-black/40 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>Manage Chore Loop Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={tw`text-xs text-slate-400 mb-4`}>
              Configure the default original loop order. Add new members or edit sequence.
            </Text>

            {/* Selected sequence display */}
            {editedRotationUsers.length > 0 && (
              <View style={tw`bg-indigo-50 p-3.5 rounded-2xl mb-4 border border-indigo-100`}>
                <Text style={tw`text-xs font-bold text-indigo-600 mb-1`}>Configured Loop Order:</Text>
                <Text style={tw`text-sm font-semibold text-indigo-950`}>
                  {editedRotationUsers.map((uid, idx) => {
                    const name = members?.find((m: any) => m._id === uid)?.name || '';
                    return `${idx + 1}. ${name}`;
                  }).join(' ➔ ')}
                </Text>
              </View>
            )}

            <Text style={tw`text-xs font-bold text-slate-400 mb-2 uppercase`}>Select roommates (order of clicks dictates sequence)</Text>
            <ScrollView style={tw`max-h-50 mb-5`}>
              {members?.map((m: any) => {
                const isChecked = editedRotationUsers.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleEditUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
                  >
                    <Text style={tw`text-sm font-semibold text-slate-700`}>{m.name}</Text>
                    <View style={tw`w-5 h-5 border rounded flex items-center justify-center ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isChecked && <Check size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleUpdateRotation}
              style={tw`bg-indigo-600 rounded-xl py-3.5 items-center`}
            >
              <Text style={tw`text-white font-bold`}>Save Sequence</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

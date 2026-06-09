import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { 
  User, 
  LogOut, 
  Settings, 
  UserPlus, 
  PlusCircle, 
  FileText, 
  Volume2, 
  X, 
  Check, 
  Trash2, 
  ShieldAlert,
  Megaphone
} from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  
  // Opt-out Switch State
  const [optIn, setOptIn] = useState(user?.isOptedIn ?? true);
  const [loadingToggle, setLoadingToggle] = useState(false);

  // Modals Visibility
  const [approvalsModal, setApprovalsModal] = useState(false);
  const [createChoreModal, setCreateChoreModal] = useState(false);
  const [createBillModal, setCreateBillModal] = useState(false);
  const [editNoticeModal, setEditNoticeModal] = useState(false);

  // Form states for Admin Panels
  const [noticeText, setNoticeText] = useState('');
  const [choreName, setChoreName] = useState('');
  const [selectedChoreUsers, setSelectedChoreUsers] = useState<string[]>([]);
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [selectedBillUsers, setSelectedBillUsers] = useState<string[]>([]);

  // Queries
  const { data: room, refetch: refetchRoom } = trpc.room.getRoomDetails.useQuery(undefined, {
    retry: false
  });
  const { data: members, refetch: refetchMembers } = trpc.room.listMembers.useQuery(undefined, {
    retry: false
  });
  const { data: pendingMembers, refetch: refetchPending } = trpc.room.getPendingMembers.useQuery(undefined, {
    enabled: user?.role === 'admin',
    retry: false
  });

  // Mutations
  const toggleOptMutation = trpc.chore.toggleOptOut.useMutation({
    onSuccess: (data: any) => {
      setOptIn(data.isOptedIn);
      updateUser({ ...user!, isOptedIn: data.isOptedIn });
      setLoadingToggle(false);
    }
  });

  const approveMutation = trpc.room.approveMember.useMutation({
    onSuccess: () => {
      refetchPending();
      refetchMembers();
      Alert.alert('Approved', 'Roommate approved successfully!');
    }
  });

  const rejectMutation = trpc.room.rejectMember.useMutation({
    onSuccess: () => {
      refetchPending();
      Alert.alert('Rejected', 'Request declined.');
    }
  });

  const updateNoticeMutation = trpc.room.updateNotice.useMutation({
    onSuccess: () => {
      setEditNoticeModal(false);
      refetchRoom();
      Alert.alert('Notice Updated', 'Marquee announcement has been updated.');
    }
  });

  const createChoreMutation = trpc.chore.create.useMutation({
    onSuccess: () => {
      setCreateChoreModal(false);
      setChoreName('');
      setSelectedChoreUsers([]);
      Alert.alert('Chore Loop Created', 'Work rotation is now active.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not create chore');
    }
  });

  const createBillMutation = trpc.bill.create.useMutation({
    onSuccess: () => {
      setCreateBillModal(false);
      setBillTitle('');
      setBillAmount('');
      setSelectedBillUsers([]);
      Alert.alert('Bill Shared', 'Split contribution has been sent to roommates.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not split bill');
    }
  });

  const kickMutation = trpc.room.kickMember.useMutation({
    onSuccess: () => {
      refetchMembers();
      Alert.alert('Roommate Removed', 'Roommate kicked successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message);
    }
  });

  useFocusEffect(
    React.useCallback(() => {
      refetchRoom();
      refetchMembers();
      if (user?.role === 'admin') {
        refetchPending();
      }
    }, [])
  );

  const handleToggleOpt = (val: boolean) => {
    setLoadingToggle(true);
    toggleOptMutation.mutate({ optIn: val });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  // Admin Actions
  const handleApprove = (targetUserId: string) => {
    approveMutation.mutate({ targetUserId });
  };

  const handleReject = (targetUserId: string) => {
    rejectMutation.mutate({ targetUserId });
  };

  const handleUpdateNotice = () => {
    updateNoticeMutation.mutate({ notice: noticeText.trim() });
  };

  const handleCreateChore = () => {
    if (!choreName.trim() || selectedChoreUsers.length === 0) {
      Alert.alert('Validation Error', 'Please specify a name and select at least one roommate');
      return;
    }
    createChoreMutation.mutate({
      name: choreName.trim(),
      rotationOrder: selectedChoreUsers
    });
  };

  const handleCreateBill = () => {
    const amountNum = parseFloat(billAmount);
    if (!billTitle.trim() || isNaN(amountNum) || amountNum <= 0 || selectedBillUsers.length === 0) {
      Alert.alert('Validation Error', 'Please check split details and select at least one roommate');
      return;
    }
    createBillMutation.mutate({
      title: billTitle.trim(),
      totalAmount: amountNum,
      userIds: selectedBillUsers
    });
  };

  const handleKickUser = (targetUserId: string, name: string) => {
    Alert.alert(
      'Remove Roommate',
      `Are you sure you want to remove ${name} from this room?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => kickMutation.mutate({ targetUserId }) }
      ]
    );
  };

  const toggleChoreUserCheckbox = (id: string) => {
    setSelectedChoreUsers(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const toggleBillUserCheckbox = (id: string) => {
    setSelectedBillUsers(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Roommate Settings</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>Profile & Controls</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={tw`p-2 bg-rose-50 rounded-full`}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* User Card */}
        <View style={tw`bg-white rounded-3xl p-5 mb-5 shadow-sm border border-slate-100 flex-row items-center gap-4`}>
          <View style={tw`w-14 h-14 bg-indigo-50 rounded-2xl items-center justify-center`}>
            <User size={28} color="#4f46e5" />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-lg font-bold text-slate-800`}>{user?.name}</Text>
            <Text style={tw`text-xs text-slate-400 mt-0.5`}>{user?.email} | {user?.phone}</Text>
            <Text style={tw`text-[10px] font-bold text-indigo-600 uppercase mt-1`}>Role: {user?.role}</Text>
          </View>
        </View>

        {/* Room Info & Opt Out Toggle */}
        <View style={tw`bg-white rounded-3xl p-5 mb-5 shadow-sm border border-slate-100`}>
          <Text style={tw`text-sm font-bold text-slate-800 mb-4`}>Room Preferences</Text>
          
          <View style={tw`flex-row justify-between items-center py-2.5 border-b border-slate-50`}>
            <View>
              <Text style={tw`text-sm font-semibold text-slate-800`}>Room Code</Text>
              <Text style={tw`text-xs text-slate-400 mt-0.5`}>Share this with roommates to join</Text>
            </View>
            <Text style={tw`text-base font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg`}>
              {room?.code || 'RM-N/A'}
            </Text>
          </View>

          <View style={tw`flex-row justify-between items-center py-3`}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-sm font-semibold text-slate-800`}>Duty Status (Opt-In)</Text>
              <Text style={tw`text-xs text-slate-400 mt-0.5`}>
                Disable if you are away. You will be skipped in all chore loops.
              </Text>
            </View>
            {loadingToggle ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <Switch
                value={optIn}
                onValueChange={handleToggleOpt}
                trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
                thumbColor={optIn ? '#4f46e5' : '#f1f5f9'}
              />
            )}
          </View>
        </View>

        {/* Admin Section (Admin Only) */}
        {user?.role === 'admin' && (
          <View style={tw`mb-10`}>
            <View style={tw`flex-row items-center gap-2 mb-3`}>
              <ShieldAlert size={18} color="#ef4444" />
              <Text style={tw`text-sm font-bold text-slate-800 uppercase tracking-wider`}>Admin Panel Controls</Text>
            </View>
            
            <View style={tw`bg-white rounded-3xl p-5 shadow-sm border border-slate-100 gap-3`}>
              {/* Approvals */}
              <TouchableOpacity
                onPress={() => setApprovalsModal(true)}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
              >
                <View style={tw`flex-row items-center gap-3.5`}>
                  <UserPlus size={18} color="#4f46e5" />
                  <Text style={tw`text-sm font-bold text-slate-700`}>Manage Join Requests</Text>
                </View>
                {pendingMembers && pendingMembers.length > 0 && (
                  <View style={tw`bg-amber-500 rounded-full px-2 py-0.5`}>
                    <Text style={tw`text-[10px] text-white font-extrabold`}>{pendingMembers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Notice Board */}
              <TouchableOpacity
                onPress={() => {
                  setNoticeText(room?.noticeMarquee || '');
                  setEditNoticeModal(true);
                }}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
              >
                <View style={tw`flex-row items-center gap-3.5`}>
                  <Megaphone size={18} color="#4f46e5" />
                  <Text style={tw`text-sm font-bold text-slate-700`}>Edit Notice Board Marquee</Text>
                </View>
              </TouchableOpacity>

              {/* Create Chore Loop */}
              <TouchableOpacity
                onPress={() => setCreateChoreModal(true)}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
              >
                <View style={tw`flex-row items-center gap-3.5`}>
                  <PlusCircle size={18} color="#4f46e5" />
                  <Text style={tw`text-sm font-bold text-slate-700`}>Create Work Loop</Text>
                </View>
              </TouchableOpacity>

              {/* Split New Bill */}
              <TouchableOpacity
                onPress={() => setCreateBillModal(true)}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
              >
                <View style={tw`flex-row items-center gap-3.5`}>
                  <FileText size={18} color="#4f46e5" />
                  <Text style={tw`text-sm font-bold text-slate-700`}>Split Shared Bill</Text>
                </View>
              </TouchableOpacity>

              {/* Kick Members List */}
              <View style={tw`mt-2`}>
                <Text style={tw`text-xs font-bold text-slate-400 mb-2 uppercase`}>Kick Roommates</Text>
                {members?.filter((m: any) => m._id !== user?._id).map((m: any) => (
                  <View key={m._id} style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-sm font-semibold text-slate-700`}>{m.name}</Text>
                    <TouchableOpacity onPress={() => handleKickUser(m._id, m.name)} style={tw`p-1.5 bg-rose-50 rounded-lg`}>
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ADMIN MODAL 1: Join Approvals */}
      <Modal visible={approvalsModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/55 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[75%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>Pending Room Requests</Text>
              <TouchableOpacity onPress={() => setApprovalsModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {pendingMembers && pendingMembers.length === 0 ? (
              <Text style={tw`text-slate-400 text-sm text-center py-10 font-medium`}>No pending requests.</Text>
            ) : (
              <ScrollView>
                {pendingMembers?.map((m: any) => (
                  <View key={m._id} style={tw`flex-row justify-between items-center py-3 border-b border-slate-100`}>
                    <View style={tw`flex-1 mr-2`}>
                      <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                      <Text style={tw`text-xs text-slate-400 mt-0.5`}>{m.phone}</Text>
                    </View>
                    <View style={tw`flex-row gap-2`}>
                      <TouchableOpacity onPress={() => handleReject(m._id)} style={tw`p-2 bg-slate-100 rounded-xl`}>
                        <X size={16} color="#64748b" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleApprove(m._id)} style={tw`p-2 bg-indigo-600 rounded-xl`}>
                        <Check size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 2: Edit Notice board */}
      <Modal visible={editNoticeModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/55 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>Edit Notice Banner</Text>
              <TouchableOpacity onPress={() => setEditNoticeModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm mb-5 bg-slate-50`}
              placeholder="e.g. Please turn off geyser after use. Next owner visit Sunday."
              placeholderTextColor="#94a3b8"
              value={noticeText}
              onChangeText={setNoticeText}
            />

            <TouchableOpacity onPress={handleUpdateNotice} style={tw`bg-indigo-600 rounded-xl py-3.5 items-center`}>
              <Text style={tw`text-white font-bold`}>Save Announcement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 3: Create Chore Loop */}
      <Modal visible={createChoreModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/55 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>New Work Loop Rotation</Text>
              <TouchableOpacity onPress={() => setCreateChoreModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm mb-4 bg-slate-50`}
              placeholder="Chore Title (e.g. Garbage Disposal)"
              placeholderTextColor="#94a3b8"
              value={choreName}
              onChangeText={setChoreName}
            />

            {/* Selected sequence display */}
            {selectedChoreUsers.length > 0 && (
              <View style={tw`bg-indigo-50 p-3.5 rounded-2xl mb-4 border border-indigo-100`}>
                <Text style={tw`text-xs font-bold text-indigo-600 mb-1`}>Selected Loop Order:</Text>
                <Text style={tw`text-sm font-semibold text-indigo-950`}>
                  {selectedChoreUsers.map((uid, idx) => {
                    const name = members?.find((m: any) => m._id === uid)?.name || '';
                    return `${idx + 1}. ${name}`;
                  }).join(' ➔ ')}
                </Text>
              </View>
            )}

            <Text style={tw`text-xs font-bold text-slate-400 mb-2 uppercase`}>Select loop participants & order (order of clicks dictates sequence)</Text>
            <ScrollView style={tw`max-h-50 mb-5`}>
              {members?.map((m: any) => {
                const isChecked = selectedChoreUsers.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleChoreUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
                  >
                    <Text style={tw`text-sm font-semibold text-slate-700`}>{m.name}</Text>
                    <View style={tw`w-5 h-5 border rounded flex-center ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isChecked && <Check size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={handleCreateChore} style={tw`bg-indigo-600 rounded-xl py-3.5 items-center`}>
              <Text style={tw`text-white font-bold`}>Start Chore Loop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 4: Create Split Bill */}
      <Modal visible={createBillModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/55 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-bold text-slate-800`}>Create Shared Bill Split</Text>
              <TouchableOpacity onPress={() => setCreateBillModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm mb-3.5 bg-slate-50`}
              placeholder="Expense Description (e.g. Wifi June)"
              placeholderTextColor="#94a3b8"
              value={billTitle}
              onChangeText={setBillTitle}
            />

            <TextInput
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm mb-4 bg-slate-50`}
              placeholder="Total Shared Cost (INR)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={billAmount}
              onChangeText={setBillAmount}
            />

            <Text style={tw`text-xs font-bold text-slate-400 mb-2 uppercase`}>Select Roommates in split</Text>
            <ScrollView style={tw`max-h-50 mb-5`}>
              {members?.map((m: any) => {
                const isChecked = selectedBillUsers.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleBillUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3 border-b border-slate-50`}
                  >
                    <Text style={tw`text-sm font-semibold text-slate-700`}>{m.name}</Text>
                    <View style={tw`w-5 h-5 border rounded flex-center ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isChecked && <Check size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={handleCreateBill} style={tw`bg-indigo-600 rounded-xl py-3.5 items-center`}>
              <Text style={tw`text-white font-bold`}>Split cost equally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

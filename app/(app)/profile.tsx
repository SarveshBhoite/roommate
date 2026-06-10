import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import tw from 'twrnc';
import { trpc, formatError } from '@/lib/trpc';
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
  Megaphone,
  ChevronRight
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
  const [transferAdminModal, setTransferAdminModal] = useState(false);

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
      Alert.alert('Error', formatError(err));
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
      Alert.alert('Error', formatError(err));
    }
  });

  const kickMutation = trpc.room.kickMember.useMutation({
    onSuccess: () => {
      refetchMembers();
      Alert.alert('Roommate Removed', 'Roommate kicked successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
    }
  });

  const transferAdminMutation = trpc.room.transferAdmin.useMutation({
    onSuccess: (data: any) => {
      setTransferAdminModal(false);
      updateUser({ ...user!, role: 'member' });
      Alert.alert('Admin Transferred', data.message || 'You are now a regular member.');
    },
    onError: (err: any) => {
      Alert.alert('Error', formatError(err));
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

  const handleTransferAdmin = (targetUserId: string, name: string) => {
    Alert.alert(
      'Transfer Admin Rights',
      `Are you sure you want to transfer Admin rights to ${name}? This action CANNOT be undone, and you will lose admin privileges.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Transfer Role', 
          style: 'destructive', 
          onPress: () => transferAdminMutation.mutate({ targetUserId }) 
        }
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
    <SafeAreaView style={tw`flex-1 bg-[#faf7f2]`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center shadow-sm shadow-slate-100`}>
        <View>
          <Text style={tw`text-[10px] font-bold text-[#721c3b] tracking-widest uppercase`}>Roommate Settings</Text>
          <Text style={tw`text-xl font-extrabold text-slate-900 tracking-tight mt-0.5`}>Profile & Controls</Text>
        </View>
        <TouchableOpacity 
          onPress={handleLogout} 
          style={tw`p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl`}
          activeOpacity={0.7}
        >
          <LogOut size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* User Card */}
        <View style={tw`bg-white rounded-2xl p-5 mb-5 shadow-sm border border-slate-100 flex-row items-center gap-4.5`}>
          <View style={tw`w-14 h-14 bg-[#fdf3f5] rounded-xl items-center justify-center border border-[#f8e3e7]`}>
            <User size={24} color="#721c3b" />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>{user?.name}</Text>
            <Text style={tw`text-xs text-slate-500 font-medium mt-0.5`}>{user?.email} • {user?.phone}</Text>
            <View style={tw`flex-row mt-2`}>
              <View style={tw`bg-[#fdf3f5] px-2.5 py-0.5 rounded-md border border-[#f8e3e7]/55`}>
                <Text style={tw`text-[10px] font-extrabold text-[#721c3b] uppercase`}>{user?.role}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Room Info & Opt Out Toggle */}
        <View style={tw`bg-white rounded-2xl p-5 mb-6 shadow-sm border border-slate-100`}>
          <Text style={tw`text-xs font-bold text-slate-400 uppercase tracking-widest mb-4`}>Room Preferences</Text>
          
          <View style={tw`flex-row justify-between items-center py-3.5 border-b border-slate-100`}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-sm font-bold text-slate-800`}>Room Code</Text>
              <Text style={tw`text-xs text-slate-500 font-medium mt-0.5`}>Share code to add new roommates</Text>
            </View>
            <View style={tw`bg-[#fdf3f5] border border-[#f8e3e7] px-3 py-1.5 rounded-xl`}>
              <Text style={tw`text-sm font-extrabold text-[#721c3b] tracking-wide`}>
                {room?.code || 'RM-N/A'}
              </Text>
            </View>
          </View>

          <View style={tw`flex-row justify-between items-center py-3.5`}>
            <View style={tw`flex-1 mr-4`}>
              <Text style={tw`text-sm font-bold text-slate-800`}>Duty Status (Opt-In)</Text>
              <Text style={tw`text-xs text-slate-500 font-medium mt-0.5`}>
                Temporary opt-out. When disabled, you will be automatically skipped in chore loops.
              </Text>
            </View>
            {loadingToggle ? (
              <ActivityIndicator size="small" color="#721c3b" />
            ) : (
              <Switch
                value={optIn}
                onValueChange={handleToggleOpt}
                trackColor={{ false: '#e2e8f0', true: '#f8d3de' }}
                thumbColor={optIn ? '#721c3b' : '#cbd5e1'}
              />
            )}
          </View>
        </View>

        {/* Admin Section (Admin Only) */}
        {user?.role === 'admin' && (
          <View style={tw`mb-10`}>
            <View style={tw`flex-row items-center gap-2 mb-3.5`}>
              <View style={tw`w-7 h-7 bg-red-50 rounded-lg items-center justify-center border border-red-100`}>
                <ShieldAlert size={14} color="#ef4444" />
              </View>
              <Text style={tw`text-[10px] font-bold text-slate-400 uppercase tracking-widest`}>Admin Panel Controls</Text>
            </View>
            
            <View style={tw`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 gap-3`}>
              {/* Approvals */}
              <TouchableOpacity
                onPress={() => setApprovalsModal(true)}
                style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                  <View style={tw`w-9 h-9 bg-[#fdf3f5] rounded-xl items-center justify-center border border-[#f8e3e7]/55`}>
                    <UserPlus size={18} color="#721c3b" />
                  </View>
                  <View>
                    <Text style={tw`text-sm font-bold text-slate-800`}>Manage Join Requests</Text>
                    <Text style={tw`text-xs text-slate-500 font-medium`}>Approve or reject pending room members</Text>
                  </View>
                </View>
                <View style={tw`flex-row items-center gap-1.5`}>
                  {pendingMembers && pendingMembers.length > 0 && (
                    <View style={tw`bg-amber-500 rounded-full px-2 py-0.5`}>
                      <Text style={tw`text-[10px] text-white font-extrabold`}>{pendingMembers.length}</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color="#94a3b8" />
                </View>
              </TouchableOpacity>

              {/* Notice Board */}
              <TouchableOpacity
                onPress={() => {
                  setNoticeText(room?.noticeMarquee || '');
                  setEditNoticeModal(true);
                }}
                style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                  <View style={tw`w-9 h-9 bg-[#fdf3f5] rounded-xl items-center justify-center border border-[#f8e3e7]/55`}>
                    <Megaphone size={18} color="#721c3b" />
                  </View>
                  <View>
                    <Text style={tw`text-sm font-bold text-slate-800`}>Edit Announcement Board</Text>
                    <Text style={tw`text-xs text-slate-500 font-medium`}>Set notice marquee shown to all users</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#94a3b8" />
              </TouchableOpacity>

              {/* Create Chore Loop */}
              <TouchableOpacity
                onPress={() => setCreateChoreModal(true)}
                style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                  <View style={tw`w-9 h-9 bg-[#fdf3f5] rounded-xl items-center justify-center border border-[#f8e3e7]/55`}>
                    <PlusCircle size={18} color="#721c3b" />
                  </View>
                  <View>
                    <Text style={tw`text-sm font-bold text-slate-800`}>Create Work Loop</Text>
                    <Text style={tw`text-xs text-slate-500 font-medium`}>Add chore rotation with a custom order</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#94a3b8" />
              </TouchableOpacity>

              {/* Split New Bill */}
              <TouchableOpacity
                onPress={() => setCreateBillModal(true)}
                style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                  <View style={tw`w-9 h-9 bg-[#fdf3f5] rounded-xl items-center justify-center border border-[#f8e3e7]/55`}>
                    <FileText size={18} color="#721c3b" />
                  </View>
                  <View>
                    <Text style={tw`text-sm font-bold text-slate-800`}>Split Shared Bill</Text>
                    <Text style={tw`text-xs text-slate-500 font-medium`}>Add a new shared expense split</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#94a3b8" />
              </TouchableOpacity>

              {/* Transfer Admin */}
              <TouchableOpacity
                onPress={() => setTransferAdminModal(true)}
                style={tw`flex-row items-center justify-between py-3.5 border-b border-slate-100`}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                  <View style={tw`w-9 h-9 bg-rose-50 rounded-xl items-center justify-center border border-rose-100/50`}>
                    <User size={18} color="#ef4444" />
                  </View>
                  <View>
                    <Text style={tw`text-sm font-bold text-slate-800`}>Transfer Admin Role</Text>
                    <Text style={tw`text-xs text-slate-500 font-medium`}>Handover admin authority to a roommate</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#94a3b8" />
              </TouchableOpacity>

              {/* Kick Members List */}
              <View style={tw`mt-4`}>
                <Text style={tw`text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest`}>Kick Roommates</Text>
                {members?.filter((m: any) => m._id !== user?._id).length === 0 ? (
                  <Text style={tw`text-slate-400 text-xs py-2 font-medium`}>No other roommates to manage.</Text>
                ) : (
                  members?.filter((m: any) => m._id !== user?._id).map((m: any) => (
                    <View key={m._id} style={tw`flex-row justify-between items-center py-2.5 border-b border-slate-50 last:border-0`}>
                      <View style={tw`flex-row items-center gap-2.5`}>
                        <View style={tw`w-8 h-8 bg-slate-50 rounded-lg items-center justify-center border border-slate-100`}>
                          <Text style={tw`text-xs font-bold text-slate-600`}>{m.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View>
                          <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                          <Text style={tw`text-[10px] text-slate-500`}>{m.phone || 'No phone'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleKickUser(m._id, m.name)} 
                        style={tw`p-2 bg-rose-50 hover:bg-rose-100 rounded-xl`}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ADMIN MODAL 1: Join Approvals */}
      <Modal visible={approvalsModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-xl max-h-[75%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>Pending Join Requests</Text>
              <TouchableOpacity 
                onPress={() => setApprovalsModal(false)}
                style={tw`p-2 bg-slate-50 border border-slate-100 rounded-xl`}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {pendingMembers && pendingMembers.length === 0 ? (
              <Text style={tw`text-slate-400 text-sm text-center py-10 font-semibold`}>No pending requests.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {pendingMembers?.map((m: any) => (
                  <View key={m._id} style={tw`flex-row justify-between items-center py-3 border-b border-slate-100 last:border-0`}>
                    <View style={tw`flex-1 mr-3 flex-row items-center gap-2.5`}>
                      <View style={tw`w-8 h-8 bg-[#fdf3f5] rounded-lg items-center justify-center border border-[#f8e3e7]/55`}>
                        <Text style={tw`text-xs font-bold text-[#721c3b]`}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                        <Text style={tw`text-[10px] text-slate-500 font-semibold mt-0.5`}>{m.phone || 'No phone'}</Text>
                      </View>
                    </View>
                    <View style={tw`flex-row gap-2`}>
                      <TouchableOpacity 
                        onPress={() => handleReject(m._id)} 
                        style={tw`p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl`}
                        activeOpacity={0.7}
                      >
                        <X size={14} color="#64748b" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleApprove(m._id)} 
                        style={tw`p-2.5 bg-[#721c3b] hover:bg-rose-900 rounded-xl shadow-sm shadow-rose-900/10`}
                        activeOpacity={0.7}
                      >
                        <Check size={14} color="#ffffff" />
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
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-xl`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>Edit Notice Banner</Text>
              <TouchableOpacity 
                onPress={() => setEditNoticeModal(false)}
                style={tw`p-2 bg-slate-50 border border-slate-100 rounded-xl`}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm mb-5 bg-slate-50 font-medium`}
              placeholder="e.g. Please turn off geyser after use. Next owner visit Sunday."
              placeholderTextColor="#94a3b8"
              value={noticeText}
              onChangeText={setNoticeText}
              multiline
            />

            <TouchableOpacity 
              onPress={handleUpdateNotice} 
              style={tw`bg-[#721c3b] rounded-2xl py-4 items-center shadow-md shadow-rose-900/10`}
              activeOpacity={0.8}
            >
              <Text style={tw`text-white font-bold text-sm`}>Save Announcement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 3: Create Chore Loop */}
      <Modal visible={createChoreModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-xl max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>New Work Loop Rotation</Text>
              <TouchableOpacity 
                onPress={() => setCreateChoreModal(false)}
                style={tw`p-2 bg-slate-50 border border-slate-100 rounded-xl`}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm mb-4 bg-slate-50 font-medium`}
              placeholder="Chore Title (e.g. Garbage Disposal)"
              placeholderTextColor="#94a3b8"
              value={choreName}
              onChangeText={setChoreName}
            />

            {/* Selected sequence display */}
            {selectedChoreUsers.length > 0 && (
              <View style={tw`bg-[#fdf3f5]/70 p-4 rounded-2xl mb-4 border border-[#f8e3e7]/55`}>
                <Text style={tw`text-[10px] font-bold text-[#721c3b] mb-2 tracking-wider uppercase`}>Loop Sequence Order:</Text>
                <View style={tw`flex-row flex-wrap items-center gap-1.5`}>
                  {selectedChoreUsers.map((uid, idx) => {
                    const name = members?.find((m: any) => m._id === uid)?.name || '';
                    return (
                      <View key={uid} style={tw`flex-row items-center`}>
                        <View style={tw`bg-[#721c3b] px-2.5 py-1 rounded-lg border border-[#5c162f]`}>
                          <Text style={tw`text-xs font-bold text-white`}>{idx + 1}. {name}</Text>
                        </View>
                        {idx < selectedChoreUsers.length - 1 && (
                          <Text style={tw`text-slate-400 text-xs mx-1`}>➔</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={tw`text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider`}>
              Select participants (Click in the order of rotation)
            </Text>
            <ScrollView style={tw`max-h-50 mb-5`} showsVerticalScrollIndicator={false}>
              {members?.map((m: any) => {
                const isChecked = selectedChoreUsers.includes(m._id);
                const orderIndex = selectedChoreUsers.indexOf(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleChoreUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3 border-b border-slate-50 last:border-0`}
                    activeOpacity={0.7}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <View style={tw`w-8 h-8 bg-slate-50 rounded-lg items-center justify-center border border-slate-100`}>
                        <Text style={tw`text-xs font-bold text-slate-600`}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                    </View>
                    <View style={tw`w-5.5 h-5.5 border rounded-lg items-center justify-center ${
                      isChecked ? 'bg-[#721c3b] border-[#721c3b]' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && (
                        <Text style={tw`text-[10px] font-extrabold text-white`}>
                          {orderIndex + 1}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              onPress={handleCreateChore} 
              style={tw`bg-[#721c3b] rounded-2xl py-4 items-center shadow-md shadow-rose-900/10`}
              activeOpacity={0.8}
            >
              <Text style={tw`text-white font-bold text-sm`}>Start Chore Loop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 4: Create Split Bill */}
      <Modal visible={createBillModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-xl max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>Create Shared Expense</Text>
              <TouchableOpacity 
                onPress={() => setCreateBillModal(false)}
                style={tw`p-2 bg-slate-50 border border-slate-100 rounded-xl`}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={tw`border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm mb-3.5 bg-slate-50 font-medium`}
              placeholder="Expense Description (e.g. Wifi June)"
              placeholderTextColor="#94a3b8"
              value={billTitle}
              onChangeText={setBillTitle}
            />

            <TextInput
              style={tw`border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm mb-4 bg-slate-50 font-medium`}
              placeholder="Total Cost (INR)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={billAmount}
              onChangeText={setBillAmount}
            />

            <Text style={tw`text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider`}>
              Select Roommates to include in split
            </Text>
            <ScrollView style={tw`max-h-50 mb-5`} showsVerticalScrollIndicator={false}>
              {members?.map((m: any) => {
                const isChecked = selectedBillUsers.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    onPress={() => toggleBillUserCheckbox(m._id)}
                    style={tw`flex-row items-center justify-between py-3 border-b border-slate-50 last:border-0`}
                    activeOpacity={0.7}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <View style={tw`w-8 h-8 bg-slate-50 rounded-lg items-center justify-center border border-slate-100`}>
                        <Text style={tw`text-xs font-bold text-slate-600`}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                    </View>
                    <View style={tw`w-5.5 h-5.5 border rounded-lg items-center justify-center ${
                      isChecked ? 'bg-[#721c3b] border-[#721c3b]' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <Check size={12} color="#ffffff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              onPress={handleCreateBill} 
              style={tw`bg-[#721c3b] rounded-2xl py-4 items-center shadow-md shadow-rose-900/10`}
              activeOpacity={0.8}
            >
              <Text style={tw`text-white font-bold text-sm`}>Split Cost Equally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN MODAL 5: Transfer Admin */}
      <Modal visible={transferAdminModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-slate-900/60 justify-end`}>
          <View style={tw`bg-white rounded-t-[32px] p-6 pb-8 border-t border-slate-100 shadow-xl max-h-[75%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`text-lg font-extrabold text-slate-900 tracking-tight`}>Transfer Admin Role</Text>
              <TouchableOpacity 
                onPress={() => setTransferAdminModal(false)}
                style={tw`p-2 bg-slate-50 border border-slate-100 rounded-xl`}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={tw`text-xs text-slate-500 font-medium mb-5 leading-5`}>
              Select a roommate to transfer Admin status to. You will immediately lose admin privileges.
            </Text>

            {members?.filter((m: any) => m._id !== user?._id).length === 0 ? (
              <Text style={tw`text-slate-400 text-sm text-center py-10 font-semibold`}>No other roommates in this room.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {members?.filter((m: any) => m._id !== user?._id).map((m: any) => (
                  <View key={m._id} style={tw`flex-row justify-between items-center py-3.5 border-b border-slate-100 last:border-0`}>
                    <View style={tw`flex-1 mr-3 flex-row items-center gap-2.5`}>
                      <View style={tw`w-8 h-8 bg-slate-50 rounded-lg items-center justify-center border border-slate-100`}>
                        <Text style={tw`text-xs font-bold text-slate-600`}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={tw`text-sm font-bold text-slate-800`}>{m.name}</Text>
                        <Text style={tw`text-[10px] text-slate-500 font-semibold mt-0.5`}>{m.phone || 'No phone'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleTransferAdmin(m._id, m.name)}
                      style={tw`bg-rose-600 hover:bg-rose-700 rounded-xl px-4 py-2 shadow-sm shadow-rose-100`}
                      activeOpacity={0.8}
                    >
                      <Text style={tw`text-white font-extrabold text-xs`}>Transfer</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { DollarSign, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react-native';

export default function BillsScreen() {
  const { user } = useAuth();
  const [activeBill, setActiveBill] = useState<any | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  // Queries
  const { data: bills, refetch: refetchBills, isLoading: loadingBills } = trpc.bill.list.useQuery(undefined, {
    retry: false
  });

  const payOrderMutation = trpc.bill.createRazorpayOrder.useMutation();
  const verifyPaymentMutation = trpc.bill.verifyPayment.useMutation({
    onSuccess: () => {
      setPaymentModalVisible(false);
      refetchBills();
      Alert.alert('Payment Successful!', 'Your contribution has been marked as paid.');
    },
    onError: (err: any) => {
      Alert.alert('Payment Error', err.message || 'Signature verification failed');
    }
  });

  useFocusEffect(
    React.useCallback(() => {
      refetchBills();
    }, [])
  );

  const handlePayNow = async (bill: any) => {
    setActiveBill(bill);
    setPaymentModalVisible(true);
  };

  const executeMockPayment = async () => {
    if (!activeBill) return;
    setLoadingPayment(true);

    try {
      // 1. Create Razorpay order (backend mock falls back automatically if keys are unset)
      const order = await payOrderMutation.mutateAsync({ contributionId: activeBill._id });
      
      // Simulate Razorpay Gateway processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 2. Verify payment (mock orders are auto-verified)
      const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 11)}`;
      await verifyPaymentMutation.mutateAsync({
        contributionId: activeBill._id,
        razorpayOrderId: order.orderId,
        razorpayPaymentId: mockPaymentId
      });
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Payment flow failed');
    } finally {
      setLoadingPayment(false);
    }
  };

  const getUserShare = (bill: any) => {
    const split = bill.splits.find((s: any) => s.userId?._id === user?._id);
    return split ? split.shareAmount : null;
  };

  const getUserStatus = (bill: any) => {
    const split = bill.splits.find((s: any) => s.userId?._id === user?._id);
    return split ? split.status : 'none';
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={tw`px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Roommate Bills</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>Shared Split Expenses</Text>
        </View>
        <TouchableOpacity onPress={() => refetchBills()} style={tw`p-2 bg-slate-100 rounded-full`}>
          <RefreshCw size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        
        {/* Active Bills Feed */}
        {loadingBills ? (
          <ActivityIndicator size="small" color="#4f46e5" />
        ) : !bills || bills.length === 0 ? (
          <View style={tw`bg-white rounded-3xl p-8 items-center border border-slate-100 shadow-sm mt-4`}>
            <DollarSign size={36} color="#94a3b8" />
            <Text style={tw`text-slate-500 font-bold text-base mt-3`}>No Active Splits</Text>
            <Text style={tw`text-slate-400 text-xs text-center mt-1`}>
              Shared costs like rent, groceries, or bills will appear here when posted by the admin.
            </Text>
          </View>
        ) : (
          bills.map((bill: any) => {
            const share = getUserShare(bill);
            const status = getUserStatus(bill);

            if (share === null) return null; // Current user is not part of this split

            return (
              <View key={bill._id} style={tw`bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                  <View style={tw`flex-1 mr-2`}>
                    <Text style={tw`text-base font-bold text-slate-800`}>{bill.title}</Text>
                    <Text style={tw`text-xs text-slate-400 mt-0.5`}>Total Shared: ₹{bill.totalAmount}</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1.5`}>
                    {status === 'paid' ? (
                      <View style={tw`flex-row items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100`}>
                        <CheckCircle2 size={12} color="#10b981" />
                        <Text style={tw`text-[10px] font-bold text-emerald-600 uppercase`}>Paid</Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100`}>
                        <AlertCircle size={12} color="#d97706" />
                        <Text style={tw`text-[10px] font-bold text-amber-600 uppercase`}>Unpaid</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Info & Pay Button */}
                <View style={tw`flex-row justify-between items-center mt-3 pt-3 border-t border-slate-50`}>
                  <View>
                    <Text style={tw`text-xs text-slate-400`}>Your Share</Text>
                    <Text style={tw`text-xl font-extrabold text-slate-800`}>₹{share}</Text>
                  </View>
                  
                  {status === 'unpaid' && (
                    <TouchableOpacity
                      onPress={() => handlePayNow(bill)}
                      style={tw`bg-indigo-600 rounded-xl px-5 py-2.5 shadow-lg shadow-indigo-100`}
                    >
                      <Text style={tw`text-white font-bold text-sm`}>Pay Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Razorpay Payment Modal Simulator */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            
            {/* Header */}
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <View>
                <Text style={tw`text-xs font-semibold text-slate-400 uppercase tracking-wide`}>Razorpay Secure Payment</Text>
                <Text style={tw`text-lg font-bold text-slate-800`}>{activeBill?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={tw`p-1`}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Bill Splitting Details */}
            <View style={tw`bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 items-center`}>
              <Text style={tw`text-xs text-slate-400 uppercase font-semibold`}>Amount to Pay</Text>
              <Text style={tw`text-3xl font-extrabold text-slate-800 mt-1`}>₹{activeBill ? getUserShare(activeBill) : 0}</Text>
              
              <View style={tw`flex-row items-center gap-1.5 mt-3 bg-white px-3 py-1 rounded-full border border-slate-100`}>
                <ShieldCheck size={14} color="#4f46e5" />
                <Text style={tw`text-[10px] text-indigo-600 font-bold`}>Safe & Encrypted Checkout</Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={executeMockPayment}
              disabled={loadingPayment}
              style={tw`bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-indigo-100 mb-2 ${loadingPayment ? 'opacity-80' : ''}`}
            >
              {loadingPayment ? (
                <>
                  <ActivityIndicator color="#ffffff" size="small" style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold text-sm`}>Contacting bank gateway...</Text>
                </>
              ) : (
                <Text style={tw`text-white font-bold text-sm`}>Simulate Payment</Text>
              )}
            </TouchableOpacity>

            <Text style={tw`text-[10px] text-slate-400 text-center py-2 font-medium`}>
              Payments are simulated when backend integration credentials are unset.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

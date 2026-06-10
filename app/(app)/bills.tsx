import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants, { AppOwnership } from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import tw from 'twrnc';
import { trpc, formatError, getBaseUrl } from '@/lib/trpc';
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
      Alert.alert('Payment Error', formatError(err));
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

  const executeRealPayment = async () => {
    if (!activeBill || !user) return;
    setLoadingPayment(true);

    try {
      // Create Razorpay order on the backend
      const order = await payOrderMutation.mutateAsync({ contributionId: activeBill._id });

      const isExpoGo = Constants.appOwnership !== ('standalone' as any);

      if (isExpoGo) {
        // Fallback in Expo Go to the secure Hono-hosted web portal checkout
        const url = `${getBaseUrl()}/pay/${activeBill._id}/${user?._id}`;
        await WebBrowser.openBrowserAsync(url);
        
        Alert.alert(
          'Payment Gateway Opened',
          'We have launched the secure Razorpay payment page in your browser. After completing the payment, please press "OK" to check payment status.',
          [
            {
              text: 'OK',
              onPress: async () => {
                setLoadingPayment(true);
                setTimeout(async () => {
                  await refetchBills();
                  setLoadingPayment(false);
                  setPaymentModalVisible(false);
                }, 1000);
              }
            }
          ]
        );
      } else {
        // Run native Razorpay SDK directly inside the built APK
        try {
          const RazorpayCheckout = require('react-native-razorpay').default;
          const options = {
            description: activeBill.title,
            image: 'https://i.imgur.com/3g7A6cz.png',
            currency: 'INR',
            key: order.keyId, // Razorpay test/live Key ID from backend
            amount: order.amount, // Total amount in paise
            name: 'Roommate Hub',
            order_id: order.orderId, // Razorpay Order ID created on backend
            prefill: {
              email: user.email,
              contact: user.phone || '',
              name: user.name
            },
            theme: { color: '#4f46e5' }
          };

          RazorpayCheckout.open(options).then(async (data: any) => {
            // Verify payment signature securely on the server
            await verifyPaymentMutation.mutateAsync({
              contributionId: activeBill._id,
              razorpayOrderId: data.razorpay_order_id,
              razorpayPaymentId: data.razorpay_payment_id,
              razorpaySignature: data.razorpay_signature
            });
          }).catch((error: any) => {
            Alert.alert('Payment Failed', error.description || 'Transaction cancelled');
            setLoadingPayment(false);
          });
        } catch (nativeError: any) {
          Alert.alert('Razorpay Load Error', 'Failed to load native Razorpay module: ' + nativeError.message);
          setLoadingPayment(false);
        }
      }
    } catch (error: any) {
      Alert.alert('Payment Error', formatError(error));
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
                    <Text style={tw`text-[10px] text-slate-400 mt-1`}>
                      📅 {new Date(bill.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                    <Text style={tw`text-xs text-slate-400 mt-1.5`}>Total Shared: ₹{bill.totalAmount}</Text>
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

                {/* Admin View: Split Statuses */}
                {user?.role === 'admin' && (
                  <View style={tw`mt-2.5 mb-3 pt-3 border-t border-slate-100`}>
                    <Text style={tw`text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2`}>Split Breakdown</Text>
                    <View style={tw`gap-1.5`}>
                      {bill.splits.map((split: any) => (
                        <View key={split._id || split.userId?._id} style={tw`flex-row justify-between items-center`}>
                          <Text style={tw`text-xs font-semibold text-slate-600`}>• {split.userId?.name || 'Unknown User'}</Text>
                          <View style={tw`flex-row items-center gap-2`}>
                            <Text style={tw`text-xs font-bold text-slate-700`}>₹{split.shareAmount}</Text>
                            <View style={tw`px-2 py-0.5 rounded-lg border ${
                              split.status === 'paid' 
                                ? 'bg-emerald-50 border-emerald-100' 
                                : 'bg-amber-50 border-amber-100'
                            }`}>
                              <Text style={tw`text-[9px] font-bold uppercase ${
                                split.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {split.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Info & Pay Button */}
                <View style={tw`flex-row justify-between items-center mt-3 pt-3 border-t border-slate-100`}>
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
              onPress={executeRealPayment}
              disabled={loadingPayment}
              style={tw`bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-lg shadow-indigo-100 mb-2 ${loadingPayment ? 'opacity-80' : ''}`}
            >
              {loadingPayment ? (
                <>
                  <ActivityIndicator color="#ffffff" size="small" style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold text-sm`}>Redirecting to Gateway...</Text>
                </>
              ) : (
                <Text style={tw`text-white font-bold text-sm`}>Pay Securely via Razorpay</Text>
              )}
            </TouchableOpacity>

            <Text style={tw`text-[10px] text-slate-400 text-center py-2 font-medium`}>
              Secure payment gateway will open in your mobile browser.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

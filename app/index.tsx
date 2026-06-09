import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { 
  DollarSign, 
  CheckSquare, 
  ShoppingCart, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Plus, 
  ChevronRight,
  Bell
} from 'lucide-react-native';

export default function HomeScreen() {
  const roommates = [
    { name: 'Alex', status: 'At Home', avatarColor: 'bg-emerald-500' },
    { name: 'Sarah', status: 'At Work', avatarColor: 'bg-indigo-500' },
    { name: 'Jamie', status: 'Out', avatarColor: 'bg-amber-500' },
  ];

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={tw`px-6 py-4 flex-row justify-between items-center bg-white border-b border-slate-100`}>
        <View>
          <Text style={tw`text-xs font-semibold text-indigo-600 tracking-wider uppercase`}>Roommate Hub</Text>
          <Text style={tw`text-xl font-bold text-slate-800`}>Apartment 4B</Text>
        </View>
        <TouchableOpacity style={tw`p-2 bg-slate-100 rounded-full`}>
          <Bell size={20} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      <ScrollView style={tw`flex-1 px-5 py-4`} showsVerticalScrollIndicator={false}>
        {/* Quick Balance Banner */}
        <LinearGradient
          colors={['#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={tw`rounded-2xl p-5 mb-5 shadow-lg shadow-indigo-100`}
        >
          <View style={tw`flex-row justify-between items-start`}>
            <View>
              <Text style={tw`text-indigo-100 text-xs font-semibold uppercase tracking-wider`}>Your Balance Summary</Text>
              <Text style={tw`text-white text-3xl font-extrabold mt-1`}>+$42.50</Text>
              <Text style={tw`text-indigo-200 text-xs mt-2`}>You are owed money overall</Text>
            </View>
            <View style={tw`p-3 bg-white/20 rounded-xl`}>
              <TrendingUp size={24} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>

        {/* Feature Grid */}
        <Text style={tw`text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider`}>Features</Text>
        <View style={tw`flex-row flex-wrap justify-between gap-y-4 mb-6`}>
          {/* Card 1: Expenses */}
          <TouchableOpacity style={tw`w-[47%] bg-white p-4 rounded-xl shadow-sm border border-slate-100`}>
            <View style={tw`p-2 bg-emerald-50 rounded-lg w-10 h-10 items-center justify-center mb-3`}>
              <DollarSign size={20} color="#10b981" />
            </View>
            <Text style={tw`text-base font-bold text-slate-800`}>Expenses</Text>
            <Text style={tw`text-xs text-slate-400 mt-1`}>Split bills & track debts</Text>
          </TouchableOpacity>

          {/* Card 2: Chores */}
          <TouchableOpacity style={tw`w-[47%] bg-white p-4 rounded-xl shadow-sm border border-slate-100`}>
            <View style={tw`p-2 bg-indigo-50 rounded-lg w-10 h-10 items-center justify-center mb-3`}>
              <CheckSquare size={20} color="#6366f1" />
            </View>
            <Text style={tw`text-base font-bold text-slate-800`}>Chores</Text>
            <Text style={tw`text-xs text-slate-400 mt-1`}>2 tasks pending today</Text>
          </TouchableOpacity>

          {/* Card 3: Grocery List */}
          <TouchableOpacity style={tw`w-[47%] bg-white p-4 rounded-xl shadow-sm border border-slate-100`}>
            <View style={tw`p-2 bg-amber-50 rounded-lg w-10 h-10 items-center justify-center mb-3`}>
              <ShoppingCart size={20} color="#f59e0b" />
            </View>
            <Text style={tw`text-base font-bold text-slate-800`}>Groceries</Text>
            <Text style={tw`text-xs text-slate-400 mt-1`}>5 items needed</Text>
          </TouchableOpacity>

          {/* Card 4: Chat */}
          <TouchableOpacity style={tw`w-[47%] bg-white p-4 rounded-xl shadow-sm border border-slate-100`}>
            <View style={tw`p-2 bg-teal-50 rounded-lg w-10 h-10 items-center justify-center mb-3`}>
              <MessageSquare size={20} color="#14b8a6" />
            </View>
            <Text style={tw`text-base font-bold text-slate-800`}>Room Chat</Text>
            <Text style={tw`text-xs text-slate-400 mt-1`}>Share notes & talk</Text>
          </TouchableOpacity>
        </View>

        {/* Roommates Section */}
        <View style={tw`flex-row justify-between items-center mb-3`}>
          <Text style={tw`text-sm font-bold text-slate-700 uppercase tracking-wider`}>Active Roommates</Text>
          <TouchableOpacity style={tw`flex-row items-center`}>
            <Text style={tw`text-xs text-indigo-600 font-semibold`}>Manage</Text>
            <ChevronRight size={14} color="#4f46e5" />
          </TouchableOpacity>
        </View>

        <View style={tw`bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-10`}>
          {roommates.map((roommate, idx) => (
            <View 
              key={idx} 
              style={tw`flex-row justify-between items-center py-2.5 ${idx !== roommates.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <View style={tw`flex-row items-center gap-3`}>
                <View style={tw`w-9 h-9 rounded-full ${roommate.avatarColor} items-center justify-center`}>
                  <Text style={tw`text-white font-bold text-sm`}>{roommate.name[0]}</Text>
                </View>
                <View>
                  <Text style={tw`text-sm font-semibold text-slate-800`}>{roommate.name}</Text>
                  <Text style={tw`text-xs text-slate-400`}>{roommate.status}</Text>
                </View>
              </View>
              
              <View style={tw`w-2.5 h-2.5 rounded-full ${roommate.status === 'At Home' ? 'bg-emerald-500' : roommate.status === 'At Work' ? 'bg-indigo-500' : 'bg-amber-400'}`} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

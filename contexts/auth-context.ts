import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

interface User {
  _id: string;
  email: string;
  name: string;
  roomId?: string;
  phone?: string;
  role: 'admin' | 'member';
  isOptedIn: boolean;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastViewedChat, setLastViewedChatState] = useState<string>('');

  useEffect(() => {
    loadAuthData();
  }, []);

  useEffect(() => {
    if (token) {
      global.authToken = token;
    } else {
      global.authToken = undefined;
    }
  }, [token]);

  const loadAuthData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('user');
      const storedLastViewed = await AsyncStorage.getItem('lastViewedChat');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      if (storedLastViewed) {
        setLastViewedChatState(storedLastViewed);
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (token: string, user: User) => {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('lastViewedChat');

    global.authToken = undefined;
    setToken(null);
    setUser(null);
    setLastViewedChatState('');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  const setLastViewedChat = useCallback((timestamp: string) => {
    setLastViewedChatState(timestamp);
    AsyncStorage.setItem('lastViewedChat', timestamp);
  }, []);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    updateUser,
    lastViewedChat,
    setLastViewedChat,
  };
});

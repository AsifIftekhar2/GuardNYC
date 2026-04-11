import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPost, setAuthToken, clearAuthToken } from '../utils/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        setAuthToken(token);
        const response = await apiGet('/api/auth/me');
        setUser(response.user);
      }
    } catch (error) {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      clearAuthToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const response = await apiPost('/api/auth/login', { email, password });
    await AsyncStorage.setItem('access_token', response.access_token);
    await AsyncStorage.setItem('refresh_token', response.refresh_token);
    setAuthToken(response.access_token);
    setUser(response.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await apiPost('/api/auth/register', { name, email, password });
    await AsyncStorage.setItem('access_token', response.access_token);
    await AsyncStorage.setItem('refresh_token', response.refresh_token);
    setAuthToken(response.access_token);
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch {}
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    clearAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

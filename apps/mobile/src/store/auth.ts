import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  isAuthenticated: false,

  setAuth: async (token: string, userId: string) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('user_id', userId);
    set({ token, userId, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_id');
    set({ token: null, userId: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userId = await SecureStore.getItemAsync('user_id');
    if (token && userId) {
      set({ token, userId, isAuthenticated: true });
    }
  },
}));

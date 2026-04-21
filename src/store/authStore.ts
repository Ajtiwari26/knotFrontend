import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  _id: string;
  displayName: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  wallet_balance?: number;
  isGuest: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isGuest: boolean;
  setAuth: (token: string, user: User, isGuest: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isGuest: false,
      setAuth: (token, user, isGuest) => set({ token, user, isGuest }),
      logout: () => set({ token: null, user: null, isGuest: false }),
    }),
    {
      name: 'knot-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

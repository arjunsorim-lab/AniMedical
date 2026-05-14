import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as loginApi, signup as signupApi, getMe, requestPasswordReset as requestResetApi, resetPassword as updatePasswordApi, uploadProfilePic as uploadPicApi } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      isCheckingAuth: true,

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const data = await loginApi(email, password);
          set({ 
            user: data.user, 
            token: data.access_token, 
            isAuthenticated: true, 
            loading: false,
            isCheckingAuth: false
          });
          // Ensure welcome screen is shown on login
          localStorage.setItem('voice-ai-active-id', '__new__');
          return data;
        } catch (err) {
          set({ error: err.message, loading: false, isCheckingAuth: false });
          throw err;
        }
      },

      signup: async (userData) => {
        set({ loading: true, error: null });
        try {
          const data = await signupApi(userData);
          if (data.access_token) {
            set({
              user: data.user || { email: userData.email, name: userData.name },
              token: data.access_token,
              isAuthenticated: true,
              loading: false,
              isCheckingAuth: false
            });
            // Ensure welcome screen is shown on signup
            localStorage.setItem('voice-ai-active-id', '__new__');
          } else {
            set({ loading: false });
          }
          return data;
        } catch (err) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, error: null, isCheckingAuth: false });
        // Clear chat history from store and local storage
        localStorage.removeItem('voice-ai-active-id');
        // We can't easily call useChatStore here without circular imports if we are not careful
        // but we can at least clear the local storage keys starting with CACHE_PREFIX
        const CACHE_PREFIX = 'voice-ai-chat:';
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, isCheckingAuth: false });
          return;
        }

        set({ isCheckingAuth: true });
        try {
          const user = await getMe(token);
          set({ user, isAuthenticated: true, isCheckingAuth: false });
        } catch (err) {
          set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false });
        }
      },

      clearError: () => set({ error: null }),
      
      requestReset: async (email) => {
        set({ loading: true, error: null });
        try {
          const data = await requestResetApi(email);
          set({ loading: false });
          return data;
        } catch (err) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },

      updatePassword: async (username, oldPassword, newPassword) => {
        set({ loading: true, error: null });
        try {
          const data = await updatePasswordApi(username, oldPassword, newPassword);
          set({ loading: false });
          return data;
        } catch (err) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },
      
      uploadProfilePic: async (file) => {
        set({ loading: true, error: null });
        try {
          const data = await uploadPicApi(file);
          const currentUser = get().user;
          set({ 
            user: { ...currentUser, profile_pic: data.profile_pic },
            loading: false 
          });
          return data;
        } catch (err) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;

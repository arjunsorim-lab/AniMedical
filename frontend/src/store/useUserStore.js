import { create } from 'zustand';

const useUserStore = create((set) => ({
  user: {
    name: 'Deepika',
    email: 'deepika@example.com',
    avatarUrl: null, // Change to an image URL to test the image rendering
  },
  setUser: (user) => set({ user }),
}));

export default useUserStore;
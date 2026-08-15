import { create } from "zustand";

/** When true, the global tab bar is unmounted (not hidden/translated). */
export const useTabBarGate = create<{
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));

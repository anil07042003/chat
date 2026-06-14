export const createAuthSlice = (set, get) => ({
  userInfo: undefined,

  // Supports both direct value and functional updater:
  //   setUserInfo({ ...data })          — replaces userInfo
  //   setUserInfo((prev) => ({ ...prev, x: 1 }))  — merges safely
  setUserInfo: (userInfoOrUpdater) => {
    if (typeof userInfoOrUpdater === "function") {
      const current = get().userInfo;
      set({ userInfo: userInfoOrUpdater(current) });
    } else {
      set({ userInfo: userInfoOrUpdater });
    }
  },
});

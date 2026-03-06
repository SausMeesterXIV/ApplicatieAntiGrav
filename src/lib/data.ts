// This file contains helpers for localStorage-based profile customization.

export const saveUserProfile = (nickname: string, avatar: string) => {
  localStorage.setItem('userProfile', JSON.stringify({ nickname, avatar }));
};

export const loadUserProfile = (): { nickname?: string; avatar?: string } | null => {
  try {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

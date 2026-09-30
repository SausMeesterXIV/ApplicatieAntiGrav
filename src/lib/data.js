// This file contains helpers for localStorage-based profile customization.

export const saveUserProfile = (nickname, avatar) => {
  localStorage.setItem('userProfile', JSON.stringify({ nickname, avatar }));
};

export const loadUserProfile = () => {
  try {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

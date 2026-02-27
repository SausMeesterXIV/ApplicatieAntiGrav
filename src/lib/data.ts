
import { User } from '../types';

// This file previously contained MOCK_USERS. All user data now comes from Supabase.
// These helpers remain for localStorage-based profile customization.

export const MOCK_USERS: User[] = [];
export const MOCK_DRINKS: any[] = [];
export const MOCK_STREAKS: any[] = [];

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

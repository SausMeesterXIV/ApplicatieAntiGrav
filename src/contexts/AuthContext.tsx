import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { User, RoleDefinition } from '../types';
import * as db from '../lib/supabaseService';

interface AuthContextType {
  session: Session | null;
  currentUser: User | null;
  users: User[];
  availableRoles: RoleDefinition[];
  loading: boolean;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  handleSaveRoles: (userId: string, targetRoles: string[]) => Promise<void>;
  handleSaveAvailableRoles: (roles: RoleDefinition[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadAuthData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        loadAuthData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadAuthData(userId: string) {
    try {
      // 1. Load users & current user
      const usersData = await db.fetchAllProfiles();
      setUsers(usersData);

      let cUser = usersData.find(u => u.id === userId) || null;
      if (!cUser && session?.user?.email) {
        cUser = {
          id: userId,
          naam: session.user.user_metadata?.name || 'Onbekend',
          name: session.user.user_metadata?.name || 'Onbekend',
          email: session.user.email,
          rol: 'standaard',
          actief: true,
          roles: []
        };
        const updatedUsers = [...usersData, cUser];
        setUsers(updatedUsers);
      }
      setCurrentUser(cUser);

      // 2. Load roles configuration
      const loadedRoles = await db.fetchAvailableRoles();
      if (!loadedRoles || loadedRoles.length === 0) {
        const defaultRoles = [
          { id: '1', label: 'Hoofdleiding', icon: 'admin_panel_settings', color: 'bg-red-100 text-red-700 border-red-200' },
          { id: '2', label: 'Financiën', icon: 'account_balance', color: 'bg-green-100 text-green-700 border-green-200' },
          { id: '3', label: 'Sfeerbeheer', icon: 'celebration', color: 'bg-purple-100 text-purple-700 border-purple-200' },
          { id: '4', label: 'Drank', icon: 'local_bar', color: 'bg-blue-100 text-blue-700 border-blue-200' },
          { id: '5', label: 'Materiaal', icon: 'build', color: 'bg-orange-100 text-orange-700 border-orange-200' },
          { id: '6', label: 'Kookploeg', icon: 'restaurant', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
          { id: '7', label: 'Pagadders', icon: 'groups', color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { id: '8', label: 'Kabouters', icon: 'groups', color: 'bg-pink-50 text-pink-600 border-pink-100' },
          { id: '9', label: 'Sloebers', icon: 'groups', color: 'bg-green-50 text-green-600 border-green-100' },
          { id: '10', label: 'Tieners', icon: 'groups', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
          { id: '11', label: 'JIM', icon: 'groups', color: 'bg-orange-50 text-orange-600 border-orange-100' },
          { id: '12', label: 'SIM', icon: 'groups', color: 'bg-purple-50 text-purple-600 border-purple-100' },
          { id: '13', label: 'KIM', icon: 'groups', color: 'bg-red-50 text-red-600 border-red-100' },
          { id: '14', label: 'winkeltje', icon: 'shopping_bag', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        ];
        setAvailableRoles(defaultRoles);
        db.saveAvailableRoles(defaultRoles).catch(e => console.error("Failed to save default roles", e));
      } else {
        setAvailableRoles(loadedRoles);
      }
    } catch (e) {
      console.error("Error loading auth data", e);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveRoles = async (userId: string, targetRoles: string[]) => {
    try {
      await db.updateProfile(userId, { roles: targetRoles });
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, roles: targetRoles } : u
      ));
    } catch (error) {
      console.error('Save roles error', error);
      throw error;
    }
  };

  const handleSaveAvailableRoles = async (roles: RoleDefinition[]) => {
    try {
      setAvailableRoles(roles);
      await db.saveAvailableRoles(roles);
    } catch (error) {
      console.error('Failed to save available roles:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      session, currentUser, setCurrentUser, users, availableRoles, loading, setUsers, handleSaveRoles, handleSaveAvailableRoles
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

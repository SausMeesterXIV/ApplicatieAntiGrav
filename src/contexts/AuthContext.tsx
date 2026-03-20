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
      const usersData = await db.fetchAllProfiles();
      setUsers(usersData);

      let cUser = usersData.find(u => u.id === userId) || null;
      if (!cUser && session?.user?.email) {
        cUser = {
          id: userId,
          naam: (session.user.user_metadata as any)?.name || 'Onbekend',
          name: (session.user.user_metadata as any)?.name || 'Onbekend',
          email: session.user.email || '',
          rol: 'standaard',
          actief: true,
          roles: [],
          nickname: null,
          avatar_url: null,
          avatar: '', // Fallback logic in UI handles this
          created_at: new Date().toISOString(),
          fcm_token: null,
          quick_drink_id: null
        };
        setUsers(prev => [...prev, cUser!]);
      }
      setCurrentUser(cUser);

      // Synchronisatie van beschikbare rollen
      const loadedRoles = await db.fetchAvailableRoles();
      const defaultRoles = [
        { id: '1', label: 'Hoofdleiding', icon: 'admin_panel_settings', color: 'bg-red-100 text-red-700 border-red-200' },
        { id: '2', label: 'Financiën', icon: 'account_balance', color: 'bg-green-100 text-green-700 border-green-200' },
        { id: '3', label: 'Sfeerbeheer', icon: 'celebration', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        { id: '4', label: 'Drank', icon: 'local_bar', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        { id: '5', label: 'Materiaal', icon: 'build', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        { id: '6', label: 'Kookploeg', icon: 'restaurant', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
        { id: '14', label: 'winkeltje', icon: 'shopping_bag', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      ];

      if (!loadedRoles || loadedRoles.length === 0) {
        // Eerste keer instellen
        setAvailableRoles(defaultRoles);
        await db.saveAvailableRoles(defaultRoles);
      } else {
        // Merge: Zorg dat alle standaard rollen bestaan, maar behoud nieuwe aangemaakte rollen
        const merged = [...loadedRoles];
        defaultRoles.forEach(def => {
          if (!merged.find(m => m.label.toLowerCase() === def.label.toLowerCase())) {
            merged.push(def);
          }
        });
        setAvailableRoles(merged);
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
      
      // Update de lijst met gebruikers
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, roles: targetRoles } : u
      ));

      // Belangrijk: Update ook de currentUser als deze persoon zichzelf aanpast
      if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, roles: targetRoles } : null);
      }
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

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

import * as db from '../../lib/supabaseService';
import { verrijkGebruiker } from '../../lib/roleUtils';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  // null = rollentabellen nog niet gemigreerd (dan gelden de oude rolkolommen)
  const [rolData, setRolData] = useState(null);
  const [legacyRoles, setLegacyRoles] = useState([]);
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        loadAuthData(session.user.id);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadAuthData(userId) {
    try {
      const [profielen, rollen] = await Promise.all([db.fetchAllProfiles(), db.fetchRolData()]);
      const verrijkt = profielen.map(p => verrijkGebruiker(p, rollen));
      setRolData(rollen);
      setUsers(verrijkt);

      const cUser = verrijkt.find(u => u.id === userId);
      if (!cUser || !cUser.actief) {
        console.warn('Profiel niet gevonden of inactief. Uitloggen...');
        await supabase.auth.signOut();
        return;
      }
      setCurrentUser(cUser);

      // Voor de migratie: de oude rollenlijst uit app_settings (enkel weergave, niets hardcoded)
      if (!rollen) setLegacyRoles(await db.fetchAvailableRoles().catch(() => []));
    } catch (e) {
      console.error('Error loading auth data', e);
    } finally {
      setLoading(false);
    }
  }

  // Na een wijziging in het rollenscherm: alles opnieuw ophalen en verrijken
  const refreshRoles = async () => {
    if (!session?.user?.id) return;
    const [profielen, rollen] = await Promise.all([db.fetchAllProfiles(), db.fetchRolData()]);
    const verrijkt = profielen.map(p => verrijkGebruiker(p, rollen));
    setRolData(rollen);
    setUsers(verrijkt);
    setCurrentUser(verrijkt.find(u => u.id === session.user.id) || null);
  };

  const groepen = rolData?.groepen || [];
  const werkgroepen = rolData?.werkgroepen || [];

  // Compatibel met schermen die nog één lijst "rollen" verwachten (agenda, berichten)
  const availableRoles = useMemo(() => {
    if (!rolData) return legacyRoles;
    return [
      ...werkgroepen.map(w => ({ id: w.id, label: w.naam, icon: 'workspaces', category: 'Team' })),
      ...groepen.map(g => ({ id: `groep-${g.id}`, label: g.naam, icon: 'groups', category: 'Groep' })),
    ];
  }, [rolData, legacyRoles]);

  return (
    <AuthContext.Provider
      value={{
        session,
        currentUser,
        setCurrentUser,
        users,
        setUsers,
        loading,
        rollenGemigreerd: !!rolData,
        groepen,
        werkgroepen,
        availableRoles,
        refreshRoles,
      }}
    >
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

import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const RolesManageScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users, setUsers: setUsersContext } = useOutletContext<AppContextType>();

  // Data from Supabase via context
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // New state for "Quick Assign Mode"
  const [activeAssignRole, setActiveAssignRole] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  React.useEffect(() => {
    // Fetch ALL profiles including inactive ones for the admin screen
    db.fetchAllProfiles().then(allUsers => {
      setLocalUsers(allUsers);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      showToast('Fout bij ophalen gebruikers', 'error');
      setLoading(false);
    });
  }, []);

  const filteredUsers = localUsers.filter(u => {
    if (!showInactive && !u.actief) return false;
    return (u.naam || '').toLowerCase().includes(search.toLowerCase());
  });

  // Role toggles state (for the modal)
  const [toggles, setToggles] = useState({
    sfeer: false,
    drank: false,
    finance: false,
  });

  const availableRoles = [
    { label: 'Financiën', id: 'Financiën', icon: 'euro' },
    { label: 'Sfeerbeheer', id: 'Sfeerbeheer', icon: 'celebration' },
    { label: 'Drank', id: 'Drank', icon: 'local_bar' },
    { label: 'Materiaal', id: 'Materiaal', icon: 'build' },
  ];

  const roleColors: { [key: string]: string } = {
    'Financiën': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    'Sfeerbeheer': 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    'Drank': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'Materiaal': 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    'Hoofdleiding': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  };

  // Handle clicking a user card
  const handleUserClick = (user: User) => {
    // If Quick Assign Mode is active, toggle that specific role immediately
    if (activeAssignRole) {
      toggleRoleForUser(user.id, activeAssignRole);
    } else {
      // Otherwise open the detail modal
      handleOpenUser(user);
    }
  };

  const handleOpenUser = (user: User) => {
    setSelectedUser(user);
    setToggles({
      sfeer: (user.roles || []).includes('Sfeerbeheer'),
      drank: (user.roles || []).includes('Drank'),
      finance: (user.roles || []).includes('Financiën'),
    });
  };

  const toggleRoleForUser = async (userId: string, role: string) => {
    const user = localUsers.find(u => u.id === userId);
    if (!user) return;

    const hasRole = (user.roles || []).includes(role);
    let newRoles = [...(user.roles || [])];

    if (hasRole) {
      newRoles = newRoles.filter(r => r !== role);
    } else {
      newRoles.push(role);
    }

    const updatedUser = { ...user, roles: newRoles };

    // Optimistic update
    setLocalUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));

    try {
      await db.updateProfile(userId, { roles: newRoles });
      // Sync to global context
      setUsersContext(prev => prev.map(u => u.id === userId ? updatedUser : u));
      showToast(`Rol '${role}' ${hasRole ? 'verwijderd' : 'toegevoegd'}`, 'success');
    } catch (error) {
      // Rollback
      setLocalUsers(prev => prev.map(u => u.id === userId ? user : u));
      showToast('Fout bij het opslaan van de rol', 'error');
    }
  };

  const handleResetNickname = (userId: string) => {
    if (!window.confirm('Weet je zeker dat je de bijnaam van deze persoon wilt resetten?')) return;

    setLocalUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== userId) return u;
      return { ...u, nickname: undefined };
    }));
    // Also update selectedUser if open
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser((prev: User | null) => prev ? { ...prev, nickname: undefined } : null);
    }
  };

  // Handle saving from the modal
  const saveFromModal = async () => {
    if (!selectedUser) return;

    // Construct new roles based on toggles
    const newRoles: string[] = [];
    if (toggles.sfeer) newRoles.push('Sfeerbeheer');
    if (toggles.drank) newRoles.push('Drank');
    if (toggles.finance) newRoles.push('Financiën');
    // Preserve other roles not in the toggle list
    const otherRoles = (selectedUser.roles || []).filter((r: string) => !['Sfeerbeheer', 'Drank', 'Financiën'].includes(r));
    const finalRoles = [...newRoles, ...otherRoles];

    const updatedUser = { ...selectedUser, roles: finalRoles };

    // Optimistic update
    setLocalUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
    setSelectedUser(null);

    try {
      await db.updateProfile(selectedUser.id, { roles: finalRoles });
      // Sync to global context
      setUsersContext(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
      showToast('Rollen opgeslagen!', 'success');
    } catch (error) {
      showToast('Fout bij het opslaan van de rollen', 'error');
    }
  };

  const toggleUserActief = async (user: User) => {
    if (!window.confirm(`Weet je zeker dat je het account van ${user.naam} wilt ${user.actief ? 'deactiveren' : 'activeren'}?`)) return;

    const updatedUser = { ...user, actief: !user.actief };
    setLocalUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));

    // Auto close modal if the user was selected and we just disabled them
    if (selectedUser?.id === user.id) {
      setSelectedUser(updatedUser);
    }

    try {
      await db.updateProfile(user.id, { actief: !user.actief });
      showToast(`Account ${!user.actief ? 'geactiveerd' : 'gedeactiveerd'}`, 'success');
    } catch (error) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? user : u)); // Rollback
      showToast('Fout bij het aanpassen van account status', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0f172a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans relative transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <div className="flex justify-between items-start mb-6">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back_ios_new</span>
          </button>
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-700 dark:text-green-500 tracking-wider">ADMIN</span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Rollen & Beheer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Beheer leiding en hoofdleiding status</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto">

        {/* QUICK ASSIGN TOOLBAR */}
        <section className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Snelle Rol Toewijzing</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {availableRoles.map(role => {
              const isActive = activeAssignRole === role.id;
              const baseColor = roleColors[role.id] || 'bg-gray-100 text-gray-500';

              return (
                <button
                  key={role.id}
                  onClick={() => setActiveAssignRole(isActive ? null : role.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all whitespace-nowrap ${isActive
                    ? `${baseColor} ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#0f172a] scale-105 shadow-md`
                    : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  <span className={`material-icons-round text-lg ${isActive ? '' : 'text-gray-400'}`}>{role.icon}</span>
                  <span className="font-bold text-sm">{role.label}</span>
                  {isActive && <span className="material-icons-round text-sm ml-1">check_circle</span>}
                </button>
              );
            })}
          </div>

          {/* Active Mode Banner */}
          {activeAssignRole && (
            <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <span className="material-icons-round text-blue-600 dark:text-blue-400 animate-pulse">touch_app</span>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <span className="font-bold">Modus Actief:</span> Tik op een persoon hieronder om de rol <span className="font-bold underline">{activeAssignRole}</span> direct toe te wijzen of te verwijderen.
              </p>
            </div>
          )}
        </section>

        {/* Search */}
        <div className="relative mb-4">
          <span className="material-icons-round absolute left-4 top-3.5 text-gray-400">search</span>
          <input
            type="text"
            placeholder="Zoek leiding..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leiding ({filteredUsers.length})</h2>

          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showInactive ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-gray-300 dark:border-gray-600'}`}>
              {showInactive && <span className="material-icons-round text-white" style={{ fontSize: '10px' }}>check</span>}
            </div>
            <input type="checkbox" className="hidden" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            <span className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Toon inactief</span>
          </label>
        </div>

        <div className="space-y-3">
          {filteredUsers.map(user => {
            // Check if user has the active role (for highlighting in quick mode)
            const hasActiveRole = activeAssignRole && (user.roles || []).includes(activeAssignRole);

            return (
              <div
                key={user.id}
                onClick={() => handleUserClick(user)}
                className={`
                  bg-white dark:bg-[#1e293b] p-4 rounded-xl border flex items-center justify-between group transition-all shadow-sm cursor-pointer
                  ${activeAssignRole
                    ? 'hover:scale-[1.01] active:scale-[0.99] ' + (hasActiveRole ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400' : 'border-gray-200 dark:border-gray-800 opacity-80 hover:opacity-100')
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-50 dark:border-[#0f172a] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 relative">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.naam} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{(user.naam || '').charAt(0)}</span>
                    )}

                    {/* Checkmark overlay for active assign mode */}
                    {hasActiveRole && activeAssignRole && (
                      <div className="absolute inset-0 bg-blue-500/80 flex items-center justify-center animate-in zoom-in duration-200">
                        <span className="material-icons-round text-white font-bold">check</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{user.naam}</h3>
                    {user.nickname && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">({user.nickname})</p>
                    )}
                    {user.roles && user.roles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {user.roles.map((role: string) => (
                          <span key={role} className={`text-[10px] px-2 py-0.5 rounded border ${roleColors[role] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                    {!user.actief && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                        Inactief
                      </span>
                    )}
                  </div>
                </div>

                {activeAssignRole ? (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${hasActiveRole ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    <span className="material-icons-round">{hasActiveRole ? 'remove' : 'add'}</span>
                  </div>
                ) : (
                  <button
                    className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#2a3855] hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all"
                  >
                    <span className="material-icons-round">tune</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Sheet / Modal (Only shows if NOT in Quick Assign Mode) */}
      {selectedUser && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-sm transition-colors" onClick={() => setSelectedUser(null)}></div>
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800 rounded-t-[2rem] p-6 z-50 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6"></div>

            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Rollen beheren</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400">Voor {selectedUser.naam}</p>
                {selectedUser.nickname && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Bijnaam: {selectedUser.nickname}</span>
                    <button
                      onClick={() => handleResetNickname(selectedUser.id)}
                      className="text-[10px] text-red-500 font-bold border border-red-200 bg-red-50 px-2 py-0.5 rounded hover:bg-red-100"
                    >
                      Reset Bijnaam
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {/* Role Items */}
              <div className="bg-gray-50 dark:bg-[#1e293b] rounded-xl p-4 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <span className="material-icons-round text-lg">celebration</span>
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Team Sfeerbeheer</span>
                </div>
                <button
                  onClick={() => setToggles({ ...toggles, sfeer: !toggles.sfeer })}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${toggles.sfeer ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${toggles.sfeer ? 'translate-x-6' : 'translate-x-0'}`}>
                    {toggles.sfeer && <span className="absolute inset-0 flex items-center justify-center"><span className="material-icons-round text-[10px] text-blue-600">check</span></span>}
                  </span>
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-[#1e293b] rounded-xl p-4 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <span className="material-icons-round text-lg">local_bar</span>
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Team Drank</span>
                </div>
                <button
                  onClick={() => setToggles({ ...toggles, drank: !toggles.drank })}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${toggles.drank ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${toggles.drank ? 'translate-x-6' : 'translate-x-0'}`}>
                    {toggles.drank && <span className="absolute inset-0 flex items-center justify-center"><span className="material-icons-round text-[10px] text-blue-600">check</span></span>}
                  </span>
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-[#1e293b] rounded-xl p-4 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <span className="material-icons-round text-lg">euro</span>
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Financiën</span>
                </div>
                <button
                  onClick={() => setToggles({ ...toggles, finance: !toggles.finance })}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${toggles.finance ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${toggles.finance ? 'translate-x-6' : 'translate-x-0'}`}>
                    {toggles.finance && <span className="absolute inset-0 flex items-center justify-center"><span className="material-icons-round text-[10px] text-blue-600">check</span></span>}
                  </span>
                </button>
              </div>

              {/* Account Status Toggle */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 flex items-center justify-between transition-colors border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <span className="material-icons-round text-lg">no_accounts</span>
                    </div>
                    <div>
                      <span className="font-bold text-red-700 dark:text-red-400 block text-sm">Account Deactiveren</span>
                      <span className="text-xs text-red-600/70 dark:text-red-400/70">Ontneem toegang tot de app</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUserActief(selectedUser)}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${!selectedUser.actief ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${!selectedUser.actief ? 'translate-x-6' : 'translate-x-0'}`}>
                      {!selectedUser.actief && <span className="absolute inset-0 flex items-center justify-center"><span className="material-icons-round text-[10px] text-red-600">close</span></span>}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={saveFromModal}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
            >
              Opslaan
            </button>
          </div>
        </>
      )}
    </div>
  );
};
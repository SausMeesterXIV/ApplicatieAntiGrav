import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const RolesManageScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users, setUsers: setUsersContext, availableRoles, handleSaveRoles, currentUser } = useOutletContext<AppContextType>();
  const isHoofdleiding = currentUser.rol === 'admin' || (currentUser.roles || []).includes('Hoofdleiding');

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
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleIcon, setNewRoleIcon] = useState('star');
  const [newRoleColor, setNewRoleColor] = useState('bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800');

  const handleCreateRole = () => {
    if (!newRoleLabel) return;
    const newRole = {
      id: Date.now().toString(),
      label: newRoleLabel,
      icon: newRoleIcon,
      color: newRoleColor
    };
    handleSaveRoles([...availableRoles, newRole]);
    setIsAddingRole(false);
    setNewRoleLabel('');
    setNewRoleIcon('star');
  };
  
  const handleDeleteRole = (id: string, label: string) => {
    if(window.confirm(`Ben je zeker dat je de rol ${label} wilt verwijderen?`)) {
      handleSaveRoles(availableRoles.filter(r => r.id !== id));
      setActiveAssignRole(null);
    }
  };

  const roleColors: { [key: string]: string } = availableRoles.reduce((acc, r) => {
    acc[r.label] = r.color;
    return acc;
  }, {} as Record<string, string>);

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
    const newToggles: Record<string, boolean> = {};
    availableRoles.forEach(r => {
      newToggles[r.label] = (user.roles || []).includes(r.label);
    });
    setToggles(newToggles);
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
    const newRoles = availableRoles.filter(r => toggles[r.label]).map(r => r.label);

    const otherRoles = (selectedUser.roles || []).filter((r: string) => !availableRoles.find(ar => ar.label === r));
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
              const isActive = activeAssignRole === role.label;
              const baseColor = role.color;

              return (
                <div key={role.id} className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={() => setActiveAssignRole(isActive ? null : role.label)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all whitespace-nowrap ${isActive
                      ? `${baseColor} ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#0f172a] scale-105 shadow-md`
                      : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    <span className={`material-icons-round text-lg ${isActive ? '' : 'text-gray-400'}`}>{role.icon}</span>
                    <span className="font-bold text-sm">{role.label}</span>
                    {isActive && <span className="material-icons-round text-sm ml-1">check_circle</span>}
                  </button>
                  {isHoofdleiding && isActive && (
                    <button onClick={() => handleDeleteRole(role.id, role.label)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-full transition-colors flex items-center justify-center w-full">
                      <span className="material-icons-round text-xs">delete</span>
                    </button>
                  )}
                </div>
              );
            })}
            {isHoofdleiding && (
                <button
                  onClick={() => setIsAddingRole(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-400 text-gray-500 text-sm font-bold transition-all whitespace-nowrap shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-icons-round text-lg text-gray-400">add</span>
                  Nieuwe Rol
                </button>
            )}
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
              {availableRoles.map(role => {
                const isToggled = toggles[role.label] || false;
                // Parse tailwind classes safely from color
                const colorClasses = role.color.split(' ').slice(0,3).join(' ');

                return (
                  <div key={role.id} className="bg-gray-50 dark:bg-[#1e293b] rounded-xl p-4 flex items-center justify-between transition-colors mb-4 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClasses}`}>
                        <span className="material-icons-round text-lg">{role.icon}</span>
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{role.label}</span>
                    </div>
                    <button
                      onClick={() => setToggles({ ...toggles, [role.label]: !isToggled })}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${isToggled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isToggled ? 'translate-x-6' : 'translate-x-0'}`}>
                        {isToggled && <span className="absolute inset-0 flex items-center justify-center"><span className="material-icons-round text-[10px] text-blue-600">check</span></span>}
                      </span>
                    </button>
                  </div>
                );
              })}

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

      {/* Add Role Modal */}
      {isAddingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setIsAddingRole(false)}></div>
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-3xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200 shadow-2xl overflow-hidden relative z-10 p-6 border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-4">Nieuwe Rol Toevoegen</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Naam</label>
                <input
                  type="text"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                  placeholder="bv. Social Media"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Icoon (Material Icon)</label>
                <input
                  type="text"
                  value={newRoleIcon}
                  onChange={(e) => setNewRoleIcon(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                  placeholder="bv. tag"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kleur Palette</label>
                <select 
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none"
                >
                  <option value="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">Blauw</option>
                  <option value="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">Paars</option>
                  <option value="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800">Roze</option>
                  <option value="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">Groen</option>
                  <option value="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Geel</option>
                  <option value="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800">Oranje</option>
                  <option value="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">Rood</option>
                  <option value="bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800">Grijs</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsAddingRole(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Annuleren</button>
              <button disabled={!newRoleLabel || !newRoleIcon} onClick={handleCreateRole} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors">Aanmaken</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { User } from '../types';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { hasRole, isHoofdleiding as checkIsHoofdleiding } from '../lib/roleUtils';
import { Modal, BottomSheet } from '../components/Modal';
import { SkeletonRow } from '../components/Skeleton';

export const RolesManageScreen: React.FC = () => {
  const navigate = useNavigate();
    const { users, setUsers: setUsersContext, availableRoles, handleSaveRoles, handleSaveAvailableRoles, currentUser } = useAuth();
  const isUserHoofdleiding = checkIsHoofdleiding(currentUser);

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


  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleIcon, setNewRoleIcon] = useState('star');
  const [newRoleColor, setNewRoleColor] = useState('bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800');
  const [isDeletingRoles, setIsDeletingRoles] = useState(false);
  const [pendingDeactivationUser, setPendingDeactivationUser] = useState<User | null>(null);
  const [newRoleCategory, setNewRoleCategory] = useState<'Team' | 'Groep'>('Team');
  const [isNewYearModalOpen, setIsNewYearModalOpen] = useState(false);
  const [newHeads, setNewHeads] = useState<string[]>([]); // IDs van de 2 nieuwe hoofdleidingen

  const handleCreateRole = () => {
    if (!newRoleLabel) return;
    const newRole = {
      id: Date.now().toString(), // Timestamp zorgt voor de juiste sorteer-volgorde
      label: newRoleLabel,
      icon: newRoleIcon,
      color: newRoleColor,
      category: newRoleCategory // <--- Belangrijk voor de sortering!
    };
    handleSaveAvailableRoles([...availableRoles, newRole]);
    setIsAddingRole(false);
    setNewRoleLabel('');
    setNewRoleCategory('Team');
  };
  
  const handleDeleteRole = async (id: string, label: string) => {
    if (!window.confirm(`Ben je zeker dat je de rol '${label}' wilt verwijderen? Deze wordt ook verwijderd bij alle gebruikers.`)) return;

    try {
      // 1. Maak de nieuwe lijst van beschikbare rollen
      const updatedAvailableRoles = availableRoles.filter(r => r.id !== id);
      
      // 2. Sla dit op in de database (app_settings)
      await handleSaveAvailableRoles(updatedAvailableRoles);

      // 3. OPSCHONEN: Zoek gebruikers die deze rol hebben en verwijder deze uit hun array
      const usersWithThisRole = localUsers.filter(u => (u.roles || []).includes(label));
      
      if (usersWithThisRole.length > 0) {
        const updatePromises = usersWithThisRole.map(user => {
          const newRoles = (user.roles || []).filter(r => r !== label);
          return db.updateProfile(user.id, { roles: newRoles });
        });

        await Promise.all(updatePromises);

        // Update ook de lokale lijst met gebruikers zodat de UI klopt
        setLocalUsers(prev => prev.map(u => ({
          ...u,
          roles: (u.roles || []).filter(r => r !== label)
        })));
      }

      setActiveAssignRole(null);
      showToast(`Rol '${label}' succesvol verwijderd`, 'success');
    } catch (error) {
      console.error("Delete role error:", error);
      showToast('Fout bij verwijderen uit database', 'error');
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
  };

  const toggleRoleForUser = (userId: string, role: string) => {
    // Gebruik een transition of timeout om de UI thread niet te blokkeren
    requestAnimationFrame(async () => {
      const user = localUsers.find(u => u.id === userId);
      if (!user) return;

      const hasRole = (user.roles || []).includes(role);
      const HOOFDLEIDING_LABEL = 'Hoofdleiding';

      if (role === HOOFDLEIDING_LABEL) {
        if (!hasRole && userId === currentUser?.id) {
          showToast('Je kunt jezelf niet tot hoofdleiding maken', 'error');
          return;
        }
        
        if (hasRole) {
          const hoofdleidingCount = localUsers.filter(u => (u.roles || []).includes(HOOFDLEIDING_LABEL)).length;
          if (hoofdleidingCount <= 1) {
            showToast('Er moet altijd minstens Ã©Ã©n hoofdleiding blijven', 'error');
            return;
          }
        }
      }

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
    });
  };

  const handleNewYearReset = async () => {
    if (newHeads.length !== 2) {
      showToast('Selecteer precies 2 nieuwe hoofdleidingen', 'error');
      return;
    }

    if (!window.confirm('WAARSCHUWING: Dit wist ALLE rollen van iedereen en stelt de 2 geselecteerde personen in als de nieuwe hoofdleiding. Dit kan niet ongedaan worden gemaakt. Doorgaan?')) return;

    setLoading(true);
    try {
      const promises = localUsers.map(user => {
        // Als de gebruiker een van de geselecteerde hoofdleidingen is, krijgt hij de rol.
        // Anders wordt de array leeg.
        const newRoles = newHeads.includes(user.id) ? ['Hoofdleiding'] : [];
        return db.updateProfile(user.id, { roles: newRoles });
      });

      await Promise.all(promises);

      // Update lokale state en context
      const updatedUsers = localUsers.map(u => ({
        ...u,
        roles: newHeads.includes(u.id) ? ['Hoofdleiding'] : []
      }));
      
      setLocalUsers(updatedUsers);
      setUsersContext(updatedUsers);
      
      setIsNewYearModalOpen(false);
      setNewHeads([]);
      showToast('Nieuw jaar succesvol gestart!', 'success');
    } catch (error) {
      showToast('Fout bij het resetten van het jaar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetNickname = (userId: string) => {
    if (!window.confirm('Weet je zeker dat je de bijnaam van deze persoon wilt resetten?')) return;

    setLocalUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== userId) return u;
      return { ...u, nickname: null };
    }));
    // Also update selectedUser if open
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser((prev: User | null) => prev ? { ...prev, nickname: null } : null);
    }
  };


  const toggleUserActief = async (user: User) => {
    // If currently active, we need confirmation before deactivating
    if (user.actief) {
      setPendingDeactivationUser(user);
      return;
    }
    // Re-activating directly without confirmation
    await executeToggleActief(user);
  };

  const executeToggleActief = async (user: User) => {
    const updatedUser = { ...user, actief: !user.actief };
    setLocalUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    if (selectedUser?.id === user.id) {
      setSelectedUser(updatedUser);
    }
    setPendingDeactivationUser(null);
    try {
      await db.updateProfile(user.id, { actief: !user.actief });
      showToast(`Account ${!user.actief ? 'geactiveerd' : 'gedeactiveerd'}`, 'success');
    } catch (error) {
      setLocalUsers(prev => prev.map(u => u.id === user.id ? user : u)); // Rollback
      showToast('Fout bij het aanpassen van account status', 'error');
    }
  };

  const renderRoleButton = (role: any) => {
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
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans relative transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <div className="flex justify-between items-start mb-6">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back_ios_new</span>
          </button>
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-700 dark:text-green-500 tracking-wider">HOOFDLEIDING</span>
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
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Teams & Functies</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
            {availableRoles.filter(r => r.category !== 'Groep').map(role => renderRoleButton(role))}
          </div>

          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Leidingsgroepen</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {availableRoles.filter(r => r.category === 'Groep').map(role => renderRoleButton(role))}
          </div>

          {isUserHoofdleiding && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setIsAddingRole(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-400 text-gray-500 text-sm font-bold transition-all whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="material-icons-round text-lg text-gray-400">add</span>
                Nieuwe Rol
              </button>
              <button
                onClick={() => setIsDeletingRoles(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-red-400 text-red-500 text-sm font-bold transition-all whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <span className="material-icons-round text-lg">delete_sweep</span>
                Beheer
              </button>
              <button
                onClick={() => setIsNewYearModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-amber-400 text-amber-600 text-sm font-bold transition-all whitespace-nowrap hover:bg-amber-50 dark:hover:bg-amber-900/10"
              >
                <span className="material-icons-round text-lg">autorenew</span>
                Nieuw Jaar
              </button>
            </div>
          )}

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
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))
          ) : (
            filteredUsers.map(user => {
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
          })
        )}
      </div>
      </main>

      {/* User Detail BottomSheet */}
      <BottomSheet 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        title="Rollen beheren"
        subtitle={selectedUser ? `Voor ${selectedUser.naam}` : ''}
      >
        {selectedUser && (
          <div className="space-y-6">
            {selectedUser.nickname && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Bijnaam: <span className="font-bold text-blue-600 dark:text-blue-400">{selectedUser.nickname}</span></span>
                <button
                  onClick={() => handleResetNickname(selectedUser.id)}
                  className="text-xs text-red-500 font-bold bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50"
                >
                  Reset
                </button>
              </div>
            )}

            <div className="space-y-3">
              {availableRoles.map(role => {
                // Kijk in localUsers voor de meest actuele status van deze specifieke gebruiker
                const currentUserState = localUsers.find(u => u.id === selectedUser.id);
                const isToggled = (currentUserState?.roles || []).includes(role.label);
                const colorClasses = role.color.split(' ').slice(0,3).join(' ');

                return (
                  <div key={role.id} className="bg-gray-50 dark:bg-[#1e293b] rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${colorClasses}`}>
                        <span className="material-icons-round text-xl" style={{ pointerEvents: 'none' }}>{role.icon}</span>
                      </div>
                      <span className="font-bold text-gray-700 dark:text-gray-200">{role.label}</span>
                    </div>
                    <button
                      onClick={() => toggleRoleForUser(selectedUser.id, role.label)}
                      className={`w-14 h-7 rounded-full relative transition-all duration-300 ${isToggled ? 'bg-blue-600 shadow-inner' : 'bg-gray-300 dark:bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${isToggled ? 'translate-x-7' : 'translate-x-0'}`}>
                        {isToggled && <span className="material-icons-round text-[12px] text-blue-600 font-black">check</span>}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 flex items-center justify-between border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <span className="material-icons-round text-xl">no_accounts</span>
                  </div>
                  <div>
                    <span className="font-bold text-red-700 dark:text-red-400 block text-sm">Account Status</span>
                    <span className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">{selectedUser.actief ? 'Actief' : 'Gedeactiveerd'}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleUserActief(selectedUser)}
                  className={`w-14 h-7 rounded-full relative transition-all duration-300 ${!selectedUser.actief ? 'bg-red-600 shadow-inner' : 'bg-green-500 shadow-inner'}`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${!selectedUser.actief ? 'translate-x-7' : 'translate-x-0'}`}>
                    {selectedUser.actief ? (
                      <span className="material-icons-round text-[12px] text-green-600 font-black">check</span>
                    ) : (
                      <span className="material-icons-round text-[12px] text-red-600 font-black">close</span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add Role Modal */}
      <Modal 
        isOpen={isAddingRole} 
        onClose={() => setIsAddingRole(false)} 
        title="Nieuwe Rol Toevoegen"
      >
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
            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Kies Icoon</label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 pb-2 custom-scrollbar">
              {[
                { val: 'star', label: 'Ster' },
                { val: 'person', label: 'Persoon' },
                { val: 'groups', label: 'Groep' },
                { val: 'admin_panel_settings', label: 'Schild' },
                { val: 'build', label: 'Gereedschap' },
                { val: 'local_bar', label: 'Drank' },
                { val: 'restaurant', label: 'Bestek' },
                { val: 'celebration', label: 'Feest' },
                { val: 'account_balance', label: 'Bank' },
                { val: 'photo_camera', label: 'Camera' },
                { val: 'campaign', label: 'Megafoon' },
                { val: 'sports_soccer', label: 'Bal' },
                { val: 'music_note', label: 'Muziek' },
                { val: 'volunteer_activism', label: 'Hart' },
                { val: 'pets', label: 'Dier' },
              ].map((icon) => (
                <button
                  key={icon.val}
                  type="button"
                  onClick={() => setNewRoleIcon(icon.val)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    newRoleIcon === icon.val
                      ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                      : 'bg-gray-50 border-gray-100 text-gray-500 dark:bg-[#0f172a] dark:border-gray-800'
                  }`}
                >
                  <span className="material-icons-round text-xl mb-1">{icon.val}</span>
                  <span className="text-[10px] truncate w-full text-center leading-tight">{icon.label}</span>
                </button>
              ))}
            </div>
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

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Categorie</label>
            <select 
              value={newRoleCategory}
              onChange={(e) => setNewRoleCategory(e.target.value as 'Team' | 'Groep')}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none"
            >
              <option value="Team">Functie / Team</option>
              <option value="Groep">Leidingsgroep</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setIsAddingRole(false)} className="flex-1 px-4 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors">Annuleren</button>
            <button disabled={!newRoleLabel || !newRoleIcon} onClick={handleCreateRole} className="flex-1 px-4 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors">Aanmaken</button>
          </div>
        </div>
      </Modal>

      {/* Manage Roles Modal */}
      <Modal 
        isOpen={isDeletingRoles} 
        onClose={() => setIsDeletingRoles(false)} 
        title="Rollen Beheren"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">Verwijder rollen die niet meer nodig zijn.</p>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
            {[...availableRoles]
              .sort((a, b) => {
                const isAGroep = a.category === 'Groep';
                const isBGroep = b.category === 'Groep';

                // 1. Groepen (leidingsgroepen) gaan altijd naar onder (return 1)
                if (isAGroep && !isBGroep) return 1;
                if (!isAGroep && isBGroep) return -1;

                // 2. Binnen de categorieën: Sorteer op ID (ID is timestamp). 
                return (a.id || '').localeCompare(b.id || '');
              })
              .map(role => (
                <div key={role.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="material-icons-round text-gray-400" style={{ pointerEvents: 'none' }}>{role.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-white leading-tight">{role.label}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">{role.category || 'Functie'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRole(role.id, role.label)}
                    className="p-2 transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl"
                  >
                    <span className="material-icons-round">delete_outline</span>
                  </button>
                </div>
              ))
            }
            {availableRoles.length === 0 && (
              <div className="text-center py-8 text-gray-400 italic text-sm">Geen rollen gevonden.</div>
            )}
          </div>

          <button
            onClick={() => setIsDeletingRoles(false)}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/10 mt-4"
          >
            Klaar
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isNewYearModalOpen} 
        onClose={() => setIsNewYearModalOpen(false)} 
        title="Nieuw Jaar Starten"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Bij het starten van een nieuw jaar worden <strong>alle rollen van elke gebruiker gewist</strong>. 
              Selecteer hieronder de 2 personen die het stokje overnemen als hoofdleiding.
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {localUsers.filter(u => u.actief).map(user => {
              const isSelected = newHeads.includes(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    if (isSelected) setNewHeads(newHeads.filter(id => id !== user.id));
                    else if (newHeads.length < 2) setNewHeads([...newHeads, user.id]);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
                      : 'bg-gray-50 border-gray-100 dark:bg-[#0f172a] dark:border-gray-800'
                  }`}
                >
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{user.naam}</span>
                  {isSelected ? (
                    <span className="material-icons-round text-blue-600">check_circle</span>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="text-[10px] text-center text-gray-500 uppercase font-bold tracking-widest">
              {newHeads.length}/2 Geselecteerd
            </div>
            <button
              disabled={newHeads.length !== 2 || loading}
              onClick={handleNewYearReset}
              className="w-full bg-amber-600 disabled:opacity-30 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
            >
              Reset & Start Nieuw Jaar
            </button>
          </div>
        </div>
      </Modal>

      {/* Account Deactivation Confirmation Modal */}
      <Modal 
        isOpen={!!pendingDeactivationUser} 
        onClose={() => setPendingDeactivationUser(null)} 
        title="Account Deactiveren?"
      >
        {pendingDeactivationUser && (
          <div className="space-y-6">
            <div className="flex items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
              <span className="material-icons-round text-5xl text-red-600 dark:text-red-400">no_accounts</span>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                Je staat op het punt het account van <span className="font-bold text-gray-900 dark:text-white">{pendingDeactivationUser.naam}</span> te deactiveren.
              </p>
              <p className="text-xs text-gray-400 font-medium">
                De gebruiker kan niet meer inloggen. Gegevens worden bewaard voor 6 maanden.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => executeToggleActief(pendingDeactivationUser)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Ja, deactiveer account
              </button>
              <button
                onClick={() => setPendingDeactivationUser(null)}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold py-4 rounded-2xl hover:bg-gray-200 transition-all"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};


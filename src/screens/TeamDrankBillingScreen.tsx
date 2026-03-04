import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { AppContextType } from '../App';

export const TeamDrankBillingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users: appUsers } = useOutletContext<AppContextType>();
  const [paidUsers, setPaidUsers] = useState<string[]>([]);
  const [initialPaidUsers, setInitialPaidUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('open');

  // Load from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('teamDrankPaidUsers');
    const parsed = saved ? JSON.parse(saved) : [];
    setPaidUsers(parsed);

    // Snapshot initial state for "delayed move" logic
    const initial = (appUsers || []).map(u => {
      const isPaid = (u?.balance || 0) >= 0 || (parsed || []).includes(u?.id);
      return isPaid ? u?.id : null;
    }).filter(Boolean) as string[];
    setInitialPaidUsers(initial);
  }, [appUsers]);

  const togglePayment = (id: string, currentPaidStatus: boolean) => {
    let newPaidUsers;
    if (currentPaidStatus) {
      // If currently paid, unpay (remove from overrides)
      // Note: If balance >= 0, they are paid by default, so removing from overrides might not unpay them.
      // But assuming we only toggle those with debt:
      newPaidUsers = paidUsers.filter(uid => uid !== id);
    } else {
      // Mark as paid
      newPaidUsers = [...paidUsers, id];
    }
    setPaidUsers(newPaidUsers);
    localStorage.setItem('teamDrankPaidUsers', JSON.stringify(newPaidUsers));
  };

  // Derive users with current status
  const users = (appUsers || []).map(user => {
    const isPaidOverride = paidUsers.includes(user.id);
    const hasDebt = (user.balance || 0) < 0;
    // User is paid if they have no debt OR are explicitly marked as paid
    const isPaid = !hasDebt || isPaidOverride;

    return {
      ...user,
      isPaid,
      hasDebt,
      // If paid, effectiveDebt is 0 for the total calculation
      effectiveDebt: isPaid ? 0 : Math.abs(user.balance || 0)
    };
  });

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true;

    if (filter === 'open') {
      // Show if they were NOT paid initially
      // This keeps them in the list even if we just marked them as paid
      return !initialPaidUsers.includes(user.id);
    }

    if (filter === 'paid') {
      // Standard filtering for paid tab
      return user.isPaid;
    }

    return true;
  });

  const totalOutstanding = users.reduce((acc, curr) => acc + curr.effectiveDebt, 0);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Drankrekeningen</h1>
              <button
                onClick={() => navigate('team-drank-billing-excel-preview')}
                className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-blue-500/20 flex items-center gap-1"
              >
                <span className="material-icons-round text-sm">download</span>
                EXCEL
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="material-icons-round absolute left-3 top-3.5 text-gray-400">search</span>
          <input
            type="text"
            placeholder="Zoek op naam..."
            className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'all' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Alle statusen
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'open' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Geboekt
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'paid' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Betaald
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 overflow-y-auto pt-2">

        {/* Ledger List */}
        <div className="space-y-3">
          {filteredUsers.map(user => {
            return (
              <div
                key={user.id}
                onClick={() => togglePayment(user.id, user.isPaid)}
                className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer shadow-sm group ${user.isPaid
                  ? 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800 opacity-75'
                  : 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden shadow-inner">
                      <img src={user?.avatar} alt={user?.naam || user?.name || 'Gebruiker'} className="w-full h-full object-cover" />
                    </div>
                    {/* Status Dot */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1e293b] ${user.isPaid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{user?.naam || user?.name || 'Onbekend'}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.isPaid ? 'Geen openstaand saldo' : 'Openstaande rekening'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-bold text-base ${user.isPaid ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {user.isPaid ? 'Betaald' : `€ ${Math.abs(user.balance || 0).toFixed(2).replace('.', ',')}`}
                  </div>
                  {!user.isPaid && (
                    <span className="text-[10px] text-red-500 font-medium">Niet betaald</span>
                  )}
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ml-2 ${user.isPaid ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400'
                  }`}>
                  {user.isPaid && <span className="material-icons-round text-white text-sm">check</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Action Card */}
      <div className="fixed left-0 right-0 px-6 z-20 flex justify-center pointer-events-none" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="bg-blue-600 rounded-full px-6 py-3 shadow-xl shadow-blue-900/20 text-white flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-medium text-blue-100">Openstaand saldo:</span>
          <span className="text-base font-bold">€ {totalOutstanding.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>
    </div>
  );
};
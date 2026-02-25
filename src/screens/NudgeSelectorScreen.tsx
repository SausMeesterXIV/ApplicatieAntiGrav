import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_USERS } from '../lib/data';

export const NudgeSelectorScreen: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [nudgedIds, setNudgedIds] = useState<string[]>(['3']); // Thomas pre-nudged as per screenshot
  const [showToast, setShowToast] = useState(false);

  // Using MOCK_USERS for consistent data
  const leaders = MOCK_USERS;

  const handleNudge = (id: string) => {
    if (nudgedIds.includes(id)) return;

    setNudgedIds([...nudgedIds, id]);
    setShowToast(true);

    // Hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const filteredLeaders = leaders.filter(l =>
    (l.name || l.naam || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans relative transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold leading-tight">Verstuur een Nudge</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Herinner leiding aan hun streepjes</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-icons-round absolute left-3 top-3.5 text-gray-400">search</span>
          <input
            type="text"
            placeholder="Zoek leiding..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 overflow-y-auto">
        <div className="flex justify-between items-center mb-4 mt-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alle Leiding</h2>
          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">{leaders.length} Actief</span>
        </div>

        <div className="space-y-3">
          {filteredLeaders.map((leader) => {
            const isNudged = nudgedIds.includes(leader.id);
            return (
              <div key={leader.id} className="flex items-center justify-between p-2">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={leader.avatar} alt={leader.name} className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-[#1e293b]" />
                    {leader.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-50 dark:border-[#0f172a]"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{leader.name}</h3>
                    <p className="text-xs text-gray-500">{leader.role}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleNudge(leader.id)}
                  disabled={isNudged}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${isNudged
                    ? 'bg-gray-200 dark:bg-[#1e293b] text-gray-500 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95'
                    }`}
                >
                  {isNudged ? (
                    <>
                      <span>Gestuurd</span>
                      <span className="material-icons-round text-sm">check</span>
                    </>
                  ) : (
                    <>
                      <span>Nudge</span>
                      <span className="material-icons-round text-sm">back_hand</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white text-gray-900 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 min-w-[300px] border border-gray-100">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-white text-lg">check</span>
            </div>
            <div>
              <p className="font-bold text-sm">Nudge succesvol verstuurd!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
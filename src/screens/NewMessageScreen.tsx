import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AppContextType } from '../App';

export const NewMessageScreen: React.FC = () => {
  const navigate = useNavigate();
  const [targetType, setTargetType] = useState<'individual' | 'group'>('group');
  const [selectedGroup, setSelectedGroup] = useState('debtors');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isOfficial, setIsOfficial] = useState(true);

  // Users from Supabase via context
  const { users } = useOutletContext<AppContextType>();

  const toggleUser = (id: string) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(u => u !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  const recipientCount = targetType === 'group' ? 12 : selectedUsers.length;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
      <header className="px-4 py-4 flex items-center gap-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <span className="material-icons-round text-2xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">Nieuw Bericht</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Recipient Selection */}
        <section>
          <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl mb-3 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
            <button
              onClick={() => setTargetType('individual')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${targetType === 'individual' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Individueel
            </button>
            <button
              onClick={() => setTargetType('group')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${targetType === 'group' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Groep
            </button>
          </div>

          {targetType === 'group' ? (
            <div className="relative">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="everyone">Iedereen (Actief)</option>
                <option value="debtors">Iedereen met openstaande rekening</option>
                <option value="leaders">Alle Leiding</option>
                <option value="admins">Hoofdleiding</option>
              </select>
              <span className="material-icons-round absolute right-3 top-3 text-gray-400 pointer-events-none">expand_more</span>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl max-h-40 overflow-y-auto p-2 space-y-1 shadow-sm">
              {users.map(user => (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedUsers.includes(user.id) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    {user.nickname && <span className="text-xs text-gray-500 dark:text-gray-400">{user.nickname}</span>}
                  </div>
                  {selectedUsers.includes(user.id) && <span className="material-icons-round text-blue-600 dark:text-blue-500 text-sm">check</span>}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 ml-1">
            Dit bericht wordt verstuurd naar <span className="font-bold">{recipientCount} personen</span>.
          </p>
        </section>

        {/* Inputs */}
        <section className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">
              <span className="text-blue-600 dark:text-blue-500 mr-1">T</span> Onderwerp
            </label>
            <input
              type="text"
              placeholder="Betreft: Kampgeld"
              className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">
              <span className="text-blue-600 dark:text-blue-500 mr-1">align_left</span> Bericht
            </label>
            <div className="relative">
              <textarea
                rows={8}
                placeholder="Typ hier je bericht voor de leiding..."
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none shadow-sm"
              ></textarea>
              <button className="absolute bottom-3 right-3 p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300 transition-colors">
                <span className="material-icons-round text-lg">attach_file</span>
              </button>
            </div>
          </div>
        </section>

        {/* Options */}
        <div
          onClick={() => setIsOfficial(!isOfficial)}
          className={`p-4 rounded-xl border flex items-start gap-4 cursor-pointer transition-all shadow-sm ${isOfficial ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-gray-800'
            }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOfficial ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            <span className="material-icons-round text-xl">security</span>
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-sm ${isOfficial ? 'text-blue-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>Versturen als Hoofdleiding</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Dit bericht wordt gemarkeerd als 'Belangrijk' en verstuurd vanuit het KSA administratie account.
            </p>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-all ${isOfficial ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'
            }`}>
            {isOfficial && <span className="material-icons-round text-white text-xs">check</span>}
          </div>
        </div>

      </main>

      <footer className="p-4 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800 transition-colors">
        <button
          onClick={() => { navigate(-1); alert('Bericht verzonden!'); }}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <span className="material-icons-round">send</span>
          Versturen
        </button>
      </footer>
    </div>
  );
};
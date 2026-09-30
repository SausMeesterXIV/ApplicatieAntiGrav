import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { ChevronBack } from '../../components/ChevronBack';
import { UserAvatar } from '../../components/UserAvatar';

const MEDAILLE = ['bg-yellow-100 text-yellow-700', 'bg-gray-200 text-gray-700', 'bg-orange-100 text-orange-800'];

// Ranking van de lopende periode, zichtbaar voor alle leiding (enkel totalen, geen details)
export const RankingScreen = () => {
  const navigate = useNavigate();
  const { users, currentUser } = useAuth();
  const { activePeriod, streaks } = useDrink();
  const [ranking, setRanking] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    setLaden(true);
    db.fetchRanking()
      .then(setRanking)
      .catch(e => console.error('Ranking laden mislukt', e))
      .finally(() => setLaden(false));
    // opnieuw laden wanneer er gestreept wordt
  }, [streaks.length, activePeriod?.id]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-xl font-bold">Ranking</h1>
          <p className="text-xs text-gray-500">{activePeriod?.naam || 'Lopende periode'}</p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-2">
        {laden && <p className="text-center text-sm text-gray-500 py-8">Laden…</p>}
        {!laden && ranking.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">Nog niemand gestreept deze periode.</p>
        )}
        {ranking.map((r, i) => (
          <div
            key={r.user_id}
            className={`bg-white dark:bg-[#1e2330] p-3 rounded-xl border flex items-center gap-3 ${
              r.user_id === currentUser?.id ? 'border-blue-400' : 'border-gray-100 dark:border-gray-800'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                MEDAILLE[i] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              #{i + 1}
            </div>
            <UserAvatar user={users.find(u => u.id === r.user_id)} size="md" />
            <p className="flex-1 font-semibold truncate">{r.naam}</p>
            <span className="font-bold">{r.strepen}</span>
          </div>
        ))}
      </main>
    </div>
  );
};

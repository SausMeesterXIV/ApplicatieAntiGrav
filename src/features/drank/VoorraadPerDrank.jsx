import React, { useState } from 'react';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';

// Voorraad per drank: daalt automatisch bij elke streep (database-trigger).
// Drankteam vult na een manuele telling het getelde aantal in; de correctie wordt gelogd.
export const VoorraadPerDrank = () => {
  const { dranken, setDrinks } = useDrink();
  const [bewerkId, setBewerkId] = useState(null);
  const [geteld, setGeteld] = useState('');

  const bewaar = async drank => {
    const aantal = parseInt(geteld, 10);
    if (isNaN(aantal) || aantal < 0) return showToast('Geef een geldig aantal', 'warning');
    try {
      await db.corrigeerVoorraad(drank.id, aantal, 'Manuele telling');
      setDrinks(prev => prev.map(d => (d.id === drank.id ? { ...d, huidige_voorraad: aantal } : d)));
      showToast(`Voorraad ${drank.name} op ${aantal} gezet`, 'success');
      setBewerkId(null);
    } catch (e) {
      showToast('Correctie mislukt (is de drank-migratie uitgevoerd?)', 'error');
    }
  };

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Voorraad per drank</h2>
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {dranken.map(d => (
          <div key={d.id} className="p-3 flex items-center gap-3">
            <p className="flex-1 font-medium truncate">{d.name}</p>
            {bewerkId === d.id ? (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={geteld}
                  onChange={e => setGeteld(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-right"
                />
                <button onClick={() => bewaar(d)} className="text-green-600">
                  <span className="material-icons-round">check</span>
                </button>
                <button onClick={() => setBewerkId(null)} className="text-gray-400">
                  <span className="material-icons-round">close</span>
                </button>
              </>
            ) : (
              <>
                <span
                  className={`font-bold ${(d.huidige_voorraad ?? 0) <= 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
                >
                  {d.huidige_voorraad ?? 0}
                </span>
                <button
                  onClick={() => {
                    setBewerkId(d.id);
                    setGeteld(String(d.huidige_voorraad ?? 0));
                  }}
                  className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                >
                  Tellen
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

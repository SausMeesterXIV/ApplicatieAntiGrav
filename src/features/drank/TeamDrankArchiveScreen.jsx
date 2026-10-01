import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { ChevronBack } from '../../components/ChevronBack';
import { euro } from '../../lib/geld';

// Drankteam: afgesloten periodes terugbekijken
export const TeamDrankArchiveScreen = () => {
  const navigate = useNavigate();
  const { billingPeriods } = useDrink();
  const [facturen, setFacturen] = useState([]);

  useEffect(() => {
    db.fetchFacturen()
      .then(setFacturen)
      .catch(() => {});
  }, []);

  const periodes = useMemo(
    () =>
      billingPeriods
        .filter(p => p.is_closed)
        .map(p => {
          const f = facturen.filter(x => x.period_id === p.id);
          return {
            ...p,
            aantal: f.length,
            totaal: f.reduce((s, x) => s + x.totaal_bedrag, 0),
            open: f.filter(x => x.status !== 'betaald').reduce((s, x) => s + x.totaal_bedrag, 0),
          };
        }),
    [billingPeriods, facturen],
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <div>
            <h1 className="text-xl font-bold">Archief</h1>
            <p className="text-xs text-gray-500">Afgesloten periodes</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-2">
        {periodes.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">Nog geen afgesloten periodes.</p>
        )}
        {periodes.map(p => (
          <button
            key={p.id}
            onClick={() => navigate(`/strepen/facturatie/archief/${p.id}`)}
            className="w-full text-left bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{p.naam}</p>
              <p className="text-xs text-gray-500">
                {p.eind_datum ? `afgesloten op ${new Date(p.eind_datum).toLocaleDateString('nl-BE')} · ` : ''}
                {p.aantal} facturen
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{euro(p.totaal)}</p>
              {p.open > 0 && <p className="text-xs font-semibold text-red-600">{euro(p.open)} open</p>}
            </div>
            <span className="material-icons-round text-gray-300">chevron_right</span>
          </button>
        ))}
      </main>
    </div>
  );
};

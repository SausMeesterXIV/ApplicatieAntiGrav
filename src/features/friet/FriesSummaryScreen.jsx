import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronBack } from '../../components/ChevronBack';
import { PerItem, PerPersoon } from './FriesRondeOverzicht';

const euro = n => `€${Number(n || 0).toFixed(2).replace('.', ',')}`;

// Na het afsluiten van een frietronde: totalen per item (voor de frituur) en per persoon (op de drankfactuur)
export const FriesSummaryScreen = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const orders = state?.orders || [];
  const verwacht = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate('/frituur')} />
        <h1 className="text-xl font-bold">Frietronde afgesloten</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-6">
        {orders.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">
            Geen gegevens van de laatste ronde. Bekijk eerdere rondes in de geschiedenis.
          </p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">Volgens menu</p>
                <p className="text-xl font-black">{euro(verwacht)}</p>
              </div>
              <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">Betaald</p>
                <p className="text-xl font-black">{euro(state?.betaald)}</p>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Per item</h2>
              <PerItem orders={orders} />
            </section>

            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Per persoon (komt op de drankfactuur)
              </h2>
              <PerPersoon orders={orders} />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useFries } from '../contexts/FriesContext';
import { ChevronBack } from '../components/ChevronBack';

import { User, Streak, Drink, Order } from '../types';

export interface MyInvoiceScreenProps {
  onBack?: () => void;
  balance?: number;
  currentUser?: User;
  streaks?: Streak[];
  friesOrders?: Order[];
}

export const MyInvoiceScreen: React.FC<MyInvoiceScreenProps> = ({
  onBack: propOnBack,
  balance: propBalance,
  currentUser: propCurrentUser,
  streaks: propStreaks,
  friesOrders: propFriesOrders
}) => {
  const navigate = useNavigate();
  const { currentUser: authUser } = useAuth();
  const { streaks, activePeriod } = useDrink();
  const { friesOrders } = useFries();

  // Use props if provided, otherwise context
  const currentUser = propCurrentUser || authUser;
  const allStreaks = propStreaks || streaks || [];
  const allFriesOrders = propFriesOrders || friesOrders || [];

  // ========== DYNAMIC PRICING ==========
  // Filter streaks for the active (open) period
  const userStreaks = allStreaks.filter(s => {
    if (s.userId !== currentUser?.id) return false;
    if (activePeriod) return s.period_id === activePeriod.id;
    return true; // fallback: show all if no period
  });

  // Calculate dynamic price per streep
  const allPeriodStreaks = activePeriod
    ? allStreaks.filter(s => s.period_id === activePeriod.id)
    : allStreaks;
  const totalStrepenInPeriod = allPeriodStreaks.reduce((sum, s) => sum + s.amount, 0);
  const geschatteKost = activePeriod?.geschatte_kost || 0;
  const prijsPerStreep = totalStrepenInPeriod > 0 ? geschatteKost / totalStrepenInPeriod : 0;

  // Group streaks by drink with dynamic pricing
  const groupedConsumptions = userStreaks.reduce((acc, streak) => {
    if (!acc[streak.drinkId]) {
      acc[streak.drinkId] = {
        name: streak.drinkName,
        quantity: 0,
        totalPrice: 0,
      };
    }
    acc[streak.drinkId].quantity += streak.amount;
    acc[streak.drinkId].totalPrice += streak.amount * prijsPerStreep;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; totalPrice: number }>);

  const consumptionsList = Object.values(groupedConsumptions).sort((a, b) => b.quantity - a.quantity);
  const totalConsumptions = consumptionsList.reduce((sum, c) => sum + c.totalPrice, 0);

  // Group fries orders (unchanged — fries have fixed prices)
  const userFriesOrders = allFriesOrders.filter(o => o.userId === currentUser?.id);
  const groupedFries = userFriesOrders.reduce((acc, order) => {
    order.items.forEach(item => {
      const key = `${item.name}-${item.price}`;
      if (!acc[key]) {
        acc[key] = {
          name: item.name,
          quantity: 0,
          totalPrice: 0,
          unitPrice: item.price
        };
      }
      acc[key].quantity += item.quantity;
      acc[key].totalPrice += (item.price * item.quantity);
    });
    return acc;
  }, {} as Record<string, { name: string; quantity: number; totalPrice: number; unitPrice: number }>);

  const friesList = Object.values(groupedFries).sort((a, b) => b.quantity - a.quantity);
  const totalFries = friesList.reduce((sum, f) => sum + f.totalPrice, 0);

  // Total balance = dynamic drink cost + fries cost
  const dynamicBalance = Number((totalConsumptions + totalFries).toFixed(2));
  const displayBalance = propBalance ?? dynamicBalance;

  const handleBack = () => {
    if (propOnBack) propOnBack();
    else navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 flex items-center justify-between transition-colors duration-200">
        <ChevronBack onClick={handleBack} className="text-blue-600 dark:text-blue-500" />
        <h1 className="text-base font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Mijn Rekening</h1>
        <button className="p-2 -mr-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400">
          <span className="material-icons-round text-2xl">ios_share</span>
        </button>
      </header>

      <main
        className="flex-1 px-4 overflow-y-auto space-y-6"
        style={{ paddingBottom: 'calc(12rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Total Card */}
        <div className="bg-white dark:bg-[#1e2330] rounded-3xl p-8 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 shadow-xl dark:shadow-2xl relative overflow-hidden mt-2 transition-colors duration-200">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-100 dark:bg-blue-600/20 blur-[50px] rounded-full pointer-events-none"></div>

          <h2 className="text-gray-500 dark:text-gray-400 text-xs font-bold tracking-widest uppercase mb-2 relative z-10">Voorlopig Totaal</h2>
          <div className="text-5xl font-bold text-blue-600 dark:text-blue-500 mb-4 relative z-10">€ {displayBalance.toFixed(2).replace('.', ',')}</div>

          {/* Price breakdown info */}
          {activePeriod && prijsPerStreep > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl px-4 py-2 mb-4 relative z-10 w-full">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">{activePeriod.naam}</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">€ {prijsPerStreep.toFixed(2).replace('.', ',')} / streep</span>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 w-full relative z-10 mt-2">
            <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-[#191e2b] border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-blue-600 dark:text-blue-200 font-medium">Dynamisch berekend</span>
            </div>
          </div>
        </div>

        {/* Consumpties Section */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="material-icons-round text-blue-600 dark:text-blue-500 text-sm">local_bar</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Consumpties</h3>
          </div>

          <div className="bg-white dark:bg-[#1e2330] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800/50 shadow-sm transition-colors duration-200">
            {consumptionsList.length > 0 ? (
              consumptionsList.map((item, index) => (
                <div key={index} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">{item.name}</h4>
                    <p className="text-gray-500 text-xs mt-0.5">{item.quantity}x × € {prijsPerStreep.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">€ {item.totalPrice.toFixed(2).replace('.', ',')}</span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm">
                Geen consumpties gevonden voor deze periode.
              </div>
            )}
          </div>
        </section>

        {/* Frieten Section */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="material-icons-round text-blue-600 dark:text-blue-500 text-sm">fastfood</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Frieten</h3>
          </div>

          <div className="bg-white dark:bg-[#1e2330] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800/50 shadow-sm transition-colors duration-200"
          >
            {friesList.length > 0 ? (
              friesList.map((item, index) => (
                <div key={index} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">{item.name}</h4>
                    <p className="text-gray-500 text-xs mt-0.5">{item.quantity}x € {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">€ {item.totalPrice.toFixed(2).replace('.', ',')}</span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm">
                Geen frietbestellingen gevonden.
              </div>
            )}
          </div>
        </section>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl p-4 flex gap-3 items-start">
          <span className="material-icons-round text-blue-500 dark:text-blue-400 mt-0.5">info</span>
          <p className="text-xs text-blue-700 dark:text-blue-200/70 leading-relaxed">
            Dit bedrag is dynamisch berekend op basis van de factuurkosten van de brouwer.
            Eventuele correcties kunnen later nog worden doorgevoerd.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="fixed bottom-nav-offset left-0 right-0 p-6 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800 z-20 transition-colors duration-200">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm font-medium">Periode</span>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-gray-500 text-sm">calendar_today</span>
            <span className="text-gray-900 dark:text-white text-sm font-bold">{activePeriod?.naam || 'Onbekend'}</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
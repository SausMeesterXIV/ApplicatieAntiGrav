import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';

import { User } from '../types';
import { AppContextType } from '../App';

export interface MyInvoiceScreenProps {
  onBack?: () => void;
  balance?: number;
  currentUser?: User;
}

export const MyInvoiceScreen: React.FC<MyInvoiceScreenProps> = ({
  onBack: propOnBack,
  balance: propBalance,
  currentUser: propCurrentUser
}) => {
  const navigate = useNavigate();
  const context = useOutletContext<AppContextType | null>();

  // Use props if provided, otherwise context
  const currentUser = propCurrentUser || context?.currentUser;
  const balance = propBalance ?? context?.balance ?? 0;

  const handleBack = () => {
    if (propOnBack) propOnBack();
    else navigate(-1);
  };
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 flex items-center justify-between transition-colors duration-200">
        <ChevronBack onClick={handleBack} className="text-blue-600 dark:text-blue-500" />
        <h1 className="text-base font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Mijn Rekening</h1>
        <button className="p-2 -mr-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400">
          <span className="material-icons-round text-2xl">ios_share</span>
        </button>
      </header>

      <main className="flex-1 px-4 pb-24 overflow-y-auto space-y-6">

        {/* Total Card */}
        <div className="bg-white dark:bg-[#1e2330] rounded-3xl p-8 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 shadow-xl dark:shadow-2xl relative overflow-hidden mt-2 transition-colors duration-200">
          {/* Background glow effect - lighter in light mode */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-100 dark:bg-blue-600/20 blur-[50px] rounded-full pointer-events-none"></div>

          <h2 className="text-gray-500 dark:text-gray-400 text-xs font-bold tracking-widest uppercase mb-2 relative z-10">Voorlopig Totaal</h2>
          <div className="text-5xl font-bold text-blue-600 dark:text-blue-500 mb-4 relative z-10">€ {balance.toFixed(2).replace('.', ',')}</div>

          <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-[#191e2b] border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 rounded-full relative z-10">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs text-blue-600 dark:text-blue-200 font-medium">Live berekend</span>
          </div>
        </div>

        {/* Consumpties Section */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="material-icons-round text-blue-600 dark:text-blue-500 text-sm">local_bar</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Consumpties</h3>
          </div>

          <div className="bg-white dark:bg-[#1e2330] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800/50 shadow-sm transition-colors duration-200">
            {/* Item 1 */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">Bier</h4>
                <p className="text-gray-500 text-xs mt-0.5">10x € 1,20</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">€ 12,00</span>
            </div>

            {/* Item 2 */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">Cola</h4>
                <p className="text-gray-500 text-xs mt-0.5">5x € 1,00</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">€ 5,00</span>
            </div>
          </div>
        </section>

        {/* Frieten Section */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="material-icons-round text-blue-600 dark:text-blue-500 text-sm">fastfood</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Frieten</h3>
          </div>

          <div className="bg-white dark:bg-[#1e2330] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800/50 shadow-sm transition-colors duration-200">
            {/* Item 1 */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">Friet Groot</h4>
                <p className="text-gray-500 text-xs mt-0.5">1x € 3,50</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">€ 3,50</span>
            </div>

            {/* Item 2 */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">Curryworst</h4>
                <p className="text-gray-500 text-xs mt-0.5">2x € 2,00</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">€ 4,00</span>
            </div>

            {/* Item 3 */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium">Mayonaise</h4>
                <p className="text-gray-500 text-xs mt-0.5">1x € 0,50</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">€ 0,50</span>
            </div>
          </div>
        </section>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl p-4 flex gap-3 items-start">
          <span className="material-icons-round text-blue-500 dark:text-blue-400 mt-0.5">info</span>
          <p className="text-xs text-blue-700 dark:text-blue-200/70 leading-relaxed">
            Dit is een voorlopige berekening. Eventuele correcties kunnen nog worden doorgevoerd door de hoofdleiding voor het einde van de maand.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800 z-20 transition-colors duration-200">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm font-medium">Huidige Periode</span>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-gray-500 text-sm">calendar_today</span>
            <span className="text-gray-900 dark:text-white text-sm font-bold">September 2023</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useOutletContext } from 'react-router-dom';

export const TeamDrankArchiveScreen: React.FC = () => {
  const navigate = useNavigate();
    const { users } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'bills'>('orders');
  const [selectedPeriod, setSelectedPeriod] = useState('2023');

  // Mock Data for Past Orders
  const archivedOrders: any[] = [];

  // Mock Data for Past Drink Bills
  // Structure: Period -> User -> Bill
  const archivedBills: any[] = [];

  const periods: string[] = [];
  const [billPeriod, setBillPeriod] = useState('');

  const filteredBills = archivedBills.filter(b => b.period === billPeriod);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Archief</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Historiek & Oude Rekeningen</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'orders' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Bestellingen
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'bills' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Drankrekeningen
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe overflow-y-auto">

        {activeTab === 'orders' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bestelhistoriek</h2>
              <select
                className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>

            <div className="space-y-3">
              {archivedOrders.length > 0 ? archivedOrders.map((order) => (
                <div key={order.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">{order.supplier}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{order.date}</p>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">€ {order.amount.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-50 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300">
                    {order.items}
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Geen bestellingen gevonden voor dit jaar.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Oude Rekeningen</h2>
              <select
                className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
                value={billPeriod}
                onChange={(e) => setBillPeriod(e.target.value)}
              >
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => {
                  const user = users.find(u => u.id === bill.userId);
                  return (
                    <div key={bill.id} className="bg-white dark:bg-[#1e293b] p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{user?.name}</h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{bill.period}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">€ {bill.amount.toFixed(2)}</div>
                        <div className="text-[10px] text-green-600 dark:text-green-400 font-medium">Betaald</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Geen gegevens gevonden voor deze periode.
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

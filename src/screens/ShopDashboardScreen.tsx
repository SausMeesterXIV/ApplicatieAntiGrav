import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';

const CATEGORIES = [
  { id: 'hemden', name: 'Hemden', icon: 'checkroom', color: 'bg-blue-100 text-blue-600' },
  { id: 't-shirts', name: 'T-shirts', icon: 'dry_cleaning', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'truien', name: 'Truien', icon: 'styler', color: 'bg-purple-100 text-purple-600' },
  { id: 'schildjes', name: 'Schildjes', icon: 'verified', color: 'bg-orange-100 text-orange-600' },
  { id: 'extras', name: 'Extra\'s', icon: 'more_horiz', color: 'bg-teal-100 text-teal-600' },
];

export const ShopDashboardScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
      <header className="px-6 py-4 flex items-center gap-4 bg-white dark:bg-[#1e2330] shadow-sm sticky top-0 z-10 font-bold">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl text-gray-900 dark:text-white">Winkeltje Dashboard</h1>
      </header>

      <main className="p-4 space-y-4">
        <div
          onClick={() => navigate('/winkeltje/voorraad/tellen')}
          className="bg-primary text-white p-6 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-4 cursor-pointer active:scale-95 transition-all"
        >
          <div className="p-4 bg-white/20 rounded-2xl">
            <span className="material-icons-round text-2xl">inventory</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">Producten Tellen</h3>
            <p className="text-white/80 text-sm">Inventaris opmaken (alles in 1 lijst)</p>
          </div>
          <span className="material-icons-round ml-auto">chevron_right</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigate(`/winkeltje/category/${cat.id}`)}
              className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 cursor-pointer active:scale-95 transition-all"
            >
              <div className={`p-4 ${cat.color} rounded-2xl`}>
                <span className="material-icons-round text-2xl">{cat.icon}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{cat.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Beheer voorraad</p>
              </div>
              <span className="material-icons-round ml-auto text-gray-300">chevron_right</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

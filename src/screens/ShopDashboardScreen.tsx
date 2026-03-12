import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';

const CATEGORIES = [
  { id: 'hemden', name: 'Hemden', icon: 'checkroom', color: 'bg-blue-100 text-blue-600' },
  { id: 't-shirts', name: 'T-shirts', icon: 'dry_cleaning', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'truien', name: 'Truien', icon: 'layers', color: 'bg-purple-100 text-purple-600' },
  { id: 'sjaaltjes', name: 'Sjaaltjes', icon: 'accessibility_new', color: 'bg-red-100 text-red-600' },
  { id: 'schildjes', name: 'Schildjes', icon: 'verified', color: 'bg-orange-100 text-orange-600' },
  { id: 'extras', name: 'Extra\'s', icon: 'more_horiz', color: 'bg-teal-100 text-teal-600' },
];

export const ShopDashboardScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
      <header className="px-6 py-6 flex items-center gap-4 bg-gray-50 dark:bg-[#0f172a] sticky top-0 z-10">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">KSA Winkeltje</span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Dashboard</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Knop nu in zelfde stijl als categorie-kaarten */}
        <section>
          <div
            onClick={() => navigate('/winkeltje/voorraad/tellen')}
            className="bg-white dark:bg-[#1e2330] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-5 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md group"
          >
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0 border border-primary/5 group-hover:scale-110 transition-transform">
              <span className="material-icons-round text-3xl">inventory</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white">Producten Tellen</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inventaris opmaken (alles in 1 lijst)</p>
            </div>
            <span className="material-icons-round text-gray-300 group-hover:translate-x-1 transition-transform">chevron_right</span>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="material-icons-round text-primary text-sm">category</span>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categorieën</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => navigate(`/winkeltje/category/${cat.id}`)}
                className="bg-white dark:bg-[#1e2330] p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md group"
              >
                {/* Forceer vierkante aspect ratio met w-14 h-14 en shrink-0 */}
                <div className={`w-14 h-14 ${cat.color.replace('bg-', 'bg-').replace('text-', 'text-')} rounded-2xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                  <span className="material-icons-round text-2xl">{cat.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{cat.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Beheer voorraad</p>
                </div>
                <span className="material-icons-round text-gray-300 group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

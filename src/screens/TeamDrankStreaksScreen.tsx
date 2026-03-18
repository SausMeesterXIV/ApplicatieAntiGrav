import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { ConsumptionOverviewScreen } from './ConsumptionOverviewScreen';

export const TeamDrankStreaksScreen: React.FC = () => {
  const navigate = useNavigate();
    const { users } = useAuth();
  const { streaks, dranken : drinks, handleDeleteStreak: onDeleteStreak } = useDrink();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const getWeekRange = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = startOfWeek.toLocaleDateString('nl-BE', options);
    const endStr = endOfWeek.toLocaleDateString('nl-BE', options);

    return `${startStr} - ${endStr}`;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const filteredStreaks = streaks.filter(streak => {
    const streakDate = new Date(streak.timestamp);
    return streakDate >= currentWeekStart && streakDate <= new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.naam || users.find(u => u.id === userId)?.name || 'Onbekend';
  const getDrinkName = (drinkId: string | number) => drinks.find(d => d.id === drinkId)?.name || 'Onbekend';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Alle Strepen</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Overzicht & Beheer</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1e293b] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <span className="material-icons-round">chevron_left</span>
          </button>
          <span className="font-semibold text-sm text-gray-800 dark:text-white">
            {getWeekRange(currentWeekStart)}
          </span>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <span className="material-icons-round">chevron_right</span>
          </button>
        </div>

        {/* Streaks List */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Strepen deze week</h2>
          <div className="space-y-3">
            {filteredStreaks.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-[#1e293b] rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 text-sm">Geen strepen gevonden voor deze week.</p>
              </div>
            ) : (
              filteredStreaks.map(streak => (
                <div key={streak.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <span className="material-icons-round text-xl">filter_alt</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{getDrinkName(streak.drinkId)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{getUserName(streak.userId)} - {new Date(streak.timestamp).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700 dark:text-gray-200">€ {streak.price.toFixed(2).replace('.', ',')}</span>
                    <button
                      onClick={() => onDeleteStreak(streak.id)}
                      className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Verwijder streep"
                    >
                      <span className="material-icons-round text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Consumption Overview Table */}
        <section className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Consumptieoverzicht</h2>
          <ConsumptionOverviewScreen
            onBack={() => { }} // No back action needed here as it's embedded
            users={users}
            drinks={drinks}
            streaks={streaks}
          />
        </section>
      </main>
    </div>
  );
};

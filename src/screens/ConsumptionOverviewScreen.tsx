import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { ChevronBack } from '../components/ChevronBack';
import { BottomSheet } from '../components/Modal';
import { User, Drink, Streak } from '../types';
import { SkeletonRow } from '../components/Skeleton';

export interface ConsumptionOverviewScreenProps {
  onBack?: () => void;
  users?: User[];
  drinks?: Drink[];
  streaks?: Streak[];
}

export const ConsumptionOverviewScreen: React.FC<ConsumptionOverviewScreenProps> = ({
  onBack: propOnBack,
  users: propUsers,
  drinks: propDrinks,
  streaks: propStreaks
}) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const drink = useDrink();

  // Use props if provided (e.g., when embedded in another screen), otherwise fall back to context
  const users = propUsers || auth.users || [];
  const drinks = propDrinks || drink.dranken || [];
  const streaks = propStreaks || drink.streaks || [];
  const currentUser = auth.currentUser;
  const loading = auth.loading || drink.loading;

  const handleBack = () => {
    if (propOnBack) propOnBack();
    else navigate(-1);
  };

  // Sort state
  const [sortOption, setSortOption] = useState<'alphabetical' | string>('alphabetical');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Date State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Date Helpers
  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    start.setDate(diff);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('nl-BE', options)} - ${end.toLocaleDateString('nl-BE', options)}`;
  };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Calculate table data based on streaks
  const { sortedData, totals, dynamicColumns } = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    const filteredStreaks = streaks.filter(streak => {
      const streakDate = new Date(streak.timestamp);
      return streakDate >= startOfWeek && streakDate <= endOfWeek;
    });

    // Dynamically get all unique drink names from the available drinks
    const drinkNames = drinks.map(drink => drink.name.toUpperCase());
    const columns = ['NAAM', ...drinkNames];

    const consumptionByUser: { [userId: string]: { [drinkName: string]: number } } = {};

    filteredStreaks.forEach(streak => {
      if (!consumptionByUser[streak.userId]) {
        consumptionByUser[streak.userId] = {};
      }
      const drinkNameUpper = streak.drinkName.toUpperCase();
      consumptionByUser[streak.userId][drinkNameUpper] = (consumptionByUser[streak.userId][drinkNameUpper] || 0) + 1;
    });

    const initialData = users.map(user => {
      const userConsumption = consumptionByUser[user.id] || {};
      const values = drinkNames.map(drinkName => userConsumption[drinkName] || 0);
      return {
        id: user.id,
        name: user.nickname || user.name || user.naam,
        values: values,
      };
    });

    // Calculate totals
    const calculatedTotals = initialData.reduce((acc, row) => {
      return acc.map((total, idx) => total + row.values[idx]);
    }, new Array(drinkNames.length).fill(0));

    // Sort Logic
    let data = [...initialData];
    if (sortOption === 'alphabetical') {
      data = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      const colIndex = drinkNames.indexOf(sortOption as string);
      if (colIndex >= 0) {
        data = data.sort((a, b) => b.values[colIndex] - a.values[colIndex]);
      }
    }

    // PIN CURRENT USER TO TOP
    const currentUserIndex = data.findIndex(u => u.id === currentUser?.id);
    if (currentUserIndex > -1) {
      const currentUserRow = data[currentUserIndex];
      data.splice(currentUserIndex, 1); // Remove from current position
      data.unshift(currentUserRow); // Add to the very beginning
    }

    return { sortedData: data, totals: calculatedTotals, dynamicColumns: columns };
  }, [sortOption, currentDate, streaks, users, drinks]);

  const columns = dynamicColumns;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={handleBack} />
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Consumptieoverzicht</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Leidingsgroep Totaal</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1e293b] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
          <button
            onClick={() => changeWeek('prev')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <span className="material-icons-round">chevron_left</span>
          </button>
          <div className="text-center flex flex-col gap-1">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Week {getWeekNumber(currentDate)}</p>
            <p className="text-gray-900 dark:text-white font-bold text-lg leading-none">{getWeekRange(currentDate)}</p>
          </div>
          <button
            onClick={() => changeWeek('next')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <span className="material-icons-round">chevron_right</span>
          </button>
        </div>

        {/* Active Sort Indicator */}
        <div className="mx-2 mb-2 px-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Gesorteerd op:</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-semibold truncate">
              {sortOption === 'alphabetical' ? 'Naam (A-Z)' : sortOption}
            </span>
          </div>
          <button
            onClick={() => setShowSortMenu(true)}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <span className="material-icons-round">sort</span>
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex-1 overflow-hidden flex flex-col mx-2 transition-colors">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={col}
                      onClick={() => {
                        if (idx === 0) setSortOption('alphabetical');
                        else setSortOption(col as any);
                      }}
                      className={`py-4 px-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${idx === 0 ? 'sticky left-0 bg-gray-50 dark:bg-gray-800 border-r dark:border-gray-700' : 'text-center'}`}
                    >
                      <div className={`flex items-center gap-1 ${idx !== 0 ? 'justify-center' : ''}`}>
                        {col}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td colSpan={columns.length} className="px-4 py-2">
                        <SkeletonRow />
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedData.map((row, rowIdx) => {
                    const isCurrentUser = row.id === currentUser?.id;
                    return (
                      <tr
                        key={rowIdx}
                        className={`${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 z-10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} transition-colors relative`}
                      >
                        <td className={`py-4 px-4 font-medium text-sm sticky left-0 border-r border-gray-100 dark:border-gray-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] ${isCurrentUser ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-[#131b2e]' : 'text-gray-900 dark:text-white bg-white dark:bg-surface-dark'}`}>
                          <div className="flex items-center gap-2">
                            {isCurrentUser && <span className="material-icons-round text-xs text-blue-500">person</span>}
                            {row.name}
                          </div>
                        </td>
                        {row.values.map((val, vIdx) => (
                          <td key={vIdx} className={`py-4 px-4 text-center text-sm ${sortOption === columns[vIdx + 1] ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10' : 'text-gray-600 dark:text-gray-300'}`}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 font-bold sticky bottom-0 z-10 border-t-2 border-gray-100 dark:border-gray-700">
                <tr>
                  <td className="py-4 px-4 text-gray-900 dark:text-white text-sm sticky left-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 uppercase">
                    Totaal
                  </td>
                  {totals.map((total, tIdx) => (
                    <td key={tIdx} className="py-4 px-4 text-center text-gray-900 dark:text-white text-sm">
                      {total}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>

      {/* Sort Menu Modal */}
      <BottomSheet 
        isOpen={showSortMenu} 
        onClose={() => setShowSortMenu(false)} 
        title="Sorteer lijst op"
      >
        <div className="space-y-3">
          <button
            onClick={() => { setSortOption('alphabetical'); setShowSortMenu(false); }}
            className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${sortOption === 'alphabetical' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent'}`}
          >
            <span className="font-bold">Alfabetisch (A-Z)</span>
            {sortOption === 'alphabetical' && <span className="material-icons-round">check</span>}
          </button>

          <div className="pt-2">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-3 pl-1">Meeste strepen per soort</p>
            <div className="grid grid-cols-1 gap-2">
              {columns.slice(1).map(col => (
                <button
                  key={col}
                  onClick={() => { setSortOption(col); setShowSortMenu(false); }}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${sortOption === col ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent'}`}
                >
                  <span className="font-bold">{col}</span>
                  {sortOption === col && <span className="material-icons-round">check</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
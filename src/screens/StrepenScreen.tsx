import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Drink, User } from '../types';
import { ChevronBack } from '../components/ChevronBack';
import { supabase } from '../lib/supabase';
import { AppContextType } from '../App';
// Users now come from context (useOutletContext)

export const StrepenScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    balance: currentBalance,
    handleAddCost: onAddCost,
    currentUser,
    setCurrentUser: onUpdateUser,
    drinks,
    setDrinks: onUpdateDrinks,
    users,
    activePeriod
  } = useOutletContext<AppContextType>();
  // State to store count PER drink ID. Key = drinkId (string), Value = count (number)
  // Value 0 represents an empty input (user cleared it)
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({});

  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(drinks.length > 0 ? drinks[0] : null);
  const [totalToday, setTotalToday] = useState(4);

  // State for data from Supabase
  // We use drinks from props now
  const [loading, setLoading] = useState(false);

  // Admin / Team Drank State
  const [isManageMode, setIsManageMode] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState('');

  // Temporary Drink State
  const [isTemporary, setIsTemporary] = useState(false);
  const [validUntil, setValidUntil] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selected drink if it was null
  useEffect(() => {
    if (!selectedDrink && drinks.length > 0) {
      setSelectedDrink(drinks[0]);
    }
  }, [drinks, selectedDrink]);

  // Helper to get count for current drink
  // Returns 0 if cleared, otherwise defaults to 1 if not set
  const getCurrentCountRaw = () => {
    if (!selectedDrink) return 1;
    const val = drinkCounts[String(selectedDrink.id)];
    return val !== undefined ? val : 1;
  };

  // Helper to set count for current drink
  const updateCurrentCount = (val: number) => {
    if (!selectedDrink) return;
    // Allow 0 (for empty input), but prevent negative
    const safeVal = Math.max(0, val);
    setDrinkCounts(prev => ({
      ...prev,
      [String(selectedDrink.id)]: safeVal
    }));
  };

  // Set default date to 1 week from now when component mounts
  useEffect(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setValidUntil(nextWeek.toISOString().split('T')[0]);
  }, []);

  // Fetching is now handled in App.tsx to share data
  const fetchDrinks = async () => {
    // This is now a no-op as we use props
  };

  // 1. Fetch Drinks from Supabase (Effect removed as handled in App.tsx)

  // 3. Add New Drink (Admin/Team Drank)
  const handleAddNewDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrinkName || !newDrinkPrice) return;

    setIsSubmitting(true);
    try {
      const price = parseFloat(newDrinkPrice.replace(',', '.'));

      const newDrinkPayload = {
        name: newDrinkName,
        price: price,
        isTemporary: isTemporary,
        validUntil: isTemporary ? validUntil : null,
      };

      const { data, error } = await supabase
        .from('dranken')
        .insert([newDrinkPayload])
        .select();

      if (error) throw error;

      if (data) {
        onUpdateDrinks([...drinks, ...data]);
        resetForm();
        alert('Drank succesvol toegevoegd!');
      }
    } catch (error) {
      console.log('Demo mode: Adding drink locally');
      // Fallback for demo without backend
      const mockId = Math.random().toString(36).substr(2, 9);
      const newMockDrink: Drink = {
        id: mockId,
        name: newDrinkName,
        price: parseFloat(newDrinkPrice.replace(',', '.')),
        isTemporary: isTemporary,
        validUntil: isTemporary ? validUntil : undefined
      };
      onUpdateDrinks([...drinks, newMockDrink]);
      resetForm();
      alert('Drank toegevoegd (Demo modus)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewDrinkName('');
    setNewDrinkPrice('');
    setIsTemporary(false);
    // Reset date to next week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setValidUntil(nextWeek.toISOString().split('T')[0]);
  };

  // Helper to calculate the start of the current week (Saturday 08:00)
  const getResetDateString = () => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const hour = now.getHours();

    const lastSaturday = new Date(now);

    // Logic: 
    // If today is Saturday (6) AND hour >= 8, then "last Saturday 8am" is today.
    // If today is Saturday (6) AND hour < 8, then it's last week Saturday (-7 days).
    // If today is Sunday (0), it is -1 day.
    // If today is Friday (5), it is -6 days.

    let daysToSubtract = 0;
    if (day === 6 && hour >= 8) {
      daysToSubtract = 0;
    } else {
      // (day + 1) maps Sun(0)->1 ... Fri(5)->6
      daysToSubtract = day + 1;
    }

    lastSaturday.setDate(now.getDate() - daysToSubtract);
    lastSaturday.setHours(8, 0, 0, 0);

    return lastSaturday.toLocaleDateString('nl-BE', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const resetDateStr = getResetDateString();

  // Generate Leaderboard based on users prop
  // In a real app, this would come from a query aggregation where timestamp >= resetDate
  const leaderboard = users.map((user, index) => ({
    id: user.id,
    name: user.nickname || user.name, // Use nickname if available
    avatar: user.avatar,
    status: user.status,
    // Mock random beer counts for display purposes
    beerCount: Math.floor(Math.random() * 40) + 5,
    lastActive: index % 3 === 0 ? 'Zonet' : `${index + 1}u geleden`
  })).sort((a, b) => b.beerCount - a.beerCount).slice(0, 10);

  const handleAddStripe = () => {
    if (!selectedDrink) return;

    // If raw is 0 (empty input), default to 1 for the action
    const raw = getCurrentCountRaw();
    const countToAdd = raw === 0 ? 1 : raw;

    const cost = countToAdd * selectedDrink.price;

    // Update global balance with quantity
    onAddCost(selectedDrink.price, selectedDrink, countToAdd);

    // Optimistic update local
    setTotalToday(prev => prev + countToAdd);

    // Reset count for THIS drink back to 1
    updateCurrentCount(1);
  };

  // Safe count for display calculations (treat 0 as 0 for price calc, but logic handles it)
  const displayCount = getCurrentCountRaw();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-[#1e2330] pt-6 pb-6 px-4 shadow-sm relative z-10 rounded-b-[2rem] transition-colors">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ChevronBack onClick={() => navigate(-1)} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Strepen</h1>
          </div>
          {/* Settings button toggles Manage mode */}
          <div
            onClick={() => setIsManageMode(!isManageMode)}
            className={`p-2 rounded-full cursor-pointer transition-colors ${isManageMode ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            <span className="material-icons-round">{isManageMode ? 'close' : 'settings'}</span>
          </div>
        </div>
        <div
          onClick={() => navigate('/mijn-factuur')}
          className="bg-blue-600 dark:bg-blue-600 text-white p-4 rounded-xl flex items-center justify-between shadow-lg shadow-blue-600/20 cursor-pointer active:scale-[0.98] transition-transform group"
        >
          <div>
            <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">
              {activePeriod ? `Voorlopige Rekening (${activePeriod.naam})` : 'Voorlopige Rekening'}
            </p>
            <p className="text-2xl font-bold">€ {currentBalance.toFixed(2).replace('.', ',')}</p>
          </div>
          <span className="material-icons-round text-white/70">chevron_right</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-nav-safe">
        {/* History Action */}
        <div
          onClick={() => navigate('/strepen/geschiedenis')}
          className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <span className="material-icons-round text-sm">history</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white">Mijn geschiedenis</span>
          </div>
          <span className="material-icons-round text-gray-400">chevron_right</span>
        </div>

        {/* Input Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-icons-round text-blue-600 dark:text-blue-500">add_circle</span>
              Strepen zetten
            </h2>
            {loading && <span className="text-xs text-gray-400">Laden...</span>}
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">

            {/* Header: User Info only */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-500 font-bold">J</div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Jouw Totaal</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vandaag: {totalToday} streepjes</p>
              </div>
            </div>

            {/* Drink Selector */}
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">Kies Drank</p>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {drinks.map(drink => (
                  <button
                    key={drink.id}
                    onClick={() => setSelectedDrink(drink)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap shadow-sm transition-all flex items-center gap-2 ${selectedDrink?.id === drink.id
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-[#1e2330]'
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    {drink.name}
                    {drink.isTemporary && <span className="material-icons-round text-[10px] opacity-70">timer</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Stepper */}
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">Aantal</p>
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => updateCurrentCount(displayCount - 1)}
                  className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                >
                  <span className="material-icons-round text-3xl">remove</span>
                </button>

                <div className="flex-1 flex flex-col items-center justify-center h-14 bg-gray-50 dark:bg-[#151a25] rounded-2xl border border-gray-200 dark:border-gray-700/50 relative overflow-hidden group focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="1"
                    value={displayCount === 0 ? '' : displayCount}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                      if (!isNaN(val)) updateCurrentCount(val);
                    }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full text-center bg-transparent border-none p-0 text-2xl font-black text-gray-900 dark:text-white focus:ring-0 appearance-none m-0"
                    style={{ MozAppearance: 'textfield' }}
                  />
                </div>

                <button
                  onClick={() => updateCurrentCount(displayCount + 1)}
                  className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                >
                  <span className="material-icons-round text-3xl">add</span>
                </button>
              </div>
            </div>

            {/* CONFIRM BUTTON */}
            <button
              onClick={handleAddStripe}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-between group active:scale-[0.98] transition-all"
            >
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium text-blue-200 uppercase">Toevoegen</span>
                <span className="text-lg">
                  {displayCount === 0 ? 1 : displayCount}x {selectedDrink ? selectedDrink.name : 'Selecteer'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold bg-white/20 px-3 py-1 rounded-lg">
                  € {((selectedDrink?.price || 0) * (displayCount === 0 ? 1 : displayCount)).toFixed(2)}
                </span>
                <span className="material-icons-round text-white/70">chevron_right</span>
              </div>
            </button>
          </div>
        </section>

        {/* 2. Admin / Team Drank Section */}
        {isManageMode && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons-round text-orange-500">settings_applications</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Beheer (Admin & Team Drank)</h2>
            </div>

            <form onSubmit={handleAddNewDrink} className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-5 rounded-2xl space-y-4">

              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200">Nieuwe drank toevoegen</h3>
                {/* Permanent vs Temporary Toggle */}
                <div className="bg-white dark:bg-[#1f293b] p-1 rounded-lg border border-orange-200 dark:border-orange-800 flex text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setIsTemporary(false)}
                    className={`px-3 py-1 rounded-md transition-all ${!isTemporary ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Permanent
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTemporary(true)}
                    className={`px-3 py-1 rounded-md transition-all ${isTemporary ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Tijdelijk
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Naam</label>
                  <input
                    type="text"
                    placeholder="Naam (bv. Mojito)"
                    value={newDrinkName}
                    onChange={(e) => setNewDrinkName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Prijs</label>
                  <input
                    type="number"
                    step="0.10"
                    inputMode="decimal"
                    placeholder="€"
                    value={newDrinkPrice}
                    onChange={(e) => setNewDrinkPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {isTemporary && (
                <div className="animate-in fade-in duration-300">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Geldig tot (verdwijnt automatisch)</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 ml-1 flex items-center gap-1">
                    <span className="material-icons-round text-xs">info</span>
                    Ideaal voor speciale activiteiten of cocktailavonden.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="text-xs">Toevoegen...</span>
                ) : (
                  <>
                    <span className="material-icons-round text-sm">add</span>
                    {isTemporary ? 'Tijdelijke Drank Toevoegen' : 'Toevoegen aan Lijst'}
                  </>
                )}
              </button>
            </form>
          </section>
        )}

        {/* Nudge Banner */}
        <div
          onClick={() => navigate('/nudges')}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 shadow-lg shadow-indigo-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="material-icons-round text-2xl text-white">back_hand</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Stuur een Nudge</h3>
              <p className="text-xs text-indigo-100 leading-tight">Stuur een anonieme herinnering<br />naar een medeleider</p>
            </div>
          </div>
          <span className="material-icons-round text-white/70">chevron_right</span>
        </div>

        {/* Top 10 Leaderboard Section */}
        <section>
          <div className="flex items-center justify-between mb-3 mt-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-round text-amber-500">emoji_events</span>
                Top 10 Bier van deze week
              </h2>
              <p className="text-[10px] text-gray-400 font-medium ml-8 mt-0.5">Sinds {resetDateStr}</p>
            </div>
            <button
              onClick={() => navigate('/strepen/overzicht')}
              className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline"
            >
              Bekijk alles
            </button>
          </div>

          <div className="space-y-3">
            {leaderboard.map((user, index) => {
              // Medal colors for top 3
              let rankColor = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
              if (index === 0) rankColor = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700";
              if (index === 1) rankColor = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600";
              if (index === 2) rankColor = "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-700";

              return (
                <div key={user.id} className="bg-white dark:bg-[#1e2330] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rankColor}`}>
                      #{index + 1}
                    </div>
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.status === 'online' ? 'Online' : 'Offline'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className="material-icons-round text-amber-500 text-xs">sports_bar</span>
                    <span className="font-bold text-gray-700 dark:text-gray-200">{user.beerCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick Streep Setting */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-icons-round text-blue-600 dark:text-blue-500">bolt</span>
              Quick Streep Instelling
            </h2>
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Kies welk drankje je direct wilt kunnen strepen vanaf het startscherm.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {drinks.map(drink => (
                <button
                  key={`quick-${drink.id}`}
                  onClick={() => onUpdateUser({ ...currentUser, quickDrinkId: String(drink.id) })}
                  className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-between ${String(currentUser.quickDrinkId || (drinks.length > 0 ? drinks[0].id : null)) === String(drink.id)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <span className="truncate">{drink.name}</span>
                  {String(currentUser.quickDrinkId || (drinks.length > 0 ? drinks[0].id : null)) === String(drink.id) && (
                    <span className="material-icons-round text-sm">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
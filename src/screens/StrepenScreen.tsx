import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { Drink, User } from '../types';
import { ChevronBack } from '../components/ChevronBack';
import { hapticSuccess } from '../lib/haptics';
import { StrepenAdminPanel } from '../components/Strepen/StrepenAdminPanel';
import { SPECIAL_DRINKS } from '../lib/constants';
import { updateProfile } from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { hasRole } from '../lib/roleUtils';
import { UserAvatar } from '../components/UserAvatar';

export const StrepenScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser: onUpdateUser, users } = useAuth();
  const { balances, handleAddCost: onAddCost, dranken: drinks, streaks, activePeriod } = useDrink();
  const currentBalance = balances && currentUser ? balances[(currentUser?.id || '')] || 0 : 0;
  
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({});
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(drinks.length > 0 ? drinks[0] : null);
  const [totalToday, setTotalToday] = useState(0); 
  const [isManageMode, setIsManageMode] = useState(false);

  const isTeamDrank = hasRole(currentUser, 'drank') || hasRole(currentUser, 'hoofdleiding');

  useEffect(() => {
    if (!selectedDrink && drinks.length > 0) setSelectedDrink(drinks[0]);
  }, [drinks, selectedDrink]);

  const getCurrentCountRaw = () => {
    if (!selectedDrink) return 1;
    const val = drinkCounts[String(selectedDrink.id)];
    return val !== undefined ? val : 1;
  };

  const updateCurrentCount = (val: number) => {
    if (!selectedDrink) return;
    setDrinkCounts(prev => ({ ...prev, [String(selectedDrink.id)]: Math.max(0, val) }));
  };

  const getResetDateString = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const lastSaturday = new Date(now);
    let daysToSubtract = (day === 6 && hour >= 8) ? 0 : day + 1;
    lastSaturday.setDate(now.getDate() - daysToSubtract);
    lastSaturday.setHours(8, 0, 0, 0);
    return lastSaturday.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const resetDateStr = getResetDateString();

  const leaderboard = useMemo(() => {
    const counts: { [userId: string]: number } = {};
    const now = new Date();
    const saturdayReset = new Date(now);
    const day = now.getDay();
    const hour = now.getHours();
    let daysToSubtract = (day === 6 && hour >= 8) ? 0 : day + 1;
    saturdayReset.setDate(now.getDate() - daysToSubtract);
    saturdayReset.setHours(8, 0, 0, 0);

    const thisWeekStreaks = streaks.filter((s: any) => 
      new Date(s.timestamp) >= saturdayReset && 
      s.drinkName === 'Freedom' // Hier tellen we enkel nog de Freedom-streepjes
    );
    thisWeekStreaks.forEach((s: any) => { counts[s.userId] = (counts[s.userId] || 0) + (s.amount || 1); });

    return users.map((user: User) => ({
      id: user.id, name: user.nickname || user.name, avatar: user.avatar, status: user.status, beerCount: counts[user.id] || 0
    })).filter(item => item.beerCount > 0).sort((a, b) => b.beerCount - a.beerCount).slice(0, 10);
  }, [users, streaks]);

  const handleAddStripe = () => {
    if (!selectedDrink) return;
    const raw = getCurrentCountRaw();
    const countToAdd = raw === 0 ? 1 : raw;
    onAddCost(currentUser?.id || '', selectedDrink.id, countToAdd, currentUser?.naam);
    hapticSuccess();
    setTotalToday(prev => prev + countToAdd);
    updateCurrentCount(1);
  };

  const displayCount = getCurrentCountRaw();

  const validQuickDrinks = useMemo(() => {
    return drinks.filter(d => d.name === 'Frisdrank' || d.name === 'Freedom');
  }, [drinks]);
  
  const activeQuickDrinkId = String(currentUser?.quickDrinkId || (validQuickDrinks.length > 0 ? validQuickDrinks[0].id : ''));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      <header className="bg-white dark:bg-[#1e2330] pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6 px-4 shadow-sm relative z-10 rounded-b-[2rem] transition-colors">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ChevronBack onClick={() => navigate(-1)} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Strepen</h1>
          </div>
          <div onClick={() => setIsManageMode(!isManageMode)} className={`p-2 rounded-full cursor-pointer transition-colors ${isManageMode ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            <span className="material-icons-round">{isManageMode ? 'close' : 'settings'}</span>
          </div>
        </div>
        <div onClick={() => navigate('/mijn-factuur')} className="bg-blue-600 dark:bg-blue-600 text-white p-4 rounded-xl flex items-center justify-between shadow-lg shadow-blue-600/20 cursor-pointer active:scale-[0.98] transition-transform group">
          <div>
            <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">{activePeriod ? `Voorlopige Rekening (${activePeriod.naam})` : 'Voorlopige Rekening'}</p>
            <p className="text-2xl font-bold">€ {currentBalance.toFixed(2).replace('.', ',')}</p>
          </div>
          <span className="material-icons-round text-white/70">chevron_right</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {/* Mijn geschiedenis & Admin Dashboard Links */}
        <div className="space-y-3">
          <div onClick={() => navigate('/strepen/geschiedenis')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform"><span className="material-icons-round text-sm">history</span></div>
              <span className="font-bold text-gray-900 dark:text-white">Mijn geschiedenis</span>
            </div>
            <span className="material-icons-round text-gray-400">chevron_right</span>
          </div>

          {isTeamDrank && (
            <div onClick={() => navigate('/strepen/dashboard')} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg text-blue-700 dark:text-blue-400 group-hover:scale-110 transition-transform"><span className="material-icons-round text-sm">admin_panel_settings</span></div>
                <div className="flex flex-col">
                  <span className="font-bold text-blue-900 dark:text-blue-100">Team Drank Dashboard</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">Beheer voorraad, strepen & facturen</span>
                </div>
              </div>
              <span className="material-icons-round text-blue-500">chevron_right</span>
            </div>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-icons-round text-blue-600 dark:text-blue-500">add_circle</span>Strepen zetten</h2>
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <UserAvatar user={currentUser} size="md" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Jouw Totaal</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vandaag: {totalToday} streepjes</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">Kies Drank</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {drinks.filter(d => d.name === 'Frisdrank' || d.name === 'Freedom').map(drink => (
                  <button key={drink.id} onClick={() => setSelectedDrink(drink)} className={`px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap shadow-sm transition-all flex items-center gap-2 ${selectedDrink?.id === drink.id ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-[#1e2330]' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}>
                    {drink.name}
                    {drink.isTemporary && <span className="material-icons-round text-[10px] opacity-70">timer</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">Aantal</p>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => updateCurrentCount(displayCount - 1)} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center shadow-sm"><span className="material-icons-round text-3xl">remove</span></button>
                <div className="flex-1 flex flex-col items-center justify-center h-14 bg-gray-50 dark:bg-[#151a25] rounded-2xl border border-gray-200 dark:border-gray-700/50 relative overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                  <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" value={displayCount === 0 ? '' : displayCount} onChange={(e) => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); if (!isNaN(val)) updateCurrentCount(val); }} onClick={(e) => (e.target as HTMLInputElement).select()} className="w-full text-center bg-transparent border-none p-0 text-2xl font-black text-gray-900 dark:text-white focus:ring-0 appearance-none m-0 focus:outline-none" style={{ MozAppearance: 'textfield' }} />
                </div>
                <button onClick={() => updateCurrentCount(displayCount + 1)} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center shadow-sm"><span className="material-icons-round text-3xl">add</span></button>
              </div>
            </div>

            <button onClick={handleAddStripe} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium text-blue-200 uppercase">Toevoegen</span>
                <span className="text-lg">{displayCount === 0 ? 1 : displayCount}x {selectedDrink ? selectedDrink.name : 'Selecteer'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold bg-white/20 px-3 py-1 rounded-lg">€ {((selectedDrink?.price || 0) * (displayCount === 0 ? 1 : displayCount)).toFixed(2)}</span>
                <span className="material-icons-round text-white/70">chevron_right</span>
              </div>
            </button>

            {drinks.find(d => d.name === SPECIAL_DRINKS.BAK_FREEDOM) && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <button 
                  onClick={() => { 
                    const bak = drinks.find(d => d.name === SPECIAL_DRINKS.BAK_FREEDOM)!; 
                    onAddCost(currentUser?.id || '', bak.id, 1, currentUser?.naam); 
                    hapticSuccess();
                    setTotalToday(prev => prev + 1); 
                  }} 
                  className="w-full bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-400 py-3 px-4 rounded-2xl shadow-sm flex items-center justify-between active:scale-[0.98] transition-all group border border-amber-200 dark:border-amber-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-amber-100 dark:bg-amber-800/30 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span className="material-icons-round text-2xl text-amber-600 dark:text-amber-500">sports_bar</span>
                    </div>
                    <div className="text-left flex flex-col justify-center">
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-0.5 opacity-80">Snel Actie</span>
                      <span className="text-base font-bold leading-tight text-gray-900 dark:text-white">{SPECIAL_DRINKS.BAK_FREEDOM}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-700">
                      € {drinks.find(d => d.name === SPECIAL_DRINKS.BAK_FREEDOM)?.price.toFixed(2).replace('.', ',')}
                    </span>
                    <div className="bg-amber-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-110 transition-transform">
                      +1
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </section>

        {isManageMode && (
          <StrepenAdminPanel onDrinkDeleted={(id) => { if (selectedDrink?.id === id && drinks.length > 0) setSelectedDrink(drinks[0]); }} />
        )}

        <div onClick={() => navigate('/nudges')} className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 shadow-lg shadow-indigo-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center"><span className="material-icons-round text-2xl text-white">back_hand</span></div>
            <div>
              <h3 className="font-bold text-white text-base">Stuur een Nudge</h3>
              <p className="text-xs text-indigo-100 leading-tight">Stuur een anonieme herinnering<br />naar een medeleider</p>
            </div>
          </div>
          <span className="material-icons-round text-white/70">chevron_right</span>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3 mt-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-icons-round text-amber-500">emoji_events</span>Top 10 Bier van deze week</h2>
              <p className="text-[10px] text-gray-400 font-medium ml-8 mt-0.5">Sinds {resetDateStr}</p>
            </div>
          </div>
          <div className="space-y-3">
            {leaderboard.map((user, index) => {
              let rankColor = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
              if (index === 0) rankColor = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 border border-yellow-200";
              if (index === 1) rankColor = "bg-gray-200 dark:bg-gray-700 text-gray-700 border border-gray-300";
              if (index === 2) rankColor = "bg-orange-100 dark:bg-orange-900/40 text-orange-800 border border-orange-200";
              return (
                <div key={user.id} className="bg-white dark:bg-[#1e2330] p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rankColor}`}>#{index + 1}</div>
                    <UserAvatar user={user} size="md" className="border-2 border-white dark:border-gray-700 shadow-sm" />
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

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-icons-round text-blue-600 dark:text-blue-500">bolt</span>Quick Streep Instelling</h2>
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Kies welk drankje je direct wilt kunnen strepen vanaf het startscherm. Dit wordt opgeslagen in je profiel.</p>
            <div className="grid grid-cols-2 gap-2">
              {validQuickDrinks.map(drink => (
                <button 
                  key={`quick-${drink.id}`} 
                  onClick={async () => {
                    const newDrinkId = String(drink.id);
                    onUpdateUser({ ...currentUser, id: currentUser?.id || '', quickDrinkId: newDrinkId } as User);
                    try {
                      await updateProfile(currentUser?.id || '', { quick_drink_id: newDrinkId });
                      showToast(`${drink.name} ingesteld als Quick Streep!`, 'success');
                    } catch (e) {
                      showToast('Kon instelling niet opslaan', 'error');
                    }
                  }} 
                  className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-between ${activeQuickDrinkId === String(drink.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-700 shadow-sm' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                >
                  <span className="truncate">{drink.name}</span>
                  {activeQuickDrinkId === String(drink.id) && <span className="material-icons-round text-sm">check_circle</span>}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from '../drank/DrinkContext';
import { useAgenda } from '../agenda/AgendaContext';
import { Event, CountdownItem, User, Drink } from '../../types';
import { hasAccess } from '../../lib/roleUtils';
import { SPECIAL_DRINKS } from '../../lib/constants';

import { SkeletonWidget, SkeletonCard, SkeletonEvent } from '../../components/Skeleton';
import { NavCard } from '../../components/NavCard';
import { UserAvatar } from '../../components/UserAvatar';

export const HomeScreen: React.FC = () => {
  const { currentUser, users, loading: authLoading } = useAuth();
  const { balances, handleAddCost, dranken: drinks, loading: drinkLoading } = useDrink();
  const { events, countdowns } = useAgenda();
  
  const loading = authLoading || drinkLoading;
  const navigate = useNavigate();

  const displayName = currentUser?.nickname || currentUser?.name?.split(' ')[0] || 'Lid';

  // Memoized Data
  const quickDrink = useMemo(() => {
    const validDrinks = drinks.filter(d => d.name !== SPECIAL_DRINKS.BAK_FREEDOM && !d.isTemporary);
    const fallback = validDrinks.length > 0 ? validDrinks[0] : null;
    if (!currentUser?.quick_drink_id) return fallback;
    return validDrinks.find(d => String(d.id) === String(currentUser.quick_drink_id)) || fallback;
  }, [drinks, currentUser?.quick_drink_id]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (events || [])
      .filter(e => e && e.date && new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 2);
  }, [events]);

  const validCountdowns = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return countdowns
      .filter(c => {
        const t = new Date(c.targetDate);
        t.setHours(0, 0, 0, 0);
        return t.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  }, [countdowns]);

  return (
    <div className="flex flex-col h-full relative bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      <header className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6 flex justify-between items-center bg-gray-50 dark:bg-[#0f172a] shadow-sm transition-colors sticky top-0 z-20">
        <div className="flex flex-col justify-center">
          <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">KSA Aalter</span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Welkom, {displayName}</h1>
        </div>
        <UserAvatar user={currentUser || undefined} size="md" className="ring-2 ring-white dark:ring-slate-800 shadow-sm cursor-pointer active:scale-95 transition-transform shrink-0" />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-24">
        {loading ? (
          <div className="space-y-6">
            <SkeletonCard lines={2} />
            <div className="grid grid-cols-2 gap-3"><SkeletonWidget /><SkeletonWidget /></div>
            <SkeletonEvent />
          </div>
        ) : (
          <>
            {/* --- 1. PUBLIEKE WIDGETS (ZICHTBAAR VOOR IEDEREEN) --- */}

            {/* --- 1. AFTELKLOKKEN --- */}
            {validCountdowns && validCountdowns.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-icons-round text-primary text-sm">timer</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aftelklokken</h2>
                </div>
                <div className={`grid gap-3 ${validCountdowns.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {validCountdowns.map((item) => {
                    // Robuuste datum berekening
                    const target = new Date(item.targetDate);
                    target.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysLeft < 0) return null;
                    
                    const isToday = daysLeft === 0;

                    return (
                      <div key={item.id} className={`bg-white dark:bg-[#1e2330] p-3.5 rounded-2xl shadow-sm border ${isToday ? 'border-rose-200 dark:border-rose-900/50' : 'border-gray-100 dark:border-gray-800'} flex items-center gap-3 transition-colors`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isToday ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                          <span className={`material-icons-round text-xl ${isToday ? 'animate-pulse' : ''}`}>{isToday ? 'celebration' : 'hourglass_empty'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate text-gray-900 dark:text-white mb-0.5">{item.title}</h3>
                          <p className={`text-xs font-medium truncate ${isToday ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}>
                            {isToday ? 'Is vandaag! 🎉' : `Nog ${daysLeft} nacht${daysLeft === 1 ? '' : 'en'}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}


            {/* --- 2. AGENDA / AANKOMENDE EVENTS --- */}
            {upcomingEvents && upcomingEvents.length > 0 && (
              <section className="space-y-3 mt-6">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary text-sm">calendar_today</span>
                    <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agenda</h2>
                  </div>
                  <button onClick={() => navigate('/agenda')} className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Bekijk alles</button>
                </div>
                <div className="grid gap-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} onClick={() => navigate('/agenda')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform">
                      <div className="flex flex-col items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                        <span className="text-[10px] font-black uppercase leading-none mb-1">{new Date(event.date).toLocaleDateString('nl-BE', { month: 'short' })}</span>
                        <span className="text-xl font-black leading-none">{new Date(event.date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base truncate dark:text-white mb-1">{event.title}</h3>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <span className="material-icons-round text-[14px]">schedule</span>
                          <span className="text-xs font-medium">{event.startTime || '20:00'}</span>
                          <span className="mx-1">•</span>
                          <span className="material-icons-round text-[14px]">place</span>
                          <span className="text-xs font-medium truncate">{event.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SNELLE ACTIES (STREPEN / FRIETEN) */}
            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => navigate('/strepen')} className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 shrink-0"><span className="material-icons-round">local_bar</span></div>
                  <h3 className="font-semibold text-lg dark:text-white">Strepen</h3>
                </div>
                {quickDrink && (
                  <button onClick={(e) => { e.stopPropagation(); if (currentUser) handleAddCost(currentUser.id, quickDrink.id, 1, currentUser.naam); }} className="w-full bg-blue-50 dark:bg-blue-900/20 py-3 px-4 rounded-xl flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <span className="text-sm font-bold dark:text-blue-300">Snel {quickDrink.name}</span>
                    <span className="font-black text-lg text-blue-700 dark:text-blue-300">+1</span>
                  </button>
                )}
              </div>

              <div onClick={() => navigate('/frituur')} className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600"><span className="material-icons-round">fastfood</span></div>
                  <h3 className="font-semibold text-lg dark:text-white">Frieten</h3>
                </div>
                <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-between dark:text-gray-300">Bestelling plaatsen <span className="material-icons-round text-xs">arrow_forward_ios</span></div>
              </div>
            </div>

            {/* --- 3. ADMIN DASHBOARDS --- */}
            
            {hasAccess(currentUser, 'financiën') && (
              <section className="pt-2">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">account_balance</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiën</h2>
                </div>
                <NavCard title="Financieel Dashboard" description="Onkostennota's & overzichten" icon="account_balance_wallet" iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" onClick={() => navigate('/financien')} />
              </section>
            )}

            {hasAccess(currentUser, 'hoofdleiding') && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">admin_panel_settings</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hoofdleiding</h2>
                </div>
                <div className="grid gap-3">
                  <NavCard title="Rollen & Beheer" description="Rechten aanpassen" icon="manage_accounts" iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" onClick={() => navigate('/admin/rollen')} />
                  <NavCard title="Bericht Versturen" description="Naar leiding of groepen" icon="send" iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" onClick={() => navigate('/notificaties/nieuw')} />
                </div>
              </section>
            )}

            {hasAccess(currentUser, 'drank') && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">local_drink</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team Drank</h2>
                </div>
                <div className="grid gap-3">
                  <NavCard title="Team Drank Beheer" description="Dashboard, Strepen & Facturen" icon="local_bar" iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" onClick={() => navigate('/strepen/dashboard')} />
                  <NavCard title="Frituur Admin" description="Kasticketjes & Prijsverschillen" icon="fastfood" iconColorClass="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" onClick={() => navigate('/team-drank/frieten')} />
                </div>
              </section>
            )}

            {hasAccess(currentUser, 'sfeerbeheer') && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">celebration</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sfeerbeheer</h2>
                </div>
                <div className="grid gap-3">
                  <NavCard title="Agenda & Aftelklok" description="Events en sfeer beheren" icon="edit_calendar" iconColorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" onClick={() => navigate('/agenda/beheer')} />
                </div>
              </section>
            )}

            {hasAccess(currentUser, 'winkeltje') && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">storefront</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Winkeltje</h2>
                </div>
                <NavCard title="Winkeltje Dashboard" description="Beheer kledij en materiaal" icon="dashboard" iconColorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" onClick={() => navigate('/winkeltje/dashboard')} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};
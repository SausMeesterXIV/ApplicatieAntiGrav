import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useAgenda } from '../contexts/AgendaContext';
import { Event, QuoteItem, CountdownItem, User, Drink } from '../types';

import { hasRole } from '../lib/roleUtils';
import { SkeletonWidget, SkeletonCard, SkeletonEvent } from '../components/Skeleton';
import { NavCard } from '../components/NavCard';

export const HomeScreen: React.FC = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { balances, handleQuickStreep, dranken: drinks, loading: drinkLoading } = useDrink();
  const { events, quotes, countdowns } = useAgenda();
  
  const loading = authLoading || drinkLoading;
  const balance = balances && currentUser ? balances[currentUser?.id] || 0 : 0;

  const navigate = useNavigate();

  const displayName = currentUser?.nickname || currentUser?.name?.split(' ')[0] || 'Lid';

  // OPTIMALISATIE: Bereken de fallback en quickDrink enkel opnieuw als de drankenlijst of gebruikerkeuze wijzigt.
  const quickDrink = useMemo(() => {
    const fallback = drinks.length > 0 ? String(drinks[0].id) : null;
    return drinks.find(d => String(d.id) === String(currentUser?.quickDrinkId || fallback));
  }, [drinks, currentUser?.quickDrinkId]);

  // OPTIMALISATIE: Gebruik useMemo om de events te filteren en te sorteren.
  // Hierdoor berekenen we dit niet meer on-the-fly bij elke render van het scherm!
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Vaste basis voor vergelijkingen
    
    return (events || [])
      .filter(e => e && e.date && new Date(e.date) >= today) // Filter verleden (behalve vandaag)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sorteer chronologisch
      .slice(0, 2); // Neem de eerste 2
  }, [events]);

  // Find Quote of the Week (Most likes - dislikes) from Recent Quotes only (< 4 weeks)
  const topQuote = useMemo(() => {
    const today = new Date();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(today.getDate() - 28);

    const recentQuotes = quotes.filter(q => new Date(q.date) >= fourWeeksAgo);

    if (recentQuotes.length === 0) return null;

    // Sort by Net Score
    return [...recentQuotes].sort((a, b) => (b.likes.length - b.dislikes.length) - (a.likes.length - a.dislikes.length))[0];
  }, [quotes]);

  // Pre-filter valid countdowns (only today or future) AND SORT them by date
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

  // Camp Countdown Logic Helper
  const renderCountdown = (item: CountdownItem, index: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(item.targetDate);
    // Explicitly set target hours to match "start of day" calculation to avoid off-by-one errors
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Safety check (already filtered, but robust)
    if (daysLeft < 0) return null;

    if (daysLeft === 0) {
      // Today is the day!
      return (
        <div key={item.id} className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 text-white shadow-lg shadow-pink-500/30 relative overflow-hidden animate-pulse">
          <div className="flex flex-col items-center justify-center relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-icons-round text-lg">celebration</span>
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">Vandaag is start</span>
            </div>
            <h2 className="text-xl font-extrabold text-center leading-tight">{item.title}!</h2>
          </div>
        </div>
      );
    }

    // Future
    const targetMonth = target.toLocaleString('nl-BE', { month: 'short' }).toUpperCase();
    const targetDay = target.getDate();

    return (
      <div
        key={item.id}
        className="rounded-2xl p-4 text-white shadow-lg relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

        <div className="flex justify-between items-center relative z-10">
          <div className="flex-1 pr-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-0.5">{item.title}</h2>
            <p className="text-sm font-medium text-white/90">Nog <span className="font-bold text-xl text-white">{daysLeft}</span> nachten!</p>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg border border-white/10 flex flex-col items-center min-w-[3.5rem]">
              <span className="text-xl font-bold leading-none">{targetDay}</span>
              <span className="text-[9px] uppercase font-bold mt-0.5">{targetMonth}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen pb-nav-safe relative bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      {/* Header */}
      <header className="px-6 py-6 flex justify-between items-center bg-gray-50 dark:bg-[#0f172a] shadow-sm transition-colors">
        <div className="flex flex-col justify-center">
          <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">KSA Aalter</span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Welkom, {displayName}</h1>
        </div>
        <div
          onClick={() => navigate('/settings')}
          className="h-16 w-16 rounded-full border-2 border-white dark:border-gray-700 shadow-md overflow-hidden cursor-pointer active:scale-95 transition-transform"
        >
          <img
            src={currentUser?.avatar}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">

        {/* --- DYNAMIC DASHBOARD WIDGETS --- */}

        {loading ? (
          <div className="space-y-6">
            <SkeletonCard lines={2} />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonWidget />
              <SkeletonWidget />
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white px-1">Mijn Agenda</h2>
              <SkeletonEvent />
              <SkeletonEvent />
            </div>
          </div>
        ) : (
          <>
            {/* 1. Quote of the Week (Splash) */}
        {topQuote && (
          <section
            onClick={() => navigate('/quotes')}
            className="bg-white dark:bg-[#1e2330] rounded-2xl p-0.5 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer group hover:scale-[1.01] transition-transform"
          >
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-[14px] p-5 relative overflow-hidden">
              {/* Decorative Quote Icon */}
              <div className="absolute top-2 right-4 text-8xl font-serif text-yellow-500/10 dark:text-yellow-500/5 select-none leading-none">”</div>

              <div className="flex items-center gap-2 mb-3">
                <span className="material-icons-round text-yellow-500 text-sm">emoji_events</span>
                <h2 className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Quote van de week</h2>
              </div>

              <p className="text-gray-900 dark:text-white font-serif italic text-lg leading-relaxed mb-3 pr-4">
                "{topQuote.text}"
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                    {topQuote.authorName.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{topQuote.authorName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-pink-500">
                    <span className="material-icons-round text-sm">thumb_up</span>
                    <span className="text-xs font-bold">{topQuote.likes.length}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <span className="material-icons-round text-sm">thumb_down</span>
                    <span className="text-xs font-bold">{topQuote.dislikes.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. Countdown Widgets (Conditional) - Now BELOW Quote */}
        {validCountdowns.length > 0 && (
          <section className={`mb-6 ${validCountdowns.length > 1 ? "grid grid-cols-2 gap-3" : ""}`}>
            {validCountdowns.map((item, index) => renderCountdown(item, index))}
          </section>
        )}

        {/* PRIMARY USER ACTIONS */}
        <div className="grid grid-cols-2 gap-4">

          {/* Strepen Module */}
          <div
            onClick={() => navigate('/strepen')}
            className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-primary dark:text-blue-300">
                  <span className="material-icons-round">local_bar</span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Strepen</h3>
              </div>
              {handleQuickStreep && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickStreep();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full shadow-md active:scale-90 active:bg-blue-800 transition-all flex items-center gap-1.5 border border-blue-500/20"
                  title={`Quick ${quickDrink?.name || 'Drink'}`}
                >
                  <span className="material-icons-round text-sm">local_bar</span>
                  <span className="text-xs font-bold">+1</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div
                onClick={(e) => { e.stopPropagation(); navigate('/strepen'); }}
                className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-300">Strepen zetten</span>
                <span className="material-icons-round text-xs text-gray-400">arrow_forward_ios</span>
              </div>
            </div>
          </div>

          {/* Frieten Module */}
          <div
            onClick={() => navigate('/frituur')}
            className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600 dark:text-yellow-400">
                <span className="material-icons-round">fastfood</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Frieten</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:bg-yellow-50 dark:group-hover:bg-gray-700 transition-colors">
                <span className="text-gray-700 dark:text-gray-300">Bestelling plaatsen</span>
                <span className="material-icons-round text-xs text-gray-400">arrow_forward_ios</span>
              </div>
            </div>
          </div>
        </div>

        {/* BIERPONG */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="material-icons-round text-primary">sports_bar</span>
              Bierpong
            </h2>
          </div>
          <div
            onClick={() => navigate('/bierpong')}
            className="bg-white dark:bg-[#1e2330] rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors">
              <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl h-14 w-14 flex flex-col items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700">
                <span className="text-2xl">🏓</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Leaderboard</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bekijk de stand</p>
              </div>
              <span className="material-icons-round text-gray-300">chevron_right</span>
            </div>
          </div>
        </section>

        {/* AGENDA (User View) */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="material-icons-round text-primary">event</span>
              Mijn Agenda
            </h2>
            <button
              onClick={() => navigate('/agenda')}
              className="text-xs font-bold text-primary hover:text-blue-600"
            >
              Alles bekijken
            </button>
          </div>

          <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-800 space-y-1">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => {
                const evtDate = new Date(event.date);
                const day = evtDate.getDate();
                const month = evtDate.toLocaleString('nl-BE', { month: 'short' }).replace('.', '');

                return (
                  <div key={event.id}>
                    <div
                      onClick={() => navigate('/agenda')}
                      className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl h-14 w-14 flex flex-col items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700">
                        <span className="text-lg font-bold leading-none">{day}</span>
                        <span className="text-[10px] font-bold uppercase leading-none text-gray-500">{month}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">{event.title}</h3>
                        <div className="flex items-center gap-3 text-gray-500 text-xs mt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="material-icons-round text-[10px]">schedule</span> {event.startTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-icons-round text-[10px]">place</span> {event.location}
                          </span>
                        </div>
                      </div>
                      <span className="material-icons-round text-gray-300">chevron_right</span>
                    </div>
                    {index === 0 && upcomingEvents.length > 1 && (
                      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-3"></div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                Geen komende evenementen.
              </div>
            )}
          </div>
        </section>

        {/* --- ADMIN SECTIONS BELOW (Geoptimaliseerd met NavCard) --- */}

        {(hasRole(currentUser, 'financiën') || hasRole(currentUser, 'admin')) && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-icons-round text-primary text-sm">account_balance</span>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiën</h2>
            </div>
            <div className="grid gap-3">
              <NavCard 
                title="Financieel Dashboard" 
                description="Onkostennota's & overzichten" 
                icon="account_balance_wallet" 
                iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                onClick={() => navigate('/financien')} 
              />
            </div>
          </section>
        )}

        {hasRole(currentUser, 'admin') && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-icons-round text-primary text-sm">admin_panel_settings</span>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hoofdleiding</h2>
            </div>
            <div className="grid gap-3">
              <NavCard 
                title="Rollen & Beheer" 
                description="Rechten aanpassen" 
                icon="manage_accounts" 
                iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                onClick={() => navigate('/admin/rollen')} 
              />
              <NavCard 
                title="Bericht Versturen" 
                description="Naar leiding of groepen" 
                icon="send" 
                iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                onClick={() => navigate('/notificaties/nieuw')} 
              />
            </div>
          </section>
        )}

        {hasRole(currentUser, 'drank') && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-icons-round text-primary text-sm">local_drink</span>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team Drank</h2>
            </div>
            <div className="grid gap-3">
              <NavCard 
                title="Team Drank Beheer" 
                description="Dashboard, Strepen & Facturen" 
                icon="local_bar" 
                iconColorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                onClick={() => navigate('/strepen/dashboard')} 
              />
            </div>
          </section>
        )}

        {hasRole(currentUser, 'sfeerbeheer') && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-icons-round text-primary text-sm">celebration</span>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sfeerbeheer</h2>
            </div>
            <div className="grid gap-3">
              <NavCard 
                title="Agenda & Aftelklok" 
                description="Events en sfeer beheren" 
                icon="edit_calendar" 
                iconColorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" 
                onClick={() => navigate('/agenda/beheer')} 
              />
              <NavCard 
                title="Bierpong" 
                description="Bierpongtoernooi kampioenen" 
                icon="emoji_events" 
                iconColorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" 
                onClick={() => navigate('/bierpong/beheer')} 
              />
              <NavCard 
                title="Quoteboek" 
                description="Wall of Shame / Fame" 
                icon="format_quote" 
                iconColorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" 
                onClick={() => navigate('/quotes/beheer')} 
              />
            </div>
          </section>
        )}

        {hasRole(currentUser, 'winkeltje') && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="material-icons-round text-primary text-sm">storefront</span>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Winkeltje</h2>
            </div>
            <div className="grid gap-3">
              <NavCard 
                title="Winkeltje Dashboard" 
                description="Beheer kledij en materiaal" 
                icon="dashboard" 
                iconColorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" 
                onClick={() => navigate('/winkeltje/dashboard')} 
              />
            </div>
          </section>
        )}
          </>
        )}
      </main>
    </div>
  );
};
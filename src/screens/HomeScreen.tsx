import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useAgenda } from '../contexts/AgendaContext';
import { Event, QuoteItem, CountdownItem, User, Drink, Todo } from '../types';
import { hasAccess } from '../App';
import { SPECIAL_DRINKS } from '../lib/constants';
import * as db from '../lib/supabaseService';

import { SkeletonWidget, SkeletonCard, SkeletonEvent } from '../components/Skeleton';
import { NavCard } from '../components/NavCard';
import { showToast } from '../components/Toast';

export const HomeScreen: React.FC = () => {
  const { currentUser, users, loading: authLoading } = useAuth();
  const { balances, handleAddCost, dranken: drinks, loading: drinkLoading } = useDrink();
  const { events, quotes, countdowns } = useAgenda();
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [duoBierpongWinners, setDuoBierpongWinners] = useState<string[]>([]);
  
  const loading = authLoading || drinkLoading;
  const navigate = useNavigate();

  const displayName = currentUser?.nickname || currentUser?.name?.split(' ')[0] || 'Lid';

  // Laden van to-do's voor godmode
  useEffect(() => {
    if (currentUser?.rol === 'godmode') {
      db.fetchPersonalTodos().then(setTodos).catch(console.error);
    }
    db.fetchBierpongKampioenen().then(setDuoBierpongWinners).catch(console.error);
  }, [currentUser]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || !currentUser) return;
    try {
      const added = await db.addPersonalTodo(newTodo, currentUser.id);
      setTodos([added, ...todos]);
      setNewTodo('');
    } catch (e) {
      showToast('Fout bij toevoegen taak', 'error');
    }
  };

  const handleToggleTodo = async (id: string, completed: boolean) => {
    try {
      await db.togglePersonalTodo(id, completed);
      setTodos(todos.map(t => t.id === id ? { ...t, completed } : t));
    } catch (e) {
      showToast('Fout bij bijwerken taak', 'error');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await db.deletePersonalTodo(id);
      setTodos(todos.filter(t => t.id !== id));
    } catch (e) {
      showToast('Fout bij verwijderen taak', 'error');
    }
  };

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

  const topQuote = useMemo(() => {
    const today = new Date();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(today.getDate() - 28);
    const recentQuotes = quotes.filter(q => new Date(q.date) >= fourWeeksAgo);
    if (recentQuotes.length === 0) return null;
    return [...recentQuotes].sort((a, b) => (b.likes.length - b.dislikes.length) - (a.likes.length - a.dislikes.length))[0];
  }, [quotes]);

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

  const renderCountdown = (item: CountdownItem, index: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(item.targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return null;

    if (daysLeft === 0) {
      return (
        <div key={item.id} className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 text-white shadow-lg animate-pulse">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl font-extrabold text-center leading-tight">{item.title} is vandaag!</h2>
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex justify-between items-center">
          <div className="flex-1 pr-2">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-0.5">{item.title}</h2>
            <p className="text-sm font-medium">Nog <span className="font-bold text-xl">{daysLeft}</span> nachten!</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      <header className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6 flex justify-between items-center bg-gray-50 dark:bg-[#0f172a] shadow-sm transition-colors sticky top-0 z-20">
        <div className="flex flex-col justify-center">
          <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">KSA Aalter</span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Welkom, {displayName}</h1>
        </div>
        <div onClick={() => navigate('/settings')} className="h-16 w-16 rounded-full border-2 border-white dark:border-gray-700 shadow-md overflow-hidden cursor-pointer active:scale-95 transition-transform shrink-0">
          <img src={currentUser?.avatar} alt="Profile" className="h-full w-full object-cover" />
        </div>
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
            {/* 📅 AANKOMENDE EVENEMENTEN WIDGET */}
            {upcomingEvents.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="material-icons-round text-blue-600 text-sm">calendar_today</span>
                    <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aankomende Events</h2>
                  </div>
                  <button onClick={() => navigate('/agenda')} className="text-xs font-bold text-blue-600 dark:text-blue-400">Bekijk alles</button>
                </div>
                <div className="grid gap-3">
                  {upcomingEvents.map(event => (
                    <div key={event.id} onClick={() => navigate('/agenda')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 shrink-0">
                        <span className="text-[10px] font-black uppercase leading-none">{new Date(event.date).toLocaleDateString('nl-BE', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{new Date(event.date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate dark:text-white">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                          <span className="material-icons-round text-[14px]">schedule</span>
                          <span className="text-xs">{event.startTime || '20:00'} • {event.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 🏆 BIERPONG KAMPIOENEN WIDGET */}
            {duoBierpongWinners && duoBierpongWinners.length > 0 && (
              <section className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-icons-round text-yellow-400 text-sm">workspace_premium</span>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-100">Huidige Bierpong Kampioenen</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                      {duoBierpongWinners.map(id => {
                        const u = users.find(user => user.id === id);
                        return (
                          <img key={id} src={u?.avatar} className="w-10 h-10 rounded-full border-2 border-purple-500 bg-purple-800 object-cover" alt="Champ" />
                        );
                      })}
                    </div>
                    <div>
                      <p className="text-lg font-black leading-tight">
                        {duoBierpongWinners.map(id => users.find(u => u.id === id)?.naam?.split(' ')[0]).join(' & ')}
                      </p>
                      <p className="text-[10px] text-purple-200 font-bold uppercase">The Team to Beat 🍻</p>
                    </div>
                  </div>
                </div>
                <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl text-white/10 rotate-12">emoji_events</span>
              </section>
            )}

            {topQuote && (
              <section onClick={() => navigate('/quotes')} className="bg-white dark:bg-[#1e2330] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons-round text-yellow-500 text-sm">emoji_events</span>
                  <h2 className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Quote van de week</h2>
                </div>
                <p className="text-gray-900 dark:text-white font-serif italic text-lg">"{topQuote.text}"</p>
                <div className="flex items-center gap-2 mt-3 text-gray-500">
                  <div className="w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-[10px] font-bold text-yellow-700">{topQuote.authorName.charAt(0)}</div>
                  <span className="text-xs font-bold">{topQuote.authorName}</span>
                </div>
              </section>
            )}

            {validCountdowns.length > 0 && (
              <section className={`mb-6 ${validCountdowns.length > 1 ? "grid grid-cols-2 gap-3" : ""}`}>
                {validCountdowns.map((item, index) => renderCountdown(item, index))}
              </section>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => navigate('/strepen')} className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1e2330] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 shrink-0"><span className="material-icons-round">local_bar</span></div>
                  <h3 className="font-semibold text-lg dark:text-white">Strepen</h3>
                </div>
                {quickDrink && (
                  <button onClick={(e) => { e.stopPropagation(); if (currentUser) handleAddCost(currentUser.id, quickDrink.id, 1, currentUser.naam); }} className="w-full bg-blue-50 dark:bg-blue-900/20 py-3 px-4 rounded-xl flex items-center justify-between">
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

            {/* PERSOONLIJKE TO-DO (GODMODE ONLY) */}
            {currentUser?.rol === 'godmode' && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-icons-round text-primary text-sm">checklist</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Persoonlijke To-Do</h2>
                </div>
                <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                  <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
                    <input type="text" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="Nieuwe taak..." className="flex-1 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white" />
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded-xl"><span className="material-icons-round">add</span></button>
                  </form>
                  <div className="space-y-1">
                    {todos.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg group transition-colors">
                        <button onClick={() => handleToggleTodo(todo.id, !todo.completed)} className={`w-5 h-5 rounded border flex items-center justify-center ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {todo.completed && <span className="material-icons-round text-white text-[14px]">check</span>}
                        </button>
                        <span className={`flex-1 text-sm ${todo.completed ? 'text-gray-400 line-through' : 'dark:text-white'}`}>{todo.task}</span>
                        <button onClick={() => handleDeleteTodo(todo.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-icons-round text-sm">delete</span></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* --- ADMIN DASHBOARDS (HERSTELD) --- */}

            {hasAccess(currentUser, 'financiën') && (
              <section>
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
                  <NavCard title="Bierpong" description="Bierpongtoernooi kampioenen" icon="emoji_events" iconColorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" onClick={() => navigate('/bierpong/beheer')} />
                  <NavCard title="Quoteboek" description="Wall of Shame / Fame" icon="format_quote" iconColorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" onClick={() => navigate('/quotes/beheer')} />
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
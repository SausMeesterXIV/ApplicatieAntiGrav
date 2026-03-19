import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useAgenda } from '../contexts/AgendaContext';
import { Event, QuoteItem, CountdownItem, User, Drink, Todo } from '../types';
import { hasAccess } from '../App';
import { SPECIAL_DRINKS } from '../lib/constants';
import * as db from '../lib/supabaseService';

import { hasRole } from '../lib/roleUtils';
import { SkeletonWidget, SkeletonCard, SkeletonEvent } from '../components/Skeleton';
import { NavCard } from '../components/NavCard';
import { showToast } from '../components/Toast';

export const HomeScreen: React.FC = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { balances, handleAddCost, dranken: drinks, loading: drinkLoading } = useDrink();
  const { events, quotes, countdowns } = useAgenda();
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  
  const loading = authLoading || drinkLoading;
  const navigate = useNavigate();

  const displayName = currentUser?.nickname || currentUser?.name?.split(' ')[0] || 'Lid';

  // Alleen to-do's laden als gebruiker Godmode is
  useEffect(() => {
    if (currentUser?.rol === 'godmode') {
      db.fetchPersonalTodos().then(setTodos).catch(console.error);
    }
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
          <div className="space-y-6"><SkeletonCard lines={2} /><div className="grid grid-cols-2 gap-3"><SkeletonWidget /><SkeletonWidget /></div></div>
        ) : (
          <>
            {topQuote && (
              <section onClick={() => navigate('/quotes')} className="bg-white dark:bg-[#1e2330] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons-round text-yellow-500 text-sm">emoji_events</span>
                  <h2 className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Quote van de week</h2>
                </div>
                <p className="text-gray-900 dark:text-white font-serif italic text-lg">"{topQuote.text}"</p>
                <p className="text-xs font-bold text-gray-500 mt-2">— {topQuote.authorName}</p>
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

            {/* PERSOONLIJKE TO-DO (GODMODE ONLY) - GEPLAATST BOVEN FINANCIEN */}
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

            {hasAccess(currentUser, 'financiën') && (
              <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">account_balance</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiën</h2>
                </div>
                <NavCard title="Financieel Dashboard" description="Onkostennota's & overzichten" icon="account_balance_wallet" iconColorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" onClick={() => navigate('/financien')} />
              </section>
            )}

            {hasAccess(currentUser, 'admin') && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-icons-round text-primary text-sm">admin_panel_settings</span>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NavCard title="Bar Beheer" icon="liquor" iconColorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" onClick={() => navigate('/team-drank-dashboard')} />
                  <NavCard title="Frituur Admin" icon="restaurant" iconColorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" onClick={() => navigate('/admin-frituur')} />
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};
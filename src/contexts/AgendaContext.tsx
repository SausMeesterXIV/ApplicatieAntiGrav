import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Event, CountdownItem, Notification, BierpongGame, QuoteItem } from '../types';
import * as db from '../lib/supabaseService';
import { useAuth } from './AuthContext';
import { useRealtimeSubscriptions } from '../lib/useRealtime';
import { showToast } from '../components/Toast';

interface AgendaContextType {
  events: Event[];
  countdowns: CountdownItem[];
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  bierpongGames: BierpongGame[];
  setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
  duoBierpongWinners: string[];
  quotes: QuoteItem[];
  loading: boolean;
  refreshAgendaData: () => Promise<void>;
  handleSaveCountdowns: (newCountdowns: CountdownItem[]) => Promise<void>;
  handleAddBierpongGame: (playerIds: string[], winnerIds: string[]) => Promise<void>;
  handleVoteQuote: (id: string, type: 'like' | 'dislike') => Promise<void>;
  handleAddQuote: (text: string, context: string, authorId: string) => Promise<void>;
  handleDeleteQuote: (id: string) => Promise<void>;
  handleSaveEvent: (event: Event) => Promise<void>;
  handleDeleteEvent: (id: string) => Promise<void>;
  handleAddNotification: (notification: Omit<Notification, 'id'>) => Promise<void>;
  handleMarkNotificationAsRead: (id: number) => Promise<void>;
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const { session, currentUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bierpongGames, setBierpongGames] = useState<BierpongGame[]>([]);
  const [duoBierpongWinners, setDuoBierpongWinners] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useRealtimeSubscriptions({
    userId: session?.user?.id || null,
    setNotifications,
    setBierpongGames,
  });

  useEffect(() => {
    if (session?.user?.id) {
      loadAgendaData(session.user.id);
    }
  }, [session?.user?.id]);

  const loadAgendaData = async (userId: string) => {
    setLoading(true);
    try {
      const [eventsData, countdownsData, notificationsData, bierpongData, winnersData, quotesData] = await Promise.all([
        db.fetchEvents(),
        db.fetchCountdowns(),
        db.fetchNotificaties(userId),
        db.fetchBierpongGames(),
        db.fetchBierpongKampioenen(),
        db.fetchQuotes()
      ]);

      setEvents(eventsData);
      setCountdowns(countdownsData);
      setNotifications(notificationsData);
      setBierpongGames(bierpongData);
      setDuoBierpongWinners(winnersData);
      setQuotes(quotesData);
    } catch (e) {
      console.error("Error loading agenda data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (event: Event) => {
    setEvents(prev => {
        const exists = prev.find(e => e.id === event.id);
        return exists ? prev.map(e => e.id === event.id ? event : e) : [...prev, event];
    });
    try {
        const savedEvent = await db.saveEvent(event);
        setEvents(prev => prev.map(e => (e.id === event.id || e.id === savedEvent.id) ? savedEvent : e));
        showToast('Evenement opgeslagen!', 'success');
    } catch (error) {
        showToast('Fout bij het opslaan van het evenement', 'error');
        const freshEvents = await db.fetchEvents();
        setEvents(freshEvents);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const event = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    try {
        await db.deleteEvent(id);
        showToast('Evenement verwijderd', 'info');
    } catch (error) {
        if (event) setEvents(prev => [...prev, event]);
        showToast('Fout bij het verwijderen', 'error');
    }
  };

  const handleAddNotification = async (n: Omit<Notification, 'id'>) => {
    if (!currentUser) return;
    const tempNotif = { ...n, id: Date.now() };
    setNotifications(prev => [tempNotif, ...prev]);
    try {
        await db.addNotificatie(currentUser.id, 'all', n.title, n.content, currentUser.naam || currentUser.name || 'Systeem');
    } catch (error) {}
  };

  const handleMarkNotificationAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    const notif = notifications.find(n => n.id === id);
    const supabaseId = (notif as any)?._supabaseId;
    if (supabaseId) {
        try {
            await db.markNotificatieGelezen(supabaseId);
        } catch (error) {}
    }
  };

  const handleSaveCountdowns = async (newCountdowns: CountdownItem[]) => {
    setCountdowns(newCountdowns);
    try {
      await db.saveCountdowns(newCountdowns);
    } catch (error) {
      console.error('Save countdowns error', error);
      const fresh = await db.fetchCountdowns();
      setCountdowns(fresh);
    }
  };

  const handleAddBierpongGame = async (playerIds: string[], winnerIds: string[]) => {
    try {
      const newGame = await db.addBierpongGame(playerIds, winnerIds);
      setBierpongGames(prev => [...prev, newGame]);
    } catch (error) {
      showToast('Fout bij opslaan bierpong match', 'error');
      const fresh = await db.fetchBierpongGames();
      setBierpongGames(fresh);
    }
  };

  const handleVoteQuote = async (id: string, type: 'like' | 'dislike') => {
    if (!currentUser?.id) return;
    const currentUserId = currentUser.id;
    const currentUserNaam = currentUser.naam || currentUser.name || 'Onbekend';

    setQuotes(prev => prev.map(q => {
      if (q.id === id) {
        let newLikes = [...q.likes]; let newDislikes = [...q.dislikes];
        if (type === 'like') {
          if (newLikes.includes(currentUserId)) newLikes = newLikes.filter(u => u !== currentUserId);
          else { newLikes.push(currentUserId); newDislikes = newDislikes.filter(u => u !== currentUserId); }
        } else {
          if (newDislikes.includes(currentUserId)) newDislikes = newDislikes.filter(u => u !== currentUserId);
          else { newDislikes.push(currentUserId); newLikes = newLikes.filter(u => u !== currentUserId); }
        }
        return { ...q, likes: newLikes, dislikes: newDislikes };
      }
      return q;
    }));

    try {
      await db.voteQuote(id, currentUserId, type, currentUserNaam);
    } catch (error) {
      showToast('Fout bij het stemmen', 'error');
      const freshQuotes = await db.fetchQuotes();
      setQuotes(freshQuotes);
    }
  };

  const handleAddQuote = async (text: string, context: string, authorId: string) => {
    if (!currentUser?.id) return;
    const tempId = Date.now().toString();
    const newQuote: QuoteItem = {
      id: tempId, text, authorId, authorName: authorId, 
      context, date: new Date(), likes: [], dislikes: [], addedBy: currentUser.id,
    };
    setQuotes(prev => [newQuote, ...prev]);

    try {
      await db.addQuote(text, authorId, context, currentUser.id);
      showToast('Quote toegevoegd!', 'success');
      const freshQuotes = await db.fetchQuotes();
      setQuotes(freshQuotes);
    } catch (error) {
      setQuotes(prev => prev.filter(q => q.id !== tempId));
      showToast('Fout bij toevoegen quote', 'error');
    }
  };

  const handleDeleteQuote = async (id: string) => {
    const quote = quotes.find(q => q.id === id);
    setQuotes(prev => prev.filter(q => q.id !== id));
    try {
      await db.deleteQuote(id);
      showToast('Quote verwijderd', 'info');
    } catch (error) {
      if (quote) setQuotes(prev => [quote, ...prev]);
      showToast('Fout bij verwijderen quote', 'error');
    }
  };

  const refreshAgendaData = async () => {
    if (session?.user?.id) {
        await loadAgendaData(session.user.id);
    }
  };

  return (
    <AgendaContext.Provider value={{
      events, countdowns, notifications, setNotifications,
      bierpongGames, setBierpongGames, duoBierpongWinners, quotes, loading,
      refreshAgendaData, handleSaveCountdowns, handleAddBierpongGame,
      handleVoteQuote, handleAddQuote, handleDeleteQuote,
      handleSaveEvent, handleDeleteEvent, handleAddNotification, handleMarkNotificationAsRead
    }}>
      {children}
    </AgendaContext.Provider>
  );
}

export function useAgenda() {
  const context = useContext(AgendaContext);
  if (context === undefined) {
    throw new Error('useAgenda must be used within an AgendaProvider');
  }
  return context;
}

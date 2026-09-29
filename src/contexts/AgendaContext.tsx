import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Event, CountdownItem, Notification } from '../types';
import * as db from '../lib/supabaseService';
import { useAuth } from './AuthContext';
import { useRealtimeSubscriptions } from '../lib/useRealtime';
import { showToast } from '../components/Toast';

interface AgendaContextType {
  events: Event[];
  countdowns: CountdownItem[];
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  handleMarkNotificationAsRead: (id: string) => Promise<void>;
  loading: boolean;
  refreshAgendaData: () => Promise<void>;
  handleSaveCountdowns: (newCountdowns: CountdownItem[]) => Promise<void>;
  handleSaveEvent: (event: Event) => Promise<void>;
  handleDeleteEvent: (id: string) => Promise<void>;
  handleAddNotification: (notification: Omit<Notification, 'id'>) => Promise<void>;
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const { session, currentUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useRealtimeSubscriptions({
    userId: session?.user?.id || null,
    setNotifications,
  });

  useEffect(() => {
    if (session?.user?.id) {
      loadAgendaData(session.user.id);
    }
  }, [session?.user?.id]);

  const loadAgendaData = async (userId: string) => {
    setLoading(true);
    try {
      const [eventsData, countdownsData, notificationsData] = await Promise.all([
        db.fetchEvents(),
        db.fetchCountdowns(),
        db.fetchNotificaties(userId)
      ]);

      setEvents(eventsData);
      setCountdowns(countdownsData);
      setNotifications(notificationsData);
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
        throw error; // Re-throw to allow UI to catch specific message
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
    const tempNotif = { ...n, id: Date.now().toString() } as any;
    setNotifications(prev => [tempNotif, ...prev]);
    try {
        await db.addNotificatie(currentUser.id, 'all', (n as any).title || (n as any).titel, (n as any).content || (n as any).bericht, currentUser.naam || currentUser.name || 'Systeem');
    } catch (error) {}
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    // 1. Update direct de lijst in de app (voor het rode bolletje)
    setNotifications(prev => prev.map(n => String(n.id) === id ? { ...n, isRead: true } : n));

    // 2. Sla de ID op in localStorage zodat het bij een refresh/navigatie onthouden blijft
    const seenIds = JSON.parse(localStorage.getItem('antigrav_seen_notifs') || '[]');
    if (!seenIds.includes(String(id))) {
        seenIds.push(String(id));
        localStorage.setItem('antigrav_seen_notifs', JSON.stringify(seenIds));
    }

    try {
        const notif = notifications.find(n => String(n.id) === id);
        // Alleen naar de database schrijven als het een persoonlijke melding is (ontvanger_id !== 'all')
        if (notif && (notif as any).ontvanger_id !== 'all') {
            await db.markNotificatieGelezen(id);
        }
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
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

  const refreshAgendaData = async () => {
    if (session?.user?.id) {
        await loadAgendaData(session.user.id);
    }
  };

  return (
    <AgendaContext.Provider value={{
      events, countdowns, notifications, setNotifications,
      loading,
      refreshAgendaData, handleSaveCountdowns,
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

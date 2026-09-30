import React, { createContext, useContext, useState, useEffect } from 'react';

import * as db from '../../lib/supabaseService';
import { useAuth } from '../auth/AuthContext';
import { useNotificationsRealtime } from '../../lib/useRealtime';
import { showToast } from '../../components/Toast';

const AgendaContext = createContext(undefined);

export function AgendaProvider({ children }) {
  const { session, currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [countdowns, setCountdowns] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useNotificationsRealtime(session?.user?.id || null, setNotifications);

  useEffect(() => {
    if (session?.user?.id) {
      loadAgendaData(session.user.id);
    }
  }, [session?.user?.id]);

  const loadAgendaData = async userId => {
    setLoading(true);
    try {
      const [eventsData, countdownsData, notificationsData] = await Promise.all([
        db.fetchEvents(),
        db.fetchCountdowns(),
        db.fetchNotificaties(userId),
      ]);

      setEvents(eventsData);
      setCountdowns(countdownsData);
      setNotifications(notificationsData);
    } catch (e) {
      console.error('Error loading agenda data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async event => {
    setEvents(prev => {
      const exists = prev.find(e => e.id === event.id);
      return exists ? prev.map(e => (e.id === event.id ? event : e)) : [...prev, event];
    });
    try {
      const savedEvent = await db.saveEvent(event);
      setEvents(prev => prev.map(e => (e.id === event.id || e.id === savedEvent.id ? savedEvent : e)));
      showToast('Evenement opgeslagen!', 'success');
    } catch (error) {
      showToast('Fout bij het opslaan van het evenement', 'error');
      const freshEvents = await db.fetchEvents();
      setEvents(freshEvents);
      throw error; // Re-throw to allow UI to catch specific message
    }
  };

  const handleDeleteEvent = async id => {
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

  const handleAddNotification = async n => {
    if (!currentUser) return;
    const tempNotif = { ...n, id: Date.now().toString() };
    setNotifications(prev => [tempNotif, ...prev]);
    try {
      await db.addNotificatie(
        currentUser.id,
        'all',
        n.title || n.titel,
        n.content || n.bericht,
        currentUser.naam || currentUser.name || 'Systeem'
      );
    } catch (error) {}
  };

  const handleMarkNotificationAsRead = async id => {
    // 1. Update direct de lijst in de app (voor het rode bolletje)
    setNotifications(prev => prev.map(n => (String(n.id) === id ? { ...n, isRead: true } : n)));

    // 2. Sla de ID op in localStorage zodat het bij een refresh/navigatie onthouden blijft
    const seenIds = JSON.parse(localStorage.getItem('antigrav_seen_notifs') || '[]');
    if (!seenIds.includes(String(id))) {
      seenIds.push(String(id));
      localStorage.setItem('antigrav_seen_notifs', JSON.stringify(seenIds));
    }

    try {
      const notif = notifications.find(n => String(n.id) === id);
      // Alleen naar de database schrijven als het een persoonlijke melding is (ontvanger_id !== 'all')
      if (notif && notif.ontvanger_id !== 'all') {
        await db.markNotificatieGelezen(id);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleSaveCountdowns = async newCountdowns => {
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
    <AgendaContext.Provider
      value={{
        events,
        countdowns,
        notifications,
        setNotifications,
        loading,
        refreshAgendaData,
        handleSaveCountdowns,
        handleSaveEvent,
        handleDeleteEvent,
        handleAddNotification,
        handleMarkNotificationAsRead,
      }}
    >
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

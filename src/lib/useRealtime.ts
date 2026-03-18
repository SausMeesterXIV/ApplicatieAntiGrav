import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Notification, BierpongGame } from '../types';
import { showToast } from '../components/Toast';
import { formatTimeAgo } from './utils';

interface UseRealtimeOptions {
  userId: string | null;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
}

export function useRealtimeSubscriptions({ userId, setNotifications, setBierpongGames }: UseRealtimeOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaties' },
        (payload) => {
          const n = payload.new as any;
          if (n.ontvanger_id !== userId && n.ontvanger_id !== 'all') return;
          if (n.zender_id === userId) return;

          const mapped: Notification = {
            ...n,
            id: n.id,
            type: 'official',
            sender: n.zender_naam || 'Systeem',
            role: 'Lid',
            title: n.titel,
            content: n.bericht || '',
            time: formatTimeAgo(new Date(n.datum)),
            isRead: n.gelezen,
            action: n.action,
            icon: 'notifications',
            color: 'bg-blue-100 text-blue-600',
          } as Notification;

          setNotifications(prev => {
            if (prev.some(existing => existing.id === n.id)) return prev;
            return [mapped, ...prev];
          });

          showToast(`📬 ${n.titel}`, 'info');
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificaties' },
        (payload) => {
          const n = payload.new as any;
          setNotifications(prev =>
            prev.map(notif => notif.id === n.id ? { ...notif, isRead: n.gelezen } : notif)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bierpong_games' },
        (payload) => {
          const g = payload.new as any;
          const mapped: BierpongGame = {
            ...g,
            playerIds: g.player_ids || [],
            winnerIds: g.winner_ids || [],
            timestamp: new Date(g.created_at),
          } as BierpongGame;

          setBierpongGames(prev => {
            if (prev.some(existing => existing.id === g.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]); // Alleen userId als dependency voor maximale stabiliteit
}

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Notification, BierpongGame } from '../types';
import { showToast } from '../components/Toast';

/** Generate a stable numeric ID from a UUID string (for React keys) */
function stableNumericId(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Zonet';
  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  return date.toLocaleDateString('nl-BE');
}

interface UseRealtimeOptions {
  userId: string | null;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
}

/**
 * Subscribes to Supabase Realtime channels for:
 * - notificaties (INSERT for new notifications)
 * - bierpong_games (INSERT for new games)
 * 
 * Automatically cleans up subscriptions on unmount.
 */
export function useRealtimeSubscriptions({ userId, setNotifications, setBierpongGames }: UseRealtimeOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Create a single channel with multiple listeners
    const channel = supabase
      .channel('realtime-updates')
      // ─── Notifications: listen for new rows targeting this user or 'all' ───
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaties',
        },
        (payload) => {
          const n = payload.new as any;
          // Only add if this notification is for the current user or broadcast to 'all'
          if (n.ontvanger_id !== userId && n.ontvanger_id !== 'all') return;
          // Skip if current user sent it (they already have optimistic update)
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
            // Avoid duplicates
            if (prev.some(existing => existing.id === n.id)) return prev;
            return [mapped, ...prev];
          });

          showToast(`📬 ${n.titel}`, 'info');
        }
      )
      // ─── Notifications: listen for updates (e.g. marked as read from another device) ───
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificaties',
        },
        (payload) => {
          const n = payload.new as any;
          if (n.ontvanger_id !== userId && n.ontvanger_id !== 'all') return;

          setNotifications(prev =>
            prev.map(notif => {
              if (notif.id === n.id) {
                return { ...notif, isRead: n.gelezen };
              }
              return notif;
            })
          );
        }
      )
      // ─── Bierpong: listen for new games ───
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bierpong_games',
        },
        (payload) => {
          const g = payload.new as any;

          const mapped: BierpongGame = {
            ...g,
            id: g.id,
            playerIds: g.player_ids || [],
            winnerIds: g.winner_ids || [],
            timestamp: new Date(g.created_at),
          } as BierpongGame;

          setBierpongGames(prev => {
            // Avoid duplicates (in case the current user just added this game)
            if (prev.some(existing => existing.id === g.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected to realtime-updates channel');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, setNotifications, setBierpongGames]);
}

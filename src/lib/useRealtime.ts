import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Notification, BierpongGame, Order } from '../types';
import { showToast } from '../components/Toast';
import { formatTimeAgo } from './utils';

interface UseRealtimeOptions {
  userId: string | null;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
  setFriesOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  frituurSessieId?: string | null;
}

export function useRealtimeSubscriptions({ 
  userId, 
  setNotifications, 
  setBierpongGames,
  setFriesOrders,
  frituurSessieId
}: UseRealtimeOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-updates')
      // A. LIVE NOTIFICATIES (Bijv: "Iemand heeft voor jou besteld")
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaties' },
        (payload) => {
          const n = payload.new as any;
          if (n.ontvanger_id !== userId && n.ontvanger_id !== 'all') return;
          if (n.zender_id === userId) return;

          const mapped: Notification = {
            ...n,
            senderId: n.zender_id,
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

          setNotifications(prev => [mapped, ...prev]);
          showToast(`📬 ${n.titel}`, 'info');
        }
      )
      // B. LIVE BIERPONG UPDATES
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
          setBierpongGames(prev => [...prev, mapped]);
        }
      )
      // C. LIVE FRIET BESTELLINGEN
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'frituur_bestellingen' },
        (payload) => {
          if (!setFriesOrders) return;

          if (payload.eventType === 'INSERT') {
            const n = payload.new as any;
            // Filter op de huidige sessie
            if (frituurSessieId && n.sessie_id !== frituurSessieId) return;

            const mapped: Order = {
              id: n.id,
              userId: n.user_id,
              userName: n.user_name || 'Onbekend',
              items: n.items || [],
              totalPrice: n.totaal_prijs || 0,
              date: new Date(n.created_at),
              status: n.status as 'open' | 'besteld' | 'geleverd',
              periodId: n.period_id
            };

            setFriesOrders(prev => [mapped, ...prev]);
            
            // Toon melding bij een nieuwe bestelling (handig voor de frituur-verantwoordelijke!)
            if (n.user_id !== userId) {
                showToast(`🍟 Nieuwe bestelling van ${n.user_name}!`, 'success');
            }
          } else if (payload.eventType === 'UPDATE') {
            const n = payload.new as any;
            setFriesOrders(prev => prev.map(o => o.id === n.id ? {
              ...o,
              status: n.status as any,
              totalPrice: n.totaal_prijs || 0,
              items: n.items || o.items
            } : o));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            setFriesOrders(prev => prev.filter(o => o.id !== old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, frituurSessieId]); // Nu luistert de effect ook naar sessie-wissels!
}

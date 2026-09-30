import { useEffect } from 'react';
import { supabase } from './supabase';

import { showToast } from '../components/Toast';
import { formatTimeAgo } from './utils';

// Elk hook heeft een eigen kanaalnaam, zodat twee providers elkaars kanaal niet overschrijven.

/** Live notificaties (bv. "Iemand heeft voor jou besteld"). Gebruikt door AgendaProvider. */
export function useNotificationsRealtime(userId, setNotifications) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-notificaties')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaties' }, payload => {
        const n = payload.new;
        if (n.ontvanger_id !== userId && n.ontvanger_id !== 'all') return;
        if (n.zender_id === userId) return;

        const mapped = {
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
        };

        setNotifications(prev => (prev.some(p => String(p.id) === String(mapped.id)) ? prev : [mapped, ...prev]));
        showToast(`📬 ${n.titel}`, 'info');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** Live friet-bestellingen van de actieve sessie. Gebruikt door FriesProvider. */
export function useFriesRealtime(userId, frituurSessieId, setFriesOrders) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-frituur')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'frituur_bestellingen' }, payload => {
        if (payload.eventType === 'INSERT') {
          const n = payload.new;
          // Filter op de huidige sessie
          if (frituurSessieId && n.sessie_id !== frituurSessieId) return;

          const mapped = {
            id: n.id,
            userId: n.user_id,
            userName: n.user_name || 'Onbekend',
            items: n.items || [],
            totalPrice: n.totaal_prijs || 0,
            date: new Date(n.created_at),
            status: n.status,
            periodId: n.period_id,
          };

          // Eigen bestellingen staan er al (optimistisch toegevoegd); niet dubbel toevoegen
          setFriesOrders(prev => (prev.some(o => o.id === mapped.id) ? prev : [mapped, ...prev]));

          // Toon melding bij een nieuwe bestelling (handig voor de frituur-verantwoordelijke!)
          if (n.user_id !== userId) {
            showToast(`🍟 Nieuwe bestelling van ${n.user_name}!`, 'success');
          }
        } else if (payload.eventType === 'UPDATE') {
          const n = payload.new;
          setFriesOrders(prev =>
            prev.map(o =>
              o.id === n.id
                ? {
                    ...o,
                    status: n.status,
                    totalPrice: n.totaal_prijs || 0,
                    items: n.items || o.items,
                  }
                : o
            )
          );
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old;
          setFriesOrders(prev => prev.filter(o => o.id !== old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, frituurSessieId]);
}

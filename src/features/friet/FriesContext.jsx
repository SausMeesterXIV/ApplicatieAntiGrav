import React, { createContext, useContext, useEffect, useState } from 'react';

import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { useFriesRealtime } from '../../lib/useRealtime';
import { hasRecht } from '../../lib/roleUtils';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from '../drank/DrinkContext';

const FriesContext = createContext(undefined);

export const FriesProvider = ({ children }) => {
  const { session, currentUser, users } = useAuth();
  const { activePeriod, setBalance } = useDrink();

  const [fryItems, setFryItems] = useState([]);
  const [friesOrders, setFriesOrders] = useState([]);
  const [friesSessionStatus, setFriesSessionStatusState] = useState('closed');
  const [friesPickupTime, setFriesPickupTimeState] = useState(null);
  const [frituurSessieId, setFrituurSessieId] = useState(null);
  const [sessieGestart, setSessieGestart] = useState(null); // wanneer de lopende ronde geopend werd
  const [loading, setLoading] = useState(true);

  useFriesRealtime(session?.user?.id || null, frituurSessieId, setFriesOrders);

  useEffect(() => {
    if (session?.user?.id) loadFriesData();
  }, [session?.user?.id]);

  const loadFriesData = async () => {
    setLoading(true);
    try {
      const [sessieData, ordersData, itemsData] = await Promise.all([
        db.fetchActiveFrituurSessie(),
        db.fetchFrituurBestellingen(),
        db.fetchFryItems(),
      ]);
      if (sessieData) {
        setFrituurSessieId(sessieData.id);
        setFriesSessionStatusState(sessieData.status);
        setFriesPickupTimeState(sessieData.pickupTime);
        setSessieGestart(sessieData.gestart);
      }
      setFriesOrders(ordersData || []);
      setFryItems(itemsData || []);
    } catch (e) {
      console.error('Error loading fries data', e);
    } finally {
      setLoading(false);
    }
  };

  // Update lokaal én direct in de database
  const setFriesSessionStatus = async status => {
    setFriesSessionStatusState(status);
    try {
      if (status === 'open' && !frituurSessieId) {
        const newId = await db.createFrituurSessie(currentUser?.id || 'system');
        setFrituurSessieId(newId);
        setSessieGestart(new Date());
      } else if (frituurSessieId) {
        await db.updateFrituurSessie(frituurSessieId, { status });
      }
    } catch (e) {
      console.error('Failed to update session status', e);
      showToast('Fout bij opslaan status in database', 'error');
    }
  };

  // Update afhaaltijd lokaal én direct in de database
  const setFriesPickupTime = async time => {
    setFriesPickupTimeState(time);
    if (frituurSessieId) {
      try {
        await db.updateFrituurSessie(frituurSessieId, { pickup_time: time });
      } catch (e) {
        console.error('Failed to set pickup time', e);
      }
    }
  };

  const handlePlaceFryOrder = async (items, totalCost, targetUser) => {
    if (!currentUser) return;
    const orderForUser = targetUser || currentUser;
    const isOwnOrder = orderForUser.id === currentUser.id;
    const orderUserName = orderForUser.naam || orderForUser.name || 'Onbekend';

    const tempId = Math.random().toString(36).substr(2, 9);
    const newOrder = {
      id: tempId,
      userId: orderForUser.id,
      userName: orderUserName,
      items,
      totalPrice: totalCost,
      date: new Date(),
      status: 'open',
    };
    setFriesOrders(prev => [newOrder, ...prev]);

    if (isOwnOrder) setBalance(prev => prev + totalCost);

    try {
      const realId = await db.addFrituurBestelling(
        orderForUser.id,
        orderUserName,
        frituurSessieId,
        items,
        totalCost,
        activePeriod?.id
      );
      // Realtime kan de echte bestelling al toegevoegd hebben: dan enkel de tijdelijke weghalen
      setFriesOrders(prev =>
        prev.some(o => o.id === realId)
          ? prev.filter(o => o.id !== tempId)
          : prev.map(o => (o.id === tempId ? { ...o, id: realId } : o))
      );

      if (isOwnOrder) {
        showToast('Bestelling geplaatst! 🍟', 'success');
      } else {
        // De melding naar die persoon stuurt de database zelf (trigger melding_friet_voor_ander)
        showToast(`Bestelling voor ${orderForUser.naam} geplaatst! 🍟`, 'success');
      }
    } catch (error) {
      setFriesOrders(prev => prev.filter(o => o.id !== tempId));
      if (isOwnOrder) setBalance(prev => prev - totalCost);
      showToast('Fout bij het plaatsen van de bestelling', 'error');
    }
  };

  const handleRemoveFryOrder = async orderId => {
    const orderToRemove = friesOrders.find(o => o.id === orderId);
    if (!orderToRemove) return;
    setFriesOrders(prev => prev.filter(o => o.id !== orderId));

    try {
      await db.deleteFrituurBestelling(orderId);
      showToast('Bestelling geannuleerd', 'info');
    } catch (error) {
      setFriesOrders(prev => [orderToRemove, ...prev]);
      showToast(error.message || 'Fout bij het annuleren', 'error');
    }
  };

  // 'Stille' archivering zonder bedrag
  const handleArchiveFriesSession = async () => {
    if (!frituurSessieId) return;

    // Sla oude staat op voor eventuele rollback
    const prevOrders = [...friesOrders];
    const prevStatus = friesSessionStatus;
    const prevSessieId = frituurSessieId;

    try {
      setFriesOrders(prev => prev.map(o => ({ ...o, status: 'geleverd' })));
      setFriesSessionStatusState('closed');
      setFriesPickupTimeState(null);

      await db.finalizeFrituurSessie(frituurSessieId, 0);
      setFrituurSessieId(null);
    } catch (error) {
      console.error('Archiveren mislukt', error);
      setFriesOrders(prevOrders);
      setFriesSessionStatusState(prevStatus);
      setFrituurSessieId(prevSessieId);
      showToast('Archiveren mislukt. Probeer het opnieuw.', 'error');
    }
  };

  const handleCompleteFriesPayment = async (actualAmount, receiptFile) => {
    if (!frituurSessieId) {
      showToast('Geen actieve sessie gevonden om af te sluiten', 'error');
      return;
    }

    // Sla oude staat op voor rollback
    const prevOrders = [...friesOrders];
    const prevStatus = friesSessionStatus;
    const prevSessieId = frituurSessieId;

    try {
      let receiptUrl = '';

      // 1. Upload kasticket (optioneel, blokkeert de rest niet bij waarschuwing)
      if (receiptFile) {
        try {
          receiptUrl = await db.uploadReceipt(frituurSessieId, receiptFile);
        } catch (e) {
          console.warn('Kon kasticket niet uploaden', e);
        }
      }

      // 2. Update receipt_url (apart, omdat de RPC actual_amount al zet)
      if (receiptUrl) {
        try {
          await db.updateFrituurSessie(frituurSessieId, { receipt_url: receiptUrl });
        } catch (updateErr) {
          console.warn('Kon receipt_url niet updaten', updateErr);
        }
      }

      // 3. Atomische afronding via RPC
      const result = await db.finalizeFrituurSessie(frituurSessieId, actualAmount);

      // 4. Update UI na succes
      setFriesOrders(prev => prev.map(o => ({ ...o, status: 'geleverd' })));
      setFriesSessionStatusState('closed');
      setFriesPickupTimeState(null);
      setFrituurSessieId(null);

      // 5. Check prijsverschil op basis van server-data
      const expectedAmount = Number(result.expected_amount);
      if (Math.abs(actualAmount - expectedAmount) > 0.01) {
        // Prijsverschil melden aan wie friet en drank beheert
        const targetUsers = users.filter(u => u.actief && hasRecht(u, 'drank_beheren'));

        const formattedActual = `€${actualAmount.toFixed(2).replace('.', ',')}`;
        const formattedExpected = `€${expectedAmount.toFixed(2).replace('.', ',')}`;
        const diff = actualAmount - expectedAmount;
        const formattedDiff = `${diff > 0 ? '+' : ''}€${diff.toFixed(2).replace('.', ',')}`;

        const notifTitle = '🍟 Prijswijziging Frituur?';
        const notifContent = `Betaald: ${formattedActual} | Verwacht: ${formattedExpected}. Verschil: ${formattedDiff}.`;

        if (currentUser) {
          targetUsers.forEach(user => {
            db.addNotificatie(
              currentUser.id,
              user.id,
              notifTitle,
              notifContent,
              currentUser.naam || 'Systeem',
              ''
            ).catch(() => {});
          });
        }

        showToast('Betaling afgerond — prijsverschil gemeld', 'warning');
      } else {
        showToast('Betaling succesvol afgerond!', 'success');
      }
    } catch (error) {
      console.error('Grote fout bij afronden betaling:', error);
      setFriesOrders(prevOrders);
      setFriesSessionStatusState(prevStatus);
      setFrituurSessieId(prevSessieId);
      showToast('Fout bij het afronden. De sessie is niet gesloten.', 'error');
    }
  };

  // Melding naar wie in de lopende ronde besteld heeft (individuele meldingen: toegestaan voor alle leiding)
  const meldAanBestellers = async (titel, bericht) => {
    if (!currentUser) return;
    const ontvangers = [...new Set(friesOrders.filter(o => o.status === 'open').map(o => o.userId))].filter(
      id => id !== currentUser.id
    );
    await Promise.all(
      ontvangers.map(id =>
        db.addNotificatie(currentUser.id, id, titel, bericht, currentUser.naam || 'Friet', '', 'order').catch(() => {})
      )
    );
  };

  const handleAddFryItem = async item => {
    try {
      const id = await db.addFryItem(item);
      setFryItems(prev => [...prev, { ...item, id }]);
      showToast('Item toegevoegd', 'success');
    } catch (error) {
      console.error('Failed to add fry item:', error);
      showToast('Fout bij toevoegen item', 'error');
    }
  };

  const handleUpdateFryItem = async (id, updates) => {
    try {
      await db.updateFryItem(id, updates);
      setFryItems(prev => prev.map(i => (i.id === id ? { ...i, ...updates } : i)));
      showToast('Item bijgewerkt', 'success');
    } catch (error) {
      console.error('Failed to update fry item:', error);
      showToast('Fout bij bijwerken item', 'error');
    }
  };

  const handleDeleteFryItem = async id => {
    try {
      await db.deleteFryItem(id);
      setFryItems(prev => prev.filter(i => i.id !== id));
      showToast('Item verwijderd', 'success');
    } catch (error) {
      console.error('Failed to delete fry item:', error);
      showToast('Fout bij verwijderen item', 'error');
    }
  };

  const activeFrituurSession = frituurSessieId
    ? {
        id: frituurSessieId,
        status: friesSessionStatus,
        pickupTime: friesPickupTime,
      }
    : null;

  // Loopt er nu een ronde? Een vergeten ronde (nooit afgesloten) telt na 18 uur niet meer mee op het startscherm.
  const rondeLoopt =
    !!frituurSessieId &&
    ['open', 'ordering', 'ordered'].includes(friesSessionStatus) &&
    (!sessieGestart || Date.now() - sessieGestart.getTime() < 18 * 60 * 60 * 1000);

  return (
    <FriesContext.Provider
      value={{
        currentUser,
        users,
        frituurSessieId,
        rondeLoopt,
        friesOrders,
        activeFrituurSession,
        friesSessionStatus,
        friesPickupTime,
        setFriesSessionStatus,
        setFriesPickupTime,
        handleArchiveFriesSession,
        handleCompleteFriesPayment,
        handlePlaceFryOrder,
        handleRemoveFryOrder,
        fryItems,
        handleAddFryItem,
        handleUpdateFryItem,
        handleDeleteFryItem,
        meldAanBestellers,
        loading,
      }}
    >
      {children}
    </FriesContext.Provider>
  );
};

export const useFries = () => {
  const context = useContext(FriesContext);
  if (context === undefined) {
    throw new Error('useFries must be used within a FriesProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect } from 'react';

import * as db from '../../lib/supabaseService';
import { useAuth } from '../auth/AuthContext';
import { showToast } from '../../components/Toast';

const DrinkContext = createContext(undefined);

export function DrinkProvider({ children }) {
  const { session, currentUser } = useAuth();
  const [dranken, setDranken] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [balances, setBalances] = useState({});
  const [activePeriod, setActivePeriod] = useState(null);
  const [billingPeriods, setBillingPeriods] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadDrinkData();
    }
  }, [session?.user?.id]);

  const loadDrinkData = async () => {
    setLoading(true);
    try {
      const [drankenData, streaksData, periodsData, balancesData, stockData] = await Promise.all([
        db.fetchDranken(),
        db.fetchConsumpties(), // All streaks
        db.fetchBillingPeriods(),
        db.fetchAllBalances(),
        db.fetchStockItems(),
      ]);

      setDranken(drankenData);
      setStreaks(streaksData);
      setBillingPeriods(periodsData);
      setBalances(balancesData);
      setStockItems(stockData);
      setActivePeriod(periodsData.find(p => !p.is_closed) || null);
    } catch (e) {
      console.error('Error loading drink data', e);
    } finally {
      setLoading(false);
    }
  };

  // Offline gezette strepen doorsturen. Wat mislukt, blijft in de wachtrij voor een volgende poging
  // (anders gaan strepen stil verloren). Eén sync tegelijk.
  const syncBezig = React.useRef(false);
  const syncOfflineStreaks = async () => {
    if (syncBezig.current || !navigator.onLine) return;
    let pendingStreaks = [];
    try {
      pendingStreaks = JSON.parse(localStorage.getItem('ksa_pending_streaks') || '[]');
    } catch (e) {
      console.error('Offline strepen onleesbaar', e);
      return;
    }
    if (!pendingStreaks.length) return;

    syncBezig.current = true;
    showToast(`${pendingStreaks.length} offline strepen doorsturen...`, 'info');
    const mislukt = [];
    for (const streak of pendingStreaks) {
      try {
        const realId = await db.addConsumptie(streak.userId, streak.drinkId, streak.quantity, streak.periodId, streak.userName);
        setStreaks(prev => prev.map(s => (s.id === streak.tempId ? { ...s, id: realId } : s)));
      } catch (e) {
        console.error('Offline streep doorsturen mislukt', streak, e);
        const pogingen = (streak.pogingen || 0) + 1;
        if (pogingen < 5) mislukt.push({ ...streak, pogingen });
        else showToast(`Een offline streep kon na 5 pogingen niet doorgestuurd worden: ${e.message || 'fout'}`, 'error');
      }
    }
    if (mislukt.length) {
      localStorage.setItem('ksa_pending_streaks', JSON.stringify(mislukt));
      showToast(`${mislukt.length} strepen nog niet doorgestuurd; we proberen het later opnieuw.`, 'warning');
    } else {
      localStorage.removeItem('ksa_pending_streaks');
      showToast('Offline strepen doorgestuurd!', 'success');
    }
    syncBezig.current = false;
    refreshDrinksData();
  };

  // Bij terug online én bij het (opnieuw) openen van de app met een sessie
  useEffect(() => {
    window.addEventListener('online', syncOfflineStreaks);
    return () => window.removeEventListener('online', syncOfflineStreaks);
  }, []);

  useEffect(() => {
    if (session?.user?.id) syncOfflineStreaks();
  }, [session?.user?.id]);

  const handleAddCost = async (userId, drinkId, quantity = 1, userNaam) => {
    const drink = dranken.find(d => d.id === drinkId);
    if (!drink) {
      showToast('Drankje niet gevonden', 'error');
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newCost = {
      id: tempId,
      userId,
      drinkId,
      drinkName: drink.name,
      price: drink.price,
      amount: quantity,
      timestamp: new Date(),
      period_id: activePeriod?.id,
    };

    // Optimistic UI update
    setStreaks(prev => [newCost, ...prev]);
    setBalances(prev => ({
      ...prev,
      [userId]: (prev[userId] || 0) + drink.price * quantity,
    }));

    // Perform check if device is offline
    if (!navigator.onLine) {
      let pending = [];
      try {
        pending = JSON.parse(localStorage.getItem('ksa_pending_streaks') || '[]');
      } catch (e) {}

      pending.push({
        tempId,
        userId,
        drinkId,
        quantity,
        userName: userNaam,
        periodId: activePeriod?.id,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('ksa_pending_streaks', JSON.stringify(pending));
      showToast('Offline streepje toegevoegd. Wordt gesynct wanneer je online bent.', 'info');
      return;
    }

    try {
      const realId = await db.addConsumptie(userId, drinkId.toString(), quantity, activePeriod?.id, userNaam);
      setStreaks(prev => prev.map(s => (s.id === tempId ? { ...s, id: realId } : s)));
    } catch (error) {
      // Revert optimistic update on failure
      setStreaks(prev => prev.filter(s => s.id !== tempId));
      setBalances(prev => ({
        ...prev,
        [userId]: (prev[userId] || 0) - drink.price * quantity,
      }));
      showToast('Fout bij toevoegen streepje. Probeer opnieuw.', 'error');
    }
  };

  // Drankteam: strepen van iedereen verwijderen, op elk moment (geen 1-uurlimiet; RLS controleert het recht)
  const handleDeleteStreak = streakId => handleRemoveCost(streakId, true);

  const handleQuickStreep = () => {
    if (!currentUser) return;
    const drinkId = currentUser.quickDrinkId || (dranken.length > 0 ? String(dranken[0].id) : null);
    if (!drinkId) return;
    const drink = dranken.find(d => String(d.id) === String(drinkId));
    if (drink) {
      handleAddCost(currentUser.id, drink.id, 1, currentUser.naam);
    }
  };

  const handleRemoveCost = async (streakId, isAdmin = false) => {
    const cost = streaks.find(s => s.id === streakId);
    if (!cost) return;

    if (cost.id.toString().startsWith('temp-')) {
      showToast('Wacht even tot deze streep is gesynct.', 'info');
      return;
    }

    // Bypass de limiet als de user een admin is vanuit het history scherm
    if (!isAdmin && new Date(cost.timestamp).getTime() < Date.now() - 3600000) {
      showToast('Enkel verwijderen binnen 1 uur toegestaan.', 'error');
      return;
    }

    // Optimistic UI update
    setStreaks(prev => prev.filter(s => s.id !== streakId));
    setBalances(prev => ({
      ...prev,
      [cost.userId]: (prev[cost.userId] || 0) - cost.price * cost.amount,
    }));

    try {
      await db.deleteConsumptie(streakId);
      showToast('Streepje verwijderd', 'success');
    } catch (error) {
      // Revert
      setStreaks(prev => [cost, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
      setBalances(prev => ({
        ...prev,
        [cost.userId]: (prev[cost.userId] || 0) + cost.price * cost.amount,
      }));
      showToast(error.message || 'Fout bij verwijderen. Probeer opnieuw.', 'error');
    }
  };

  const refreshDrinksData = async () => {
    await loadDrinkData();
  };

  return (
    <DrinkContext.Provider
      value={{
        dranken,
        streaks,
        balances,
        activePeriod,
        billingPeriods,
        stockItems,
        loading,
        handleAddCost,
        handleRemoveCost,
        refreshDrinksData,
        setDrinks: setDranken,
        setStreaks,
        setBalance: updater => {
          if (!currentUser) return;
          setBalances(prev => ({
            ...prev,
            [currentUser.id]: typeof updater === 'function' ? updater(prev[currentUser.id] || 0) : updater,
          }));
        },
        setActivePeriod,
        setBillingPeriods,
        setStockItems,
        handleQuickStreep,
        handleDeleteStreak,
      }}
    >
      {children}
    </DrinkContext.Provider>
  );
}

export function useDrink() {
  const context = useContext(DrinkContext);
  if (context === undefined) {
    throw new Error('useDrink must be used within a DrinkProvider');
  }
  return context;
}

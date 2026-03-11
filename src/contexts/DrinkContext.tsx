import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Drink, Streak, BillingPeriod, StockItem } from '../types';
import * as db from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { showToast } from '../components/Toast';

interface DrinkContextType {
  dranken: Drink[];
  streaks: Streak[];
  balances: Record<string, number>;
  activePeriod: BillingPeriod | null;
  billingPeriods: BillingPeriod[];
  stockItems: StockItem[];
  gsheetId: string | null;
  gsheetSharingEmail: string | null;
  loading: boolean;
  handleAddCost: (userId: string, drinkId: string | number, quantity?: number, userNaam?: string) => Promise<void>;
  handleRemoveCost: (streakId: string) => Promise<void>;
  setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
  setStreaks: React.Dispatch<React.SetStateAction<Streak[]>>;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  setActivePeriod: React.Dispatch<React.SetStateAction<BillingPeriod | null>>;
  setBillingPeriods: React.Dispatch<React.SetStateAction<BillingPeriod[]>>;
  setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setGsheetId: React.Dispatch<React.SetStateAction<string | null>>;
  handleQuickStreep: () => void;
  handleDeleteStreak: (streakId: string | number) => Promise<void>;
  refreshDrinksData: () => Promise<void>;
  setGsheetSharingEmail: React.Dispatch<React.SetStateAction<string | null>>;
  syncToGoogleSheets: (command: string, payload: any) => Promise<any>;
}

const DrinkContext = createContext<DrinkContextType | undefined>(undefined);

export function DrinkProvider({ children }: { children: ReactNode }) {
  const { session, currentUser } = useAuth();
  const [dranken, setDranken] = useState<Drink[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [activePeriod, setActivePeriod] = useState<BillingPeriod | null>(null);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [gsheetId, setGsheetId] = useState<string | null>(null);
  const [gsheetSharingEmail, setGsheetSharingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadDrinkData();
    }
  }, [session?.user?.id]);

  const loadDrinkData = async () => {
    setLoading(true);
    try {
      const [drankenData, streaksData, periodsData, balancesData, stockData, gsheetIdSetting, gsheetEmailSetting] = await Promise.all([
        db.fetchDranken(),
        db.fetchConsumpties(), // All streaks
        db.fetchBillingPeriods(),
        db.fetchAllBalances(),
        db.fetchStockItems(),
        db.fetchSetting('gsheet_id'),
        db.fetchSetting('gsheet_sharing_email')
      ]);

      setDranken(drankenData);
      setStreaks(streaksData);
      setBillingPeriods(periodsData);
      setBalances(balancesData);
      setStockItems(stockData);
      setGsheetId(gsheetIdSetting);
      setGsheetSharingEmail(gsheetEmailSetting);
      setActivePeriod(periodsData.find(p => !p.is_closed) || null);
    } catch (e) {
      console.error("Error loading drink data", e);
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineStreaks = async () => {
    const pendingStr = localStorage.getItem('ksa_pending_streaks');
    if (!pendingStr) return;
    try {
      const pendingStreaks = JSON.parse(pendingStr) as any[];
      if (pendingStreaks.length > 0) {
        showToast(`Netwerk hersteld. ${pendingStreaks.length} offline strepen synchroniseren...`, 'info');
        for (const streak of pendingStreaks) {
          try {
            const realId = await db.addConsumptie(streak.userId, streak.drinkId, streak.quantity, streak.periodId, streak.userName);
            setStreaks(prev => prev.map(s => s.id === streak.tempId ? { ...s, id: realId } : s));
          } catch (e) {
            console.error('Failed to sync streak', streak, e);
          }
        }
        localStorage.removeItem('ksa_pending_streaks');
        showToast('Vastgelopen strepen succesvol gesynct!', 'success');
        refreshDrinksData();
      }
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  useEffect(() => {
    window.addEventListener('online', syncOfflineStreaks);
    return () => window.removeEventListener('online', syncOfflineStreaks);
  }, []);

  const handleAddCost = async (userId: string, drinkId: string | number, quantity = 1, userNaam?: string) => {
    const drink = dranken.find(d => d.id === drinkId);
    if (!drink) {
      showToast('Drankje niet gevonden', 'error');
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newCost: Streak = {
      id: tempId,
      userId,
      drinkId,
      drinkName: drink.name,
      price: drink.price,
      amount: quantity,
      timestamp: new Date(),
      period_id: activePeriod?.id
    };

    // Optimistic UI update
    setStreaks(prev => [newCost, ...prev]);
    setBalances(prev => ({
      ...prev,
      [userId]: (prev[userId] || 0) + (drink.price * quantity)
    }));

    // Perform check if device is offline
    if (!navigator.onLine) {
        let pending = [];
        try {
            pending = JSON.parse(localStorage.getItem('ksa_pending_streaks') || '[]');
        } catch(e) {}
        
        pending.push({
            tempId,
            userId,
            drinkId,
            quantity,
            userName: userNaam,
            periodId: activePeriod?.id,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('ksa_pending_streaks', JSON.stringify(pending));
        showToast('Offline streepje toegevoegd. Wordt gesynct wanneer je online bent.', 'info');
        return;
    }

    try {
      const realId = await db.addConsumptie(userId, drinkId.toString(), quantity, activePeriod?.id, userNaam);
      setStreaks(prev => prev.map(s => s.id === tempId ? { ...s, id: realId } : s));
    } catch (error) {
      // Revert optimistic update on failure
      setStreaks(prev => prev.filter(s => s.id !== tempId));
      setBalances(prev => ({
        ...prev,
        [userId]: (prev[userId] || 0) - (drink.price * quantity)
      }));
      showToast('Fout bij toevoegen streepje. Probeer opnieuw.', 'error');
    }
  };

  const handleDeleteStreak = async (streakId: string | number) => {
    // Stub for now
  };

  const handleQuickStreep = () => {
    if (!currentUser) return;
    const drinkId = currentUser.quickDrinkId || (dranken.length > 0 ? String(dranken[0].id) : null);
    if (!drinkId) return;
    const drink = dranken.find(d => String(d.id) === String(drinkId));
    if (drink) {
        handleAddCost(currentUser.id, drink.id, 1, currentUser.naam);
    }
  };

  const handleRemoveCost = async (streakId: string) => {
    const cost = streaks.find(s => s.id === streakId);
    if (!cost) return;

    if (cost.id.toString().startsWith('temp-')) {
      showToast('Wacht even tot deze streep is gesynct.', 'info');
      return;
    }

    if (cost.timestamp.getTime() < Date.now() - 3600000) {
      showToast('Enkel verwijderen binnen 1 uur toegestaan.', 'error');
      return;
    }

    // Optimistic UI update
    setStreaks(prev => prev.filter(s => s.id !== streakId));
    setBalances(prev => ({
      ...prev,
      [cost.userId]: (prev[cost.userId] || 0) - (cost.price * cost.amount)
    }));

    try {
      await db.deleteConsumptie(streakId);
      showToast('Streepje verwijderd', 'success');
    } catch (error) {
      // Revert
      setStreaks(prev => [cost, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
      setBalances(prev => ({
        ...prev,
        [cost.userId]: (prev[cost.userId] || 0) + (cost.price * cost.amount)
      }));
      showToast('Fout bij verwijderen. Probeer opnieuw.', 'error');
    }
  };

  const refreshDrinksData = async () => {
    await loadDrinkData();
  };

  const syncToGoogleSheets = async (command: string, payload: any) => {
    showToast('Synchroniseren met Google Sheets...', 'info');
    try {
      const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
        body: { command, payload }
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        showToast('Succesvol gesynct met Google Sheets!', 'success');
        if (data.sheetId && command === 'CREATE_SHEET' && !data.error) {
           await db.saveAppSetting('gsheet_id', data.sheetId);
           setGsheetId(data.sheetId);
        }
        return data;
      } else {
        throw new Error(data?.error || 'Unknown error from Edge Function');
      }
    } catch (error: any) {
      console.error('Google Sheets sync error:', error);
      if (error.message && error.message.includes('403')) {
          showToast('Google Sheets Error: Permissie geweigerd (403)', 'error');
      } else if (error.message && error.message.includes('401')) {
          showToast('Google Sheets Error: Niet geauthenticeerd (401)', 'error');
      } else {
          showToast(`Fout bij syncen met Google Sheets: ${error.message || 'Onbekende fout'}`, 'error');
      }
      return { success: false, error: error.message };
    }
  };

  return (
    <DrinkContext.Provider value={{
      dranken, streaks, balances, activePeriod, billingPeriods, stockItems, 
      gsheetId, gsheetSharingEmail, loading,
      handleAddCost, handleRemoveCost, refreshDrinksData,
      setGsheetSharingEmail, syncToGoogleSheets,
      setDrinks: setDranken, setStreaks, setBalance: (updater) => {
        if (!currentUser) return;
        setBalances(prev => ({
          ...prev,
          [currentUser.id]: typeof updater === 'function' ? updater(prev[currentUser.id] || 0) : updater
        }));
      }, setActivePeriod, setBillingPeriods, setStockItems, setGsheetId, handleQuickStreep, handleDeleteStreak
    }}>
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

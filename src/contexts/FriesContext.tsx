import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FryItem, Order, User } from '../types';
import * as db from '../lib/supabaseService';
import { useAuth } from './AuthContext';
import { useDrink } from './DrinkContext';
import { showToast } from '../components/Toast';

interface FriesContextType {
  fryItems: FryItem[];
  activeFrituurSession: { id: string; status: string; pickupTime: string | null } | null;
  friesOrders: Order[];
  loading: boolean;
  refreshFriesData: () => Promise<void>;
  
  handlePlaceFryOrder: (items: any[], totalCost: number, targetUser?: User) => Promise<void>;
  handleRemoveFryOrder: (orderId: string) => Promise<void>;
  handleArchiveFriesSession: () => Promise<void>;
  handleCompleteFriesPayment: (actualAmount: number, receiptFile?: File) => Promise<void>;
  handleAddFryItem: (item: Omit<FryItem, 'id'>) => Promise<void>;
  handleUpdateFryItem: (id: string, updates: Partial<FryItem>) => Promise<void>;
  handleDeleteFryItem: (id: string) => Promise<void>;
  
  setFriesSessionStatus: (status: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered') => void;
  setFriesPickupTime: (time: string | null) => void;
}

const FriesContext = createContext<FriesContextType | undefined>(undefined);

export function FriesProvider({ children }: { children: ReactNode }) {
  const { session, currentUser, users } = useAuth();
  const { setBalance, activePeriod } = useDrink();
  
  const [fryItems, setFryItems] = useState<FryItem[]>([]);
  const [activeFrituurSession, setActiveFrituurSession] = useState<{ id: string; status: string; pickupTime: string | null } | null>(null);
  const [friesOrders, setFriesOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadFriesData();
    }
  }, [session?.user?.id]);

  const loadFriesData = async () => {
    setLoading(true);
    try {
      const [itemsData, activeSession] = await Promise.all([
        db.fetchFryItems(),
        db.fetchActiveFrituurSessie()
      ]);

      setFryItems(itemsData);
      setActiveFrituurSession(activeSession);

      if (activeSession) {
        const ordersData = await db.fetchFrituurBestellingen(activeSession.id);
        setFriesOrders(ordersData);
      } else {
        setFriesOrders([]);
      }
    } catch (e) {
      console.error("Error loading fries data", e);
    } finally {
      setLoading(false);
    }
  };

  const setFriesSessionStatus = (status: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered') => {
      setActiveFrituurSession(prev => prev ? { ...prev, status } : null);
  };
  const setFriesPickupTime = (pickupTime: string | null) => {
      setActiveFrituurSession(prev => prev ? { ...prev, pickupTime } : null);
  };

  const handlePlaceFryOrder = async (items: any[], totalCost: number, targetUser?: User) => {
    if (!currentUser) return;
    const orderForUser = targetUser || currentUser;
    const isOwnOrder = orderForUser.id === currentUser.id;

    const tempId = Math.random().toString(36).substr(2, 9);
    const newOrder: Order = {
        id: tempId,
        userId: orderForUser.id,
        userName: orderForUser.naam || orderForUser.name || 'Onbekend',
        items,
        totalPrice: totalCost,
        date: new Date(),
        status: 'pending'
    };
    setFriesOrders(prev => [newOrder, ...prev]);

    if (isOwnOrder) setBalance(prev => prev + totalCost);

    try {
        const realId = await db.addFrituurBestelling(
            orderForUser.id,
            orderForUser.naam || orderForUser.name || 'Onbekend',
            activeFrituurSession?.id || null,
            items,
            totalCost,
            activePeriod?.id
        );
        setFriesOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o));
        showToast('Bestelling geplaatst! 🍟', 'success');
    } catch (error) {
        setFriesOrders(prev => prev.filter(o => o.id !== tempId));
        if (isOwnOrder) setBalance(prev => prev - totalCost);
        showToast('Fout bij het plaatsen van de bestelling', 'error');
    }
  };

  const handleRemoveFryOrder = async (orderId: string) => {
    const orderToRemove = friesOrders.find(o => o.id === orderId);
    if (!orderToRemove) return;

    setFriesOrders(prev => prev.filter(o => o.id !== orderId));
    try {
        await db.deleteFrituurBestelling(orderId);
        showToast('Bestelling geannuleerd', 'info');
    } catch (error) {
        setFriesOrders(prev => [orderToRemove, ...prev]);
        showToast('Fout bij het annuleren', 'error');
    }
  };

  const handleArchiveFriesSession = async () => {
    if (!activeFrituurSession?.id) return;

    setFriesOrders(prev => prev.map(o => ({ ...o, status: 'completed' as const })));
    setFriesSessionStatus('closed');
    setFriesPickupTime(null);

    try {
        await db.archiveFrituurSessie(activeFrituurSession.id);
        setActiveFrituurSession(null);
        showToast('Frituursessie afgesloten!', 'success');
    } catch (error) {
        showToast('Fout bij het afsluiten van de sessie', 'error');
    }
  };

  const handleCompleteFriesPayment = async (actualAmount: number, receiptFile?: File) => {
    if (!activeFrituurSession?.id || !currentUser) return;
    const sessieId = activeFrituurSession.id;

    try {
        let receiptUrl = '';
        if (receiptFile) {
            receiptUrl = await db.uploadReceipt(sessieId, receiptFile);
        }

        await db.updateFrituurSessie(sessieId, {
            actual_amount: actualAmount,
            receipt_url: receiptUrl,
            status: 'paid'
        });

        const expectedAmount = friesOrders.filter(o => o.status === 'pending').reduce((acc, o) => acc + o.totalPrice, 0);

        if (Math.abs(actualAmount - expectedAmount) > 0.01) {
            const targetUsers = users.filter((u: any) => {
                const roles = (u.roles || []).map((r: string) => r.toLowerCase());
                return roles.includes('hoofdleiding') ||
                       roles.includes('drank') ||
                       roles.includes('team drank') ||
                       u.rol === 'admin' ||
                       u.rol === 'team_drank';
            });

            const formattedActual = `€${actualAmount.toFixed(2).replace('.', ',')}`;
            const formattedExpected = `€${expectedAmount.toFixed(2).replace('.', ',')}`;
            const diff = actualAmount - expectedAmount;
            const formattedDiff = `${diff > 0 ? '+' : ''}€${diff.toFixed(2).replace('.', ',')}`;

            const notifContent = `Het betaalde bedrag (${formattedActual}) wijkt af van het verwachte bedrag in de app (${formattedExpected}). Verschil: ${formattedDiff}. Dit kan wijzen op een prijswijziging bij de frituur.`;
            const notifAction = `Ga naar rekening & bestelling|/fries-comparison?sessionId=${sessieId}`;

            targetUsers.forEach((user: any) => {
                db.addNotificatie(
                    currentUser.id,
                    user.id,
                    '🍟 Prijswijziging Frituur?',
                    notifContent,
                    currentUser.naam || currentUser.name || 'Systeem',
                    notifAction
                ).catch(() => {});
            });

            handleArchiveFriesSession();
            showToast('Betaling afgerond — prijsverschil gemeld aan leiding', 'warning');
        } else {
            handleArchiveFriesSession();
            showToast('Betaling succesvol afgerond!', 'success');
        }
    } catch (error) {
        console.error(error);
        showToast('Fout bij afronden betaling', 'error');
    }
  };

  const handleAddFryItem = async (item: Omit<FryItem, 'id'>) => {
    try {
        const id = await db.addFryItem(item);
        setFryItems(prev => [...prev, { ...item, id }]);
        showToast('Item toegevoegd', 'success');
    } catch (error) {
        showToast('Fout bij toevoegen item', 'error');
    }
  };

  const handleUpdateFryItem = async (id: string, updates: Partial<FryItem>) => {
    try {
        await db.updateFryItem(id, updates);
        setFryItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
        showToast('Item bijgewerkt', 'success');
    } catch (error) {
        showToast('Fout bij bijwerken item', 'error');
    }
  };

  const handleDeleteFryItem = async (id: string) => {
    try {
        await db.deleteFryItem(id);
        setFryItems(prev => prev.filter(i => i.id !== id));
        showToast('Item verwijderd', 'success');
    } catch (error) {
        showToast('Fout bij verwijderen item', 'error');
    }
  };

  const refreshFriesData = async () => {
    await loadFriesData();
  };

  return (
    <FriesContext.Provider value={{
      fryItems, activeFrituurSession, friesOrders, loading, refreshFriesData,
      handlePlaceFryOrder, handleRemoveFryOrder, handleArchiveFriesSession,
      handleCompleteFriesPayment, handleAddFryItem, handleUpdateFryItem, handleDeleteFryItem,
      setFriesSessionStatus, setFriesPickupTime
    }}>
      {children}
    </FriesContext.Provider>
  );
}

export function useFries() {
  const context = useContext(FriesContext);
  if (context === undefined) {
    throw new Error('useFries must be used within a FriesProvider');
  }
  return context;
}

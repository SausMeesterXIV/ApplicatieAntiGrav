import React, { createContext, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { Order } from '../types';

interface FrituurSession {
  id: string;
  status: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered';
  pickupTime: string | null;
}

interface FriesContextType {
  openSession: () => Promise<void>;
  closeSession: () => Promise<void>;
  friesOrders: Order[];
  activeFrituurSession: FrituurSession | null;
  friesSessionStatus: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered';
  friesPickupTime: string | null;
  setFriesSessionStatus: React.Dispatch<React.SetStateAction<'open' | 'closed' | 'completed' | 'ordering' | 'ordered'>>;
  setFriesPickupTime: React.Dispatch<React.SetStateAction<string | null>>;
  handleArchiveFriesSession: () => Promise<void>;
  handleCompleteFriesPayment: (actualAmount: number, receiptFile?: File) => Promise<void>;
}

const FriesContext = createContext<FriesContextType | undefined>(undefined);

export const FriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useOutletContext<AppContextType>();

  // This will happen if FriesProvider is used correctly as a layout route child of MainLayout
  if (!context) {
    console.warn('FriesProvider: No AppContext found via useOutletContext');
    return <>{children}</>;
  }

  const { 
    currentUser, 
    frituurSessieId, 
    setFrituurSessieId,
    friesSessionStatus,
    setFriesSessionStatus,
    friesPickupTime,
    setFriesPickupTime,
    friesOrders,
    setFriesOrders,
    handleArchiveFriesSession,
    handleCompleteFriesPayment
  } = context;

  const openSession = async () => {
    try {
      const newSessieId = await db.createFrituurSessie(currentUser.id);
      setFrituurSessieId(newSessieId);
      setFriesSessionStatus('open');
      setFriesPickupTime(null);
      setFriesOrders([]);
      showToast('Nieuwe frituursessie geopend!', 'success');
    } catch (error) {
      console.error('Failed to open session:', error);
      showToast('Fout bij openen sessie', 'error');
    }
  };

  const closeSession = async () => {
    if (!frituurSessieId) return;
    try {
      await db.archiveFrituurSessie(frituurSessieId);
      setFrituurSessieId(null);
      setFriesSessionStatus('closed');
      setFriesPickupTime(null);
      showToast('Sessie afgesloten', 'info');
    } catch (error) {
      showToast('Fout bij afsluiten', 'error');
    }
  };

  const activeFrituurSession: FrituurSession | null = frituurSessieId ? {
    id: frituurSessieId,
    status: friesSessionStatus,
    pickupTime: friesPickupTime
  } : null;

  const value: FriesContextType = {
    openSession,
    closeSession,
    friesOrders,
    activeFrituurSession,
    friesSessionStatus,
    friesPickupTime,
    setFriesSessionStatus,
    setFriesPickupTime,
    handleArchiveFriesSession,
    handleCompleteFriesPayment
  };

  return (
    <FriesContext.Provider value={value}>
      {children}
    </FriesContext.Provider>
  );
};

export const useFries = () => {
  const context = useContext(FriesContext);
  if (!context) throw new Error('useFries must be used within a FriesProvider');
  return context;
};

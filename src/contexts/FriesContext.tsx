import React, { createContext, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const FriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Provider is nu enkel een passthrough, we gebruiken de AppContext voor globale state
  return <>{children}</>;
};

export const useFries = () => {
  const context = useOutletContext<AppContextType>();
  
  if (!context) {
    throw new Error('useFries moet binnen een AppContext / Frituur layout gebruikt worden.');
  }

  const { 
    currentUser, 
    users,
    frituurSessieId, 
    setFrituurSessieId,
    friesSessionStatus,
    setFriesSessionStatus,
    friesPickupTime,
    setFriesPickupTime,
    friesOrders,
    setFriesOrders,
    handleArchiveFriesSession,
    handleCompleteFriesPayment,
    handlePlaceFryOrder,
    handleRemoveFryOrder,
    fryItems,
    handleAddFryItem,
    handleUpdateFryItem,
    handleDeleteFryItem,
    loading
  } = context;

  // INTERCEPTOR: Update lokaal én direct in de database
  const setFriesSessionStatusDB = async (status: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered') => {
      setFriesSessionStatus(status);
      
      try {
          if (status === 'open' && !frituurSessieId) {
              const newId = await db.createFrituurSessie(currentUser?.id || 'system');
              setFrituurSessieId(newId);
          } else if (frituurSessieId) {
              await db.updateFrituurSessie(frituurSessieId, { status });
          }
      } catch (e) {
          console.error("Failed to update session status", e);
          showToast("Fout bij opslaan status in database", "error");
      }
  };

  // INTERCEPTOR: Update afhaaltijd lokaal én direct in de database
  const setFriesPickupTimeDB = async (time: string | null) => {
      setFriesPickupTime(time);
      if (frituurSessieId) {
          try {
              await db.updateFrituurSessie(frituurSessieId, { pickup_time: time });
          } catch (e) {
              console.error("Failed to set pickup time", e);
          }
      }
  };

  const activeFrituurSession = frituurSessieId ? {
    id: frituurSessieId,
    status: friesSessionStatus,
    pickupTime: friesPickupTime
  } : null;

  return {
    currentUser,
    users,
    frituurSessieId,
    friesOrders,
    activeFrituurSession,
    friesSessionStatus,
    friesPickupTime,
    setFriesSessionStatus: setFriesSessionStatusDB,
    setFriesPickupTime: setFriesPickupTimeDB,
    handleArchiveFriesSession,
    handleCompleteFriesPayment,
    handlePlaceFryOrder,
    handleRemoveFryOrder,
    fryItems,
    handleAddFryItem,
    handleUpdateFryItem,
    handleDeleteFryItem,
    loading
  };
};

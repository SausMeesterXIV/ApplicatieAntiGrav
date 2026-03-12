import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import { useDrink } from '../../contexts/DrinkContext';
import * as db from '../../lib/supabaseService';

interface StrepenAdminPanelProps {
  onDrinkDeleted: (id: string | number) => void;
}

export const StrepenAdminPanel: React.FC<StrepenAdminPanelProps> = ({ onDrinkDeleted }) => {
  const { dranken: drinks, setDrinks: onUpdateDrinks } = useDrink();

  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingDrinkId, setEditingDrinkId] = useState<string | number | null>(null);
  const [editDrinkName, setEditDrinkName] = useState('');
  const [editDrinkPrice, setEditDrinkPrice] = useState('');

  useEffect(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setValidUntil(nextWeek.toISOString().split('T')[0]);
  }, []);

  const handleAddNewDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrinkName || !newDrinkPrice) return;

    setIsSubmitting(true);
    try {
      const price = parseFloat(newDrinkPrice.replace(',', '.'));
      
      // Use the service function which handles the correct mapping to DB fields (naam, prijs, is_temporary, valid_until)
      const data = await db.addDrank(newDrinkName, price, isTemporary, isTemporary ? validUntil : undefined);

      if (data) {
        onUpdateDrinks([...drinks, data]);
        setNewDrinkName('');
        setNewDrinkPrice('');
        setIsTemporary(false);
        showToast('Drank succesvol toegevoegd!', 'success');
      }
    } catch (error) {
      console.error('Error adding drink:', error);
      showToast('Fout bij het toevoegen van de drank.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDrink = async (id: string | number) => {
    try {
      const priceNum = parseFloat(editDrinkPrice.replace(',', '.'));
      if (isNaN(priceNum)) {
        showToast('Ongeldige prijs', 'error');
        return;
      }

      // Use service function
      await db.updateDrank(id, editDrinkName, priceNum);

      onUpdateDrinks(drinks.map(d => d.id === id ? { ...d, name: editDrinkName, price: priceNum } : d));
      setEditingDrinkId(null);
      showToast('Drank succesvol bewerkt', 'success');
    } catch (error) {
      console.error('Error updating drink:', error);
      showToast('Fout bij het updaten van de drank.', 'error');
    }
  };

  const handleDeleteDrink = async (id: string | number) => {
    if (!window.confirm('Weet je zeker dat je deze drank wilt verwijderen? Het is veiliger om het gewoon niet meer te gebruiken, verwijderen kan kapotte facturen veroorzaken als de drank al gestreept is.')) return;
    try {
      await db.deleteDrank(id);

      onUpdateDrinks(drinks.filter(d => d.id !== id));
      onDrinkDeleted(id);
      showToast('Drank verwijderd', 'success');
    } catch (error) {
      console.error('Error deleting drink:', error);
      showToast('Fout bij het verwijderen van de drank. Mogelijk al in gebruik.', 'error');
    }
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-icons-round text-orange-500">settings_applications</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Beheer (Admin & Team Drank)</h2>
      </div>

      <form onSubmit={handleAddNewDrink} className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-5 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-orange-800 dark:text-orange-200">Nieuwe drank toevoegen</h3>
          <div className="bg-white dark:bg-[#1f293b] p-1 rounded-lg border border-orange-200 dark:border-orange-800 flex text-xs font-bold transition-colors">
            <button type="button" onClick={() => setIsTemporary(false)} className={`px-3 py-1 rounded-md transition-all ${!isTemporary ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>Permanent</button>
            <button type="button" onClick={() => setIsTemporary(true)} className={`px-3 py-1 rounded-md transition-all ${isTemporary ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>Tijdelijk</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Naam</label>
            <input type="text" placeholder="Naam (bv. Mojito)" value={newDrinkName} onChange={(e) => setNewDrinkName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Prijs</label>
            <input type="number" step="0.10" inputMode="decimal" placeholder="€" value={newDrinkPrice} onChange={(e) => setNewDrinkPrice(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors" />
          </div>
        </div>

        {isTemporary && (
          <div className="animate-in fade-in duration-300">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Geldig tot</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors" />
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          {isSubmitting ? <span className="text-xs">Toevoegen...</span> : <><span className="material-icons-round text-sm">add</span>{isTemporary ? 'Tijdelijke Drank Toevoegen' : 'Toevoegen aan Lijst'}</>}
        </button>
      </form>

      <div className="mt-4 bg-white dark:bg-[#1f293b] border border-gray-100 dark:border-gray-800 p-5 rounded-2xl transition-colors">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Bestaande Dranken Beheren</h3>
        <div className="space-y-3">
          {drinks.map(drink => (
            <div key={drink.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
              {editingDrinkId === drink.id ? (
                <>
                  <input type="text" value={editDrinkName} onChange={(e) => setEditDrinkName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2937] text-sm w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors" />
                  <div className="flex items-center gap-1 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-lg px-2 w-24 focus-within:ring-2 focus-within:ring-blue-500/50 transition-colors">
                    <span className="text-gray-500 text-sm">€</span>
                    <input type="number" step="0.10" value={editDrinkPrice} onChange={(e) => setEditDrinkPrice(e.target.value)} className="w-full py-1.5 bg-transparent text-sm focus:outline-none" />
                  </div>
                  <button onClick={() => handleUpdateDrink(drink.id)} className="p-2 text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg transition-colors"><span className="material-icons-round text-sm">check</span></button>
                  <button onClick={() => setEditingDrinkId(null)} className="p-2 text-gray-500 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-lg transition-colors"><span className="material-icons-round text-sm">close</span></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white truncate">{drink.name}</span>
                  <span className="text-sm font-medium bg-white dark:bg-gray-700 px-2 py-1 rounded-md shadow-sm border border-gray-100 dark:border-gray-600 transition-colors">€ {drink.price.toFixed(2)}</span>
                  <button onClick={() => { setEditingDrinkId(drink.id); setEditDrinkName(drink.name); setEditDrinkPrice(drink.price.toString()); }} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded-lg shadow-sm transition-colors"><span className="material-icons-round text-sm">edit</span></button>
                  <button onClick={() => handleDeleteDrink(drink.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg shadow-sm transition-colors"><span className="material-icons-round text-sm">delete</span></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

import React, { useState, useEffect } from 'react';

import { showToast } from '../../components/Toast';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { euro } from '../../lib/geld';

export const StrepenAdminPanel = ({ onDrinkDeleted }) => {
  const { dranken: drinks, setDrinks: onUpdateDrinks } = useDrink();

  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingDrinkId, setEditingDrinkId] = useState(null);
  const [editDrinkName, setEditDrinkName] = useState('');
  const [editDrinkPrice, setEditDrinkPrice] = useState('');

  useEffect(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setValidUntil(nextWeek.toISOString().split('T')[0]);
  }, []);

  const handleAddNewDrink = async e => {
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

  const handleUpdateDrink = async id => {
    try {
      const priceNum = parseFloat(editDrinkPrice.replace(',', '.'));
      if (isNaN(priceNum)) {
        showToast('Ongeldige prijs', 'error');
        return;
      }

      // Use service function
      await db.updateDrank(id, editDrinkName, priceNum);

      onUpdateDrinks(drinks.map(d => (d.id === id ? { ...d, name: editDrinkName, price: priceNum } : d)));
      setEditingDrinkId(null);
      showToast('Drank succesvol bewerkt', 'success');
    } catch (error) {
      console.error('Error updating drink:', error);
      showToast('Fout bij het updaten van de drank.', 'error');
    }
  };

  const handleDeleteDrink = async id => {
    if (
      !window.confirm(
        'Weet je zeker dat je deze drank wilt verwijderen? Het is veiliger om het gewoon niet meer te gebruiken, verwijderen kan kapotte facturen veroorzaken als de drank al gestreept is.',
      )
    )
      return;
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
    <section className="pb-4 text-inkt dark:text-white">

      <form
        onSubmit={handleAddNewDrink}
        className="bg-kaart-event dark:bg-kaart-event-d p-5 rounded-2xl space-y-4"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold">Nieuwe drank</h3>
          <div className="bg-white dark:bg-white/10 p-1 rounded-full flex text-xs font-bold">
            <button
              type="button"
              onClick={() => setIsTemporary(false)}
              className={`px-3 py-1 rounded-full transition-all ${!isTemporary ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'text-gray-500'}`}
            >
              Permanent
            </button>
            <button
              type="button"
              onClick={() => setIsTemporary(true)}
              className={`px-3 py-1 rounded-full transition-all ${isTemporary ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'text-gray-500'}`}
            >
              Tijdelijk
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Naam</label>
            <input
              type="text"
              placeholder="Naam (bv. Mojito)"
              value={newDrinkName}
              onChange={e => setNewDrinkName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Prijs</label>
            <input
              type="number"
              step="0.10"
              inputMode="decimal"
              placeholder="€"
              value={newDrinkPrice}
              onChange={e => setNewDrinkPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
            />
          </div>
        </div>

        {isTemporary && (
          <div className="animate-in fade-in duration-300">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Geldig tot</label>
            <input
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-inkt dark:bg-white text-white dark:text-inkt font-bold py-3 rounded-2xl active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span className="text-xs">Toevoegen...</span>
          ) : (
            <>
              <span className="material-icons-round text-sm">add</span>
              {isTemporary ? 'Tijdelijke drank toevoegen' : 'Drank toevoegen'}
            </>
          )}
        </button>
      </form>

      <div className="mt-4 bg-kaart-event dark:bg-kaart-event-d p-5 rounded-2xl">
        <h3 className="text-sm font-bold mb-4">Bestaande dranken</h3>
        <div className="space-y-2">
          {drinks.map(drink => (
            <div
              key={drink.id}
              className="flex items-center gap-2 p-3 bg-white dark:bg-white/10 rounded-xl"
            >
              {editingDrinkId === drink.id ? (
                <>
                  <input
                    type="text"
                    value={editDrinkName}
                    onChange={e => setEditDrinkName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/10 text-sm w-1/2 focus:outline-none focus:ring-2 focus:ring-inkt/20"
                  />
                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-white/10 rounded-lg px-2 w-24 focus-within:ring-2 focus-within:ring-inkt/20">
                    <span className="text-gray-500 text-sm">€</span>
                    <input
                      type="number"
                      step="0.10"
                      value={editDrinkPrice}
                      onChange={e => setEditDrinkPrice(e.target.value)}
                      className="w-full py-1.5 bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateDrink(drink.id)}
                    className="p-2 text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <span className="material-icons-round text-sm">check</span>
                  </button>
                  <button
                    onClick={() => setEditingDrinkId(null)}
                    className="p-2 text-gray-500 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-lg transition-colors"
                  >
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold truncate">{drink.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums px-1">
                    {euro(drink.price)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingDrinkId(drink.id);
                      setEditDrinkName(drink.name);
                      setEditDrinkPrice(drink.price.toString());
                    }}
                    aria-label="Aanpassen"
                    className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-lg"
                  >
                    <span className="material-icons-round text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDrink(drink.id)}
                    aria-label="Verwijderen"
                    className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 rounded-lg"
                  >
                    <span className="material-icons-round text-sm">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { FryItem } from '../../types';

interface FriesItemCardProps {
  item: FryItem;
  qty: number;
  isEditing: boolean;
  editPrice: string;
  setEditPrice: (val: string) => void;
  savePrice: (id: string) => void;
  cancelEdit: () => void;
  isAdmin: boolean;
  orderingFor: any;
  isOrderingOpen: boolean;
  favoriteItems: string[];
  toggleFavoriteItem: (id: string, e: React.MouseEvent) => void;
  startEditing: (item: FryItem) => void;
  handleDeleteFryItem: (id: string) => void;
  updateQuantity: (item: FryItem, delta: number) => void;
}

// Helper functie voor de styling per categorie
const getCategoryStyling = (category: string) => {
    switch (category.toLowerCase()) {
        case 'frieten':
            return { emoji: '🍟', color: 'bg-yellow-100 dark:bg-yellow-900/30' };
        case 'burgers':
            return { emoji: '🍔', color: 'bg-orange-100 dark:bg-orange-900/30' };
        case 'snacks':
            return { emoji: '🍢', color: 'bg-red-100 dark:bg-red-900/30' };
        case 'sauzen':
            return { emoji: '🪣', color: 'bg-blue-100 dark:bg-blue-900/30' };
        case 'huisbereid':
            return { emoji: '🧑‍🍳', color: 'bg-green-100 dark:bg-green-900/30' };
        case 'spaghetti':
            return { emoji: '🍝', color: 'bg-amber-100 dark:bg-amber-900/30' };
        case 'dranken':
            return { emoji: '🥤', color: 'bg-purple-100 dark:bg-purple-900/30' };
        default:
            return { emoji: '🍴', color: 'bg-gray-100 dark:bg-gray-800' };
    }
};

export const FriesItemCard: React.FC<FriesItemCardProps> = ({
  item, qty, isEditing, editPrice, setEditPrice, savePrice, cancelEdit, isAdmin, orderingFor, isOrderingOpen, favoriteItems, toggleFavoriteItem, startEditing, handleDeleteFryItem, updateQuantity
}) => {
  const catStyle = getCategoryStyling(item.category);
  const isFavorite = favoriteItems.includes(item.id);

  return (
    <div className={`bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-sm border transition-all ${qty > 0 ? 'border-blue-600 ring-1 ring-blue-600 dark:border-blue-500 dark:ring-blue-500' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="flex items-center justify-between gap-3">
        
        {/* LINKER KANT: Icoon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          
          {/* Categorie Icoon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catStyle.color}`}>
            <span className="text-2xl">{catStyle.emoji}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-lg truncate ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{item.name}</h3>
              
              {/* FAVORIETEN HARTJE - Altijd klikbaar */}
              <button
                onClick={(e) => toggleFavoriteItem(item.id, e)}
                className="p-1 -ml-1 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 active:scale-90"
                title="Favoriet maken"
              >
                <span className={`material-icons-round text-[22px] transition-colors ${isFavorite ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-red-400'}`}>
                  {isFavorite ? 'favorite' : 'favorite_border'}
                </span>
              </button>
            </div>
            {item.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic truncate">{item.description}</p>
            )}

            <div className="flex items-center mt-0.5">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">€</span>
                  <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-16 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-blue-500 rounded focus:outline-none dark:text-white" autoFocus />
                  <button onClick={() => savePrice(item.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><span className="material-icons-round text-sm">check</span></button>
                  <button onClick={cancelEdit} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"><span className="material-icons-round text-sm">close</span></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">€ {item.price.toFixed(2).replace('.', ',')}</p>
                  {isAdmin && !orderingFor && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditing(item)} className="text-gray-300 hover:text-blue-600 transition-colors"><span className="material-icons-round text-xs">edit</span></button>
                      <button onClick={() => { if (window.confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) { handleDeleteFryItem(item.id); } }} className="text-gray-300 hover:text-red-600 transition-colors"><span className="material-icons-round text-xs">delete</span></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RECHTER KANT: Knoppen (+ en -) */}
        <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-2 shrink-0 transition-all ${isAdmin || !isOrderingOpen ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <button onClick={() => updateQuantity(item, -1)} className={`w-8 h-8 flex items-center justify-center rounded-md shadow-sm active:scale-95 transition-all ${qty > 0 ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-gray-700 text-gray-400'}`}>
            <span className="material-icons-round text-sm">remove</span>
          </button>
          <span className={`font-bold w-5 text-center text-sm ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{qty}</span>
          <button onClick={() => updateQuantity(item, 1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white shadow-md active:scale-95 transition-all hover:bg-blue-700">
            <span className="material-icons-round text-sm">add</span>
          </button>
        </div>
        
      </div>
    </div>
  );
};

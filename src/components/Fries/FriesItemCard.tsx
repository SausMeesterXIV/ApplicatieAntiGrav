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

export const FriesItemCard: React.FC<FriesItemCardProps> = ({
  item, qty, isEditing, editPrice, setEditPrice, savePrice, cancelEdit, isAdmin, orderingFor, isOrderingOpen, favoriteItems, toggleFavoriteItem, startEditing, handleDeleteFryItem, updateQuantity
}) => {
  return (
    <div className={`bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-sm border transition-all ${qty > 0 ? 'border-blue-600 ring-1 ring-blue-600 dark:border-blue-500 dark:ring-blue-500' : 'border-gray-100 dark:border-gray-800'} ${!isOrderingOpen ? 'opacity-60 grayscale-[0.5]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-lg ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{item.name}</h3>
            <button
              onClick={(e) => toggleFavoriteItem(item.id, e)}
              className="p-1 -ml-1 flex items-center justify-center rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
              title="Favoriet maken"
            >
              <span className={`material-icons-round text-base transition-colors ${favoriteItems.includes(item.id) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-300'}`}>
                {favoriteItems.includes(item.id) ? 'star' : 'star_border'}
              </span>
            </button>
          </div>
          {item.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{item.description}</p>
          )}

          <div className="flex items-center mt-0.5">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">€</span>
                <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-20 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-blue-500 rounded focus:outline-none dark:text-white" autoFocus />
                <button onClick={() => savePrice(item.id)} className="p-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500 rounded hover:bg-green-200 transition-colors"><span className="material-icons-round text-sm">check</span></button>
                <button onClick={cancelEdit} className="p-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500 rounded hover:bg-red-200 transition-colors"><span className="material-icons-round text-sm">close</span></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-500 dark:text-gray-400 text-sm">€ {item.price.toFixed(2)}</p>
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

        <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-3 transition-colors ${isAdmin || !isOrderingOpen ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onClick={() => updateQuantity(item, -1)} className={`w-8 h-8 flex items-center justify-center rounded-md shadow-sm active:scale-95 transition-all ${qty > 0 ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-gray-700 text-gray-400'}`}>
            <span className="material-icons-round text-sm">remove</span>
          </button>
          <span className={`font-bold w-4 text-center ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>{qty}</span>
          <button onClick={() => updateQuantity(item, 1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white shadow-md active:scale-95 transition-all hover:bg-blue-700">
            <span className="material-icons-round text-sm">add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

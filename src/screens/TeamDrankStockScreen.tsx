import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StockItem, Drink } from '../types';
import { showToast } from '../components/Toast';
import { Modal, BottomSheet } from '../components/Modal';
import { SkeletonRow } from '../components/Skeleton';

export const TeamDrankStockScreen: React.FC = () => {
  const navigate = useNavigate();
    const { loading } = useAuth();
  const { stockItems, setStockItems: onUpdateStock, dranken : drinks, setDrinks: onUpdateDrinks } = useDrink();
  const [activeMainTab, setActiveMainTab] = useState<'voorraad' | 'dranken'>('voorraad');
  const [activeFilter, setActiveFilter] = useState('Standaard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrinkModalOpen, setIsDrinkModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'overview'>('list');

  // Form State Stock
  const [formData, setFormData] = useState({
    name: '',
    category: 'Standaard',
    count: '',
    unit: 'stuks',
    exp: '',
    icon: 'inventory_2'
  });

  // Form State Temporary Drink
  const [drinkFormData, setDrinkFormData] = useState({
    name: '',
    price: '',
    validUntil: ''
  });

  const filteredItems = (stockItems || []).filter(item => {
    const matchesFilter = item.category === activeFilter;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filters = ['Standaard', 'Evenementen', "Extra's"];

  const handleOpenModal = (item?: StockItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        count: item.count.toString(),
        unit: item.unit,
        exp: item.exp,
        icon: item.icon
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: activeFilter,
        count: '',
        unit: 'stuks',
        exp: '',
        icon: 'inventory_2'
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveStock = () => {
    if (!formData.name || !formData.count) return;

    if (editingItem) {
      onUpdateStock(stockItems.map(item => item.id === editingItem.id ? {
        ...item,
        ...formData,
        count: parseInt(formData.count) || 0
      } : item));
    } else {
      const newItem: StockItem = {
        id: Date.now(),
        name: formData.name,
        category: formData.category,
        count: parseInt(formData.count) || 0,
        unit: formData.unit,
        exp: formData.exp,
        icon: formData.icon,
        label: '',
        color: 'bg-blue-500' // Default color
      };
      onUpdateStock([newItem, ...stockItems]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteStock = () => {
    if (editingItem) {
      onUpdateStock(stockItems.filter(item => item.id !== editingItem.id));
      setIsModalOpen(false);
    }
  };

  const handleSaveDrink = () => {
    if (!drinkFormData.name || !drinkFormData.price) return;
    const newDrink: Drink = {
      id: Date.now().toString(),
      name: drinkFormData.name,
      price: parseFloat(drinkFormData.price.replace(',', '.')) || 0,
      isTemporary: true,
      validUntil: drinkFormData.validUntil || 'Einde periode',
      icon: 'local_bar'
    };
    if (onUpdateDrinks) {
      onUpdateDrinks([...drinks, newDrink]);
      showToast('Tijdelijke drank toegevoegd!', 'success');
      setIsDrinkModalOpen(false);
      setDrinkFormData({ name: '', price: '', validUntil: '' });
    }
  };

  // Prepare data for chart
  const chartData = (stockItems || []).map(item => ({
    name: (item.name || '').split(' ')[0], // Short name
    count: item.count || 0,
    full: item
  })).sort((a, b) => b.count - a.count).slice(0, 10); // Top 10

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200 relative">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold flex-1">Beheer</h1>

          {activeMainTab === 'voorraad' && (
            <button
              onClick={() => setViewMode(prev => prev === 'list' ? 'overview' : 'list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${viewMode === 'overview'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              <span className="material-icons-round text-sm">
                {viewMode === 'overview' ? 'list' : 'bar_chart'}
              </span>
              {viewMode === 'overview' ? 'Lijst' : 'Overzicht'}
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-4 mt-2 mb-2 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setActiveMainTab('voorraad')} className={`pb-2 text-sm font-bold transition-colors ${activeMainTab === 'voorraad' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Fysieke Voorraad</button>
          <button onClick={() => setActiveMainTab('dranken')} className={`pb-2 text-sm font-bold transition-colors ${activeMainTab === 'dranken' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Dranken & Prijzen</button>
        </div>

        {/* Search & Filter - Only show in List Mode */}
        {activeMainTab === 'voorraad' && viewMode === 'list' && (
          <div className="space-y-3 mt-4">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-3.5 text-gray-400">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoeken in voorraad..."
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {filters.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === filter
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white dark:bg-[#1e293b] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto pt-2">
        {activeMainTab === 'voorraad' ? (
          <>
            {viewMode === 'list' ? (
              <>
                <div className="flex justify-between items-end mb-3 px-1 mt-2">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {activeFilter} Voorraad
                  </h2>
                  <span className="text-xs text-gray-400">{filteredItems.length} resultaten</span>
                </div>

                <div className="space-y-3">
                  {loading ? (
                    <>
                      {[...Array(6)].map((_, i) => (
                        <SkeletonRow key={i} />
                      ))}
                    </>
                  ) : (
                    filteredItems.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenModal(item)}
                        className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex gap-4 group shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${item.id === 3 ? 'bg-yellow-100' : 'bg-gray-50 dark:bg-gray-800'} relative`}>
                          <span className={`material-icons-round text-2xl ${item.id === 3 ? 'text-yellow-600' : 'text-gray-400 dark:text-gray-500'}`}>{item.icon}</span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">{item.name}</h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                              {item.count} {item.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="material-icons-round text-[10px]">category</span> {item.category}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                            <span>Exp: {item.exp}</span>
                          </div>

                          <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: '60%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                    <div className="text-xs font-medium text-blue-100 uppercase tracking-wide">Totaal Items</div>
                  </div>
                  <div className="bg-green-500 text-white p-4 rounded-2xl shadow-lg shadow-green-500/20">
                    <div className="text-3xl font-bold mb-1">{stockItems.filter(i => i.count < 5).length}</div>
                    <div className="text-xs font-medium text-green-100 uppercase tracking-wide">Lage Voorraad</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Voorraad Top 10</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={'#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Dranken & Prijzen Tab */
          <div className="space-y-4 mt-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Levende Prijzen (wordt direct doorgerekend!)</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : (
              drinks.map((drink: Drink) => (
                <div key={drink.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl flex items-center justify-between border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                      {drink.name}
                      {drink.isTemporary && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full ml-2 lowercase">Tijdelijk</span>}
                    </h3>
                    {drink.validUntil && <p className="text-[10px] text-gray-500 mt-0.5">Vervalt na: <span className="font-semibold text-gray-700 dark:text-gray-300">{drink.validUntil}</span></p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 text-sm">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={drink.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (onUpdateDrinks) {
                            onUpdateDrinks(drinks.map(d => d.id === drink.id ? { ...d, price: val } : d));
                          }
                        }}
                        className="w-20 lg:w-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-6 pr-2 py-1.5 text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      />
                    </div>
                    {drink.isTemporary && (
                      <button
                        onClick={() => {
                          if (window.confirm('Tijdelijke drank verwijderen?')) {
                            onUpdateDrinks && onUpdateDrinks(drinks.filter(d => d.id !== drink.id));
                          }
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      >
                        <span className="material-icons-round text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            <button
              onClick={() => setIsDrinkModalOpen(true)}
              className="w-full py-4 mt-6 border-2 border-dashed border-blue-300 dark:border-blue-700/50 rounded-2xl text-blue-600 dark:text-blue-500 font-bold flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors active:scale-95"
            >
              <span className="material-icons-round">add_circle</span>
              Tijdelijke Drank Toevoegen
            </button>
          </div>
        )}
      </main>

      {/* Footer Button (Only for Voorraad) */}
      {activeMainTab === 'voorraad' && (
        <footer className="fixed bottom-nav-offset left-0 right-0 p-4 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-20 flex gap-3 transition-colors">
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span className="material-icons-round">add</span>
            Nieuw Stock Item
          </button>
        </footer>
      )}      {/* Add/Edit Modal VOORRAAD */}
      <BottomSheet 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Item Bewerken' : 'Nieuw Item'}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Naam</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="bv. Jupiler Bakken"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Aantal</label>
                <input
                  type="number"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Eenheid</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="flessen">flessen</option>
                  <option value="blikken">blikken</option>
                  <option value="bakken">bakken</option>
                  <option value="stuks">stuks</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Categorie</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {filters.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Vervaldatum</label>
              <input
                type="text"
                value={formData.exp}
                onChange={(e) => setFormData({ ...formData, exp: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="bv. 12/10/24"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            {editingItem && (
              <button
                onClick={handleDeleteStock}
                className="px-4 py-3.5 rounded-xl font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Verwijderen"
              >
                <span className="material-icons-round">delete_outline</span>
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveStock}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              Opslaan
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Add Modal TIJDELIJKE DRANK */}
      <Modal 
        isOpen={isDrinkModalOpen} 
        onClose={() => setIsDrinkModalOpen(false)} 
        title="Nieuwe Tijdelijke Drank"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Naam</label>
              <input
                type="text"
                value={drinkFormData.name}
                onChange={(e) => setDrinkFormData({ ...drinkFormData, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                placeholder="Bv. Rode Wodka Redbull"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Prijs (€)</label>
              <input
                type="number"
                step="0.10"
                value={drinkFormData.price}
                onChange={(e) => setDrinkFormData({ ...drinkFormData, price: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                placeholder="2.50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Geldigheid (Optioneel)</label>
              <input
                type="text"
                value={drinkFormData.validUntil}
                onChange={(e) => setDrinkFormData({ ...drinkFormData, validUntil: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                placeholder="Bv. Enkel vanavond"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsDrinkModalOpen(false)}
              className="flex-1 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveDrink}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              Toevoegen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
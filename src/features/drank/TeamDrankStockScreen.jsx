import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { showToast } from '../../components/Toast';
import { BottomSheet } from '../../components/Modal';
import { SkeletonRow } from '../../components/Skeleton';
import { VoorraadPerDrank } from './VoorraadPerDrank';
import { StrepenAdminPanel } from './StrepenAdminPanel';

export const TeamDrankStockScreen = () => {
  const navigate = useNavigate();
  const { loading } = useAuth();
  const { stockItems, setStockItems: onUpdateStock } = useDrink();
  const [activeMainTab, setActiveMainTab] = useState('voorraad');
  const [activeFilter, setActiveFilter] = useState('Standaard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  // Form State Stock
  const [formData, setFormData] = useState({
    name: '',
    category: 'Standaard',
    count: '',
    unit: 'stuks',
    exp: '',
    icon: 'inventory_2',
  });

  const filteredItems = (stockItems || []).filter(item => {
    const matchesFilter = item.category === activeFilter;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filters = ['Standaard', 'Evenementen', "Extra's"];

  const handleOpenModal = item => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category || 'Standaard',
        count: item.count.toString(),
        unit: item.unit || 'stuks',
        exp: item.exp || '',
        icon: item.icon || 'inventory_2',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: activeFilter,
        count: '',
        unit: 'stuks',
        exp: '',
        icon: 'inventory_2',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveStock = () => {
    if (!formData.name || !formData.count) return;

    if (editingItem) {
      onUpdateStock(
        stockItems.map(item =>
          item.id === editingItem.id
            ? {
                ...item,
                ...formData,
                count: parseInt(formData.count) || 0,
              }
            : item
        )
      );
    } else {
      const newItem = {
        id: Date.now().toString(),
        name: formData.name,
        category: formData.category,
        count: parseInt(formData.count) || 0,
        unit: formData.unit,
        exp: formData.exp,
        icon: formData.icon,
        label: null,
        color: 'bg-blue-500', // Default color
        urgent: false,
        created_at: new Date().toISOString(),
        expiry_date: formData.exp || null,
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


  // Prepare data for chart
  const chartData = (stockItems || [])
    .map(item => ({
      name: (item.name || '').split(' ')[0], // Short name
      count: item.count || 0,
      full: item,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200 relative">
      {/* Header */}
      <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold flex-1">Beheer</h1>

          {activeMainTab === 'voorraad' && (
            <button
              onClick={() => setViewMode(prev => (prev === 'list' ? 'overview' : 'list'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                viewMode === 'overview'
                  ? 'bg-inkt text-white dark:bg-white dark:text-inkt'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="material-icons-round text-sm">{viewMode === 'overview' ? 'list' : 'bar_chart'}</span>
              {viewMode === 'overview' ? 'Lijst' : 'Overzicht'}
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-4 mt-2 mb-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveMainTab('voorraad')}
            className={`pb-2 text-sm font-bold transition-colors ${activeMainTab === 'voorraad' ? 'text-inkt dark:text-white border-b-2 border-inkt dark:border-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Fysieke Voorraad
          </button>
          <button
            onClick={() => setActiveMainTab('dranken')}
            className={`pb-2 text-sm font-bold transition-colors ${activeMainTab === 'dranken' ? 'text-inkt dark:text-white border-b-2 border-inkt dark:border-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Dranken & Prijzen
          </button>
        </div>

        {/* Search & Filter - Only show in List Mode */}
        {activeMainTab === 'voorraad' && viewMode === 'list' && (
          <div className="space-y-3 mt-4">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-3.5 text-gray-400">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Zoeken in voorraad..."
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30 transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {filters.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    activeFilter === filter
                      ? 'bg-inkt text-white dark:bg-white dark:text-inkt'
                      : 'bg-kaart-event dark:bg-kaart-event-d text-gray-600 dark:text-gray-300'
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
            <VoorraadPerDrank />
            {viewMode === 'list' ? (
              <>
                <div className="flex justify-between items-end mb-3 px-1 mt-2">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{activeFilter} Voorraad</h2>
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
                        <div
                          className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${item.id === '3' ? 'bg-yellow-100' : 'bg-gray-50 dark:bg-gray-800'} relative`}
                        >
                          <span
                            className={`material-icons-round text-2xl ${item.id === '3' ? 'text-yellow-600' : 'text-gray-400 dark:text-gray-500'}`}
                          >
                            {item.icon}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">
                              {item.name}
                            </h3>
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
                            <div className="h-full rounded-full bg-inkt dark:bg-white" style={{ width: '60%' }}></div>
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
                  <div className="bg-kaart-strepen dark:bg-kaart-strepen-d text-inkt dark:text-white p-4 rounded-2xl">
                    <div className="text-3xl font-bold mb-1">{stockItems.length}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Totaal items</div>
                  </div>
                  <div className="bg-kaart-event dark:bg-kaart-event-d text-inkt dark:text-white p-4 rounded-2xl">
                    <div className="text-3xl font-bold mb-1">{stockItems.filter(i => i.count < 5).length}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Lage voorraad</div>
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
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                          itemStyle={{ color: '#fff' }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={'#64748b'} />
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
          /* Dranken & Prijzen: het echte beheer (bewaart in de database), zie StrepenAdminPanel */
          <div className="mt-4">
            <StrepenAdminPanel />
          </div>
        )}
      </main>
      {/* Footer Button (Only for Voorraad) */}
      {activeMainTab === 'voorraad' && (
        <footer className="fixed bottom-nav-offset left-0 right-0 lg:left-60 lg:mx-auto lg:max-w-3xl lg:rounded-2xl lg:border p-4 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-20 flex gap-3 transition-colors">
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 bg-inkt text-white dark:bg-white dark:text-inkt font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span className="material-icons-round">add</span>
            Nieuw Stock Item
          </button>
        </footer>
      )}{' '}
      {/* Add/Edit Modal VOORRAAD */}
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
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
                placeholder="bv. Jupiler Bakken"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Aantal
                </label>
                <input
                  type="number"
                  value={formData.count}
                  onChange={e => setFormData({ ...formData, count: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Eenheid
                </label>
                <select
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
                >
                  <option value="flessen">flessen</option>
                  <option value="blikken">blikken</option>
                  <option value="bakken">bakken</option>
                  <option value="stuks">stuks</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Categorie
              </label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
              >
                {filters.map(f => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Vervaldatum
              </label>
              <input
                type="text"
                value={formData.exp}
                onChange={e => setFormData({ ...formData, exp: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
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
              className="flex-1 py-3.5 rounded-xl font-bold bg-inkt text-white dark:bg-white dark:text-inkt transition-colors active:scale-[0.98]"
            >
              Opslaan
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

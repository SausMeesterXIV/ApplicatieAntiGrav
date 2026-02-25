import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StockItem } from '../types';
import { AppContextType } from '../App';

export const TeamDrankStockScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    stockItems,
    setStockItems: onUpdateStock
  } = useOutletContext<AppContextType>();
  const [activeFilter, setActiveFilter] = useState('Standaard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'overview'>('list');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Standaard',
    count: '',
    unit: 'stuks',
    exp: '',
    urgent: false,
    icon: 'inventory_2'
  });

  const filteredItems = stockItems.filter(item => {
    const matchesFilter = item.category === activeFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
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
        urgent: item.urgent,
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
        urgent: false,
        icon: 'inventory_2'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
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
        urgent: formData.urgent,
        icon: formData.icon,
        label: '',
        color: 'bg-blue-500' // Default color
      };
      onUpdateStock([newItem, ...stockItems]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (editingItem) {
      onUpdateStock(stockItems.filter(item => item.id !== editingItem.id));
      setIsModalOpen(false);
    }
  };

  // Prepare data for chart
  const chartData = stockItems.map(item => ({
    name: item.name.split(' ')[0], // Short name
    count: item.count,
    full: item
  })).sort((a, b) => b.count - a.count).slice(0, 10); // Top 10

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200 relative">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold flex-1">Voorraadbeheer</h1>

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
        </div>

        {/* Search & Filter - Only show in List Mode */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-3.5 text-gray-400">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoeken..."
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

      <main className="flex-1 px-4 pb-24 overflow-y-auto pt-2">

        {viewMode === 'list' ? (
          <>
            {/* List Header */}
            <div className="flex justify-between items-end mb-3 px-1">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {activeFilter} Voorraad
              </h2>
              <span className="text-xs text-gray-400">{filteredItems.length} resultaten</span>
            </div>

            {/* List Items */}
            <div className="space-y-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleOpenModal(item)}
                  className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex gap-4 group shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  {/* Icon Box */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${item.id === 3 ? 'bg-yellow-100' : 'bg-gray-50 dark:bg-gray-800'} relative`}>
                    <span className={`material-icons-round text-2xl ${item.id === 3 ? 'text-yellow-600' : 'text-gray-400 dark:text-gray-500'}`}>{item.icon}</span>
                    {item.urgent && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-[#1e293b]"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">{item.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.urgent ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
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

                    {/* Progress Bar (Visual Flair) */}
                    <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.urgent ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: item.urgent ? '15%' : '60%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                <div className="text-3xl font-bold mb-1">{stockItems.length}</div>
                <div className="text-xs font-medium text-blue-100 uppercase tracking-wide">Totaal Items</div>
              </div>
              <div className="bg-red-500 text-white p-4 rounded-2xl shadow-lg shadow-red-500/20">
                <div className="text-3xl font-bold mb-1">{stockItems.filter(i => i.urgent).length}</div>
                <div className="text-xs font-medium text-red-100 uppercase tracking-wide">Dringend</div>
              </div>
            </div>

            {/* Chart Section */}
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
                        <Cell key={`cell-${index}`} fill={entry.full.urgent ? '#ef4444' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Gedetailleerde Lijst</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400 font-bold">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3 text-right">Aantal</th>
                      <th className="px-4 py-3">Categorie</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stockItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">{item.count} <span className="text-[10px] text-gray-400 font-normal">{item.unit}</span></td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{item.category}</td>
                        <td className="px-4 py-3">
                          {item.urgent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              DRINGEND
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Button */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-20 flex gap-3 transition-colors">
        <button
          onClick={() => handleOpenModal()}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <span className="material-icons-round">add</span>
          Nieuw Item
        </button>
      </footer>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingItem ? 'Item Bewerken' : 'Nieuw Item'}
            </h3>

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

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={formData.urgent}
                  onChange={(e) => setFormData({ ...formData, urgent: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Markeren als dringend</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {editingItem && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-3 rounded-xl font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <span className="material-icons-round">delete</span>
                </button>
              )}
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
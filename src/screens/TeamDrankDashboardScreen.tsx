import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Drink } from '../types';
import { AppContextType } from '../App';

export const TeamDrankDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    stockItems,
    drinks,
    setDrinks: onUpdateDrinks
  } = useOutletContext<AppContextType>();
  const [excelLink, setExcelLink] = React.useState('');
  const [billingExcelLink, setBillingExcelLink] = React.useState('');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [tempLink, setTempLink] = React.useState('');
  const [tempBillingLink, setTempBillingLink] = React.useState('');

  // Local state for editing drink prices in the modal
  const [tempDrinks, setTempDrinks] = React.useState<Drink[]>([]);

  // Calculate low stock items (urgent or count < 5)
  const lowStockItems = stockItems.filter(item => item.urgent || item.count < 5);

  React.useEffect(() => {
    const savedLink = localStorage.getItem('teamDrankExcelLink');
    if (savedLink) {
      setExcelLink(savedLink);
      setTempLink(savedLink);
    }
    const savedBillingLink = localStorage.getItem('teamDrankBillingExcelLink');
    if (savedBillingLink) {
      setBillingExcelLink(savedBillingLink);
      setTempBillingLink(savedBillingLink);
    }
  }, []);

  // Initialize tempDrinks when modal opens
  React.useEffect(() => {
    if (isSettingsOpen) {
      setTempDrinks([...drinks]);
    }
  }, [isSettingsOpen, drinks]);

  const handleSaveLink = () => {
    localStorage.setItem('teamDrankExcelLink', tempLink);
    setExcelLink(tempLink);
    localStorage.setItem('teamDrankBillingExcelLink', tempBillingLink);
    setBillingExcelLink(tempBillingLink);

    // Save updated drink prices
    onUpdateDrinks(tempDrinks);

    setIsSettingsOpen(false);
  };

  const handleUpdateTempDrinkPrice = (id: string | number, price: string) => {
    const numericPrice = parseFloat(price.replace(',', '.')) || 0;
    setTempDrinks(prev => prev.map(d => d.id === id ? { ...d, price: numericPrice } : d));
  };

  // handleOpenExcel and data are unused in the current component return, 
  // keeping them disabled/removed or just ignoring the data warning if any.

  // Unused data array removed.

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200 relative">
      {/* Header */}
      <header className="px-4 py-6 flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Team Drank</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Dashboard & Statistieken</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 overflow-y-auto space-y-6">
        {/* Alerts Section */}
        {lowStockItems.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-2xl p-4 flex gap-4 items-start relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-500 shrink-0">
              <span className="material-icons-round">inventory_2</span>
            </div>
            <div>
              <h3 className="text-orange-800 dark:text-orange-400 font-bold text-sm mb-1">Lage Voorraad</h3>
              <p className="text-orange-700/80 dark:text-orange-300/70 text-xs leading-relaxed">
                {lowStockItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <span className="font-bold">{item.name}</span> ({item.count} {item.unit}){index < lowStockItems.length - 1 ? ', ' : '.'}
                  </React.Fragment>
                ))}
                <br />
                Bestel tijdig bij voor het weekend.
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 px-1">Snelkoppelingen</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('team-drank-invoices')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">receipt_long</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Facturen</span>
            </button>

            <button
              onClick={() => navigate('team-drank-stock')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">inventory_2</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Voorraad</span>
            </button>

            <button
              onClick={() => navigate('team-drank-billing')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">attach_money</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Drankrekeningen</span>
            </button>

            <button
              onClick={() => navigate('team-drank-excel-preview')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">table_view</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Excel Sheet</span>
            </button>

            <button
              onClick={() => navigate('team-drank-archive')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">history</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Archief</span>
            </button>

            <button
              onClick={() => navigate('team-drank-streaks')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">format_list_numbered</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Alle Strepen</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group col-span-2"
            >
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">settings</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Instellingen</span>
            </button>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[85vh] overflow-y-auto flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 shrink-0">Instellingen</h3>

            <div className="overflow-y-auto pr-1 custom-scrollbar">
              {/* Excel Link Section */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Link naar Voorraad Excel</label>
                <input
                  type="url"
                  value={tempLink}
                  onChange={(e) => setTempLink(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                />

                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Link naar Drankrekening Excel</label>
                <input
                  type="url"
                  value={tempBillingLink}
                  onChange={(e) => setTempBillingLink(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-2">
                  Plak hier de links naar de online Excel bestanden.
                </p>
              </div>

              {/* Prices & Financial Section */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Prijzen & Financieel</label>
                <div className="space-y-3">
                  {tempDrinks.map(drink => (
                    <div key={drink.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate pr-2">{drink.name}</span>
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-3 top-2.5 text-gray-500 text-xs">€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={drink.price}
                          onChange={(e) => handleUpdateTempDrinkPrice(drink.id, e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-6 pr-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset & Archive Section */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Reset & Archief</label>
                <div className="space-y-4">
                  <div>
                    <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-gray-400 group-hover:text-blue-500">inventory_2</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Periode Archiveren</span>
                      </div>
                      <span className="material-icons-round text-gray-400 text-sm">chevron_right</span>
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1.5 px-1 leading-relaxed">
                      Slaat de huidige tellingen en verbruik op in de historiek en zet de tellers op nul voor de nieuwe periode.
                    </p>
                  </div>

                  <div>
                    <button className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-left group">
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-red-400 group-hover:text-red-600">restart_alt</span>
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">Stock Resetten</span>
                      </div>
                      <span className="material-icons-round text-red-300 text-sm">warning</span>
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1.5 px-1 leading-relaxed">
                      Zet alle voorraadaantallen volledig op nul. Gebruik dit enkel na een grote fout of bij een volledige herstart.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto shrink-0">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveLink}
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
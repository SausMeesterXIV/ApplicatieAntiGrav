import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Drink } from '../types';
import { AppContextType } from '../App';
import { fetchAppSetting, saveAppSetting, updateBillingPeriod, updateGeschatteKost, archiveConsumptiesPeriod, fetchBillingPeriods, fetchOpenBillingPeriod } from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { supabase } from '../lib/supabase';

export const TeamDrankDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    stockItems,
    drinks,
    setDrinks: onUpdateDrinks,
    activePeriod,
    setActivePeriod,
    billingPeriods,
    setBillingPeriods,
    streaks
  } = useOutletContext<AppContextType>();
  const [excelLink, setExcelLink] = useState('');
  const [billingExcelLink, setBillingExcelLink] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempLink, setTempLink] = useState('');
  const [tempBillingLink, setTempBillingLink] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Local state for editing drink prices in the modal
  const [tempDrinks, setTempDrinks] = React.useState<Drink[]>([]);

  // Calculate low stock items (urgent or count < 5)
  const lowStockItems = (stockItems || []).filter(item => item.urgent || item.count < 5);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const link = await fetchAppSetting('teamDrankExcelLink');
        const billingLink = await fetchAppSetting('teamDrankBillingExcelLink');

        if (link) {
          setExcelLink(link);
          setTempLink(link);
        }
        if (billingLink) {
          setBillingExcelLink(billingLink);
          setTempBillingLink(billingLink);
        }
      } catch (err) {
        console.error("Failed to load settings from DB:", err);
      }
    };
    loadSettings();
  }, []);

  // Initialize tempDrinks when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempDrinks([...drinks]);
    }
  }, [isSettingsOpen, drinks]);

  const handleSaveLink = async () => {
    setIsLoadingSettings(true);
    try {
      await saveAppSetting('teamDrankExcelLink', tempLink);
      await saveAppSetting('teamDrankBillingExcelLink', tempBillingLink);

      setExcelLink(tempLink);
      setBillingExcelLink(tempBillingLink);

      // Save updated drink prices
      if (onUpdateDrinks) {
        onUpdateDrinks(tempDrinks);
      }

      showToast('Instellingen opgeslagen', 'success');
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Failed to save settings to DB:", err);
      showToast('Kon instellingen niet opslaan', 'error');
    } finally {
      setIsLoadingSettings(false);
    }
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

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6">
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
              onClick={() => navigate('/strepen/facturatie')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">receipt_long</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Facturen</span>
            </button>

            <button
              onClick={() => navigate('/strepen/voorraad')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">inventory_2</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Voorraad</span>
            </button>

            <button
              onClick={() => navigate('/strepen/facturatie/nieuw')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">attach_money</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Drankrekeningen</span>
            </button>

            <button
              onClick={() => navigate('/strepen/facturatie/excel')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">table_view</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Excel Sheet</span>
            </button>

            <button
              onClick={() => navigate('/strepen/geschiedenis-alle')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">history</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Alle gezette strepen</span>
            </button>

            <button
              onClick={() => navigate('/strepen/facturatie/archief')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">history</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Archief</span>
            </button>

            <button
              onClick={() => navigate('/strepen/streaks')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">format_list_numbered</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Alle Strepen</span>
            </button>

            <button
              onClick={() => navigate('/frituur/geschiedenis')}
              className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-icons-round">fastfood</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Frieten</span>
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

              {/* Period Management Section */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Huidige Periode Beheer</label>
                {activePeriod ? (
                  <div className="space-y-4">
                    {/* Period Name */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Naam huidige periode</label>
                      <input
                        type="text"
                        value={activePeriod.naam}
                        onChange={(e) => setActivePeriod({ ...activePeriod, naam: e.target.value })}
                        onBlur={async () => {
                          try {
                            await updateBillingPeriod(activePeriod.id, { naam: activePeriod.naam });
                          } catch (err) { console.error(err); }
                        }}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Geschatte Kost */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Factuurkosten Brouwer (€)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500 text-sm">€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={activePeriod.geschatte_kost || ''}
                          onChange={(e) => setActivePeriod({ ...activePeriod, geschatte_kost: parseFloat(e.target.value) || 0 })}
                          onBlur={async () => {
                            try {
                              await updateGeschatteKost(activePeriod.id, activePeriod.geschatte_kost);
                              showToast('Factuurkosten opgeslagen', 'success');
                            } catch (err) { showToast('Fout bij opslaan', 'error'); }
                          }}
                          placeholder="0.00"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-7 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Realtime Calculation */}
                    {(() => {
                      const periodStreaks = streaks.filter(s => s.period_id === activePeriod.id);
                      const totalStrepen = periodStreaks.reduce((sum, s) => sum + s.amount, 0);
                      const prijsPerStreep = totalStrepen > 0 ? activePeriod.geschatte_kost / totalStrepen : 0;
                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Totaal strepen deze periode</span>
                            <span className="font-bold text-gray-900 dark:text-white">{totalStrepen}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-500 dark:text-gray-400">Berekende prijs per streep</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {totalStrepen > 0 ? `€ ${prijsPerStreep.toFixed(2).replace('.', ',')}` : 'N.v.t. (0 strepen)'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Close Period Button */}
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Weet je zeker dat je "${activePeriod.naam}" wilt afsluiten? Dit maakt een nieuwe periode aan.`)) return;
                        try {
                          const result = await archiveConsumptiesPeriod();
                          showToast(`"${activePeriod.naam}" afgesloten! Nieuwe periode aangemaakt.`, 'success');
                          // Refresh periods
                          const [newOpen, allPeriods] = await Promise.all([
                            fetchOpenBillingPeriod(),
                            fetchBillingPeriods()
                          ]);
                          setActivePeriod(newOpen);
                          setBillingPeriods(allPeriods);
                        } catch (err: any) {
                          showToast('Fout bij afsluiten: ' + err.message, 'error');
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-red-400 group-hover:text-red-600">lock</span>
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">Periode Afsluiten</span>
                      </div>
                      <span className="material-icons-round text-red-300 text-sm">chevron_right</span>
                    </button>
                    <p className="text-[10px] text-gray-400 px-1 leading-relaxed">
                      Sluit de huidige periode af, koppelt alle losse strepen, en maakt automatisch een nieuwe periode aan.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    <p>Geen open periode gevonden.</p>
                    <button
                      onClick={async () => {
                        try {
                          const result = await archiveConsumptiesPeriod();
                          const [newOpen, allPeriods] = await Promise.all([
                            fetchOpenBillingPeriod(),
                            fetchBillingPeriods()
                          ]);
                          setActivePeriod(newOpen);
                          setBillingPeriods(allPeriods);
                          showToast('Nieuwe periode aangemaakt!', 'success');
                        } catch (err: any) {
                          showToast('Fout: ' + err.message, 'error');
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                    >
                      Nieuwe Periode Starten
                    </button>
                  </div>
                )}
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
                disabled={isLoadingSettings}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoadingSettings ? (
                  <span className="material-icons-round animate-spin">refresh</span>
                ) : (
                  'Opslaan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
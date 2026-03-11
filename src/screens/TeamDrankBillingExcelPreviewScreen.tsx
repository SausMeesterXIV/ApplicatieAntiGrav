import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { BillingCorrection } from '../types';
import * as db from '../lib/supabaseService';

export interface TeamDrankBillingExcelPreviewScreenProps {
   onBack?: () => void;
}

export const TeamDrankBillingExcelPreviewScreen: React.FC<TeamDrankBillingExcelPreviewScreenProps> = ({ onBack }) => {
   const navigate = useNavigate();
   const location = useLocation();
     const { users } = useAuth();
  const { dranken : drinks, streaks: allStreaks, billingPeriods, activePeriod } = useDrink();
   const [isGenerating, setIsGenerating] = useState(false);
   const [generated, setGenerated] = useState(false);
   const [corrections, setCorrections] = useState<BillingCorrection[]>([]);

   // Get periodId from URL query
   const queryParams = new URLSearchParams(location.search);
   const periodId = queryParams.get('periodId');

   // Auto-select period
   const selectedPeriod = useMemo(() => {
      if (periodId) return billingPeriods.find(p => p.id === periodId) || null;
      return activePeriod;
   }, [periodId, billingPeriods, activePeriod]);

   // Load corrections for the selected period
   useEffect(() => {
      if (!selectedPeriod) return;
      db.fetchBillingCorrections(selectedPeriod.id)
         .then(setCorrections)
         .catch(err => console.error(err));
   }, [selectedPeriod]);

   // Filter streaks for period
   const filteredStreaks = useMemo(() => {
      if (!selectedPeriod) return allStreaks;
      return allStreaks.filter(s => s.period_id === selectedPeriod.id);
   }, [allStreaks, selectedPeriod]);

   // Dynamic pricing
   const totalStrepen = useMemo(() => filteredStreaks.reduce((sum, s) => sum + s.amount, 0), [filteredStreaks]);
   const geschatteKost = selectedPeriod?.geschatte_kost || 0;
   const prijsPerStreep = totalStrepen > 0 ? geschatteKost / totalStrepen : 0;

   // Build billing data with dynamic pricing
   const billingData = useMemo(() => {
      return users.map(user => {
         const userStreaks = filteredStreaks.filter(s => s.userId === user.id);
         const userStrepen = userStreaks.reduce((sum, s) => sum + s.amount, 0);
         const berekendBedrag = Number((userStrepen * prijsPerStreep).toFixed(2));

         const userCorrections = corrections.filter(c => c.user_id === user.id);
         const totalCorrection = userCorrections.reduce((sum, c) => sum + c.correctie_bedrag, 0);

         const totaalSchuld = Number((berekendBedrag + totalCorrection).toFixed(2));

         // Detailed drink breakdown
         const drinkBreakdown: Record<string, number> = {};
         userStreaks.forEach(s => {
            drinkBreakdown[s.drinkName] = (drinkBreakdown[s.drinkName] || 0) + s.amount;
         });

         return {
            name: user.naam || user.name || 'Onbekend',
            userStrepen,
            berekendBedrag,
            totalCorrection,
            totaalSchuld,
            drinkBreakdown,
         };
      }).filter(u => u.userStrepen > 0 || u.totalCorrection !== 0)
         .sort((a, b) => b.totaalSchuld - a.totaalSchuld);
   }, [users, filteredStreaks, corrections, prijsPerStreep]);

   const totalOutstanding = billingData.reduce((sum, u) => sum + u.totaalSchuld, 0);

   const handleGenerateExcel = () => {
      setIsGenerating(true);

      setTimeout(() => {
         try {
            const wb = XLSX.utils.book_new();
            const periodName = selectedPeriod?.naam || 'Alle';
            const wekjaarStr = selectedPeriod?.werkjaar ? ` (${selectedPeriod.werkjaar})` : '';

            // === Sheet 1: Overview with dynamic pricing ===
            const headerRow = [{ v: `KSA Drankrekeningen — ${periodName}${wekjaarStr}`, t: 's' }, '', '', '', '', ''];
            const dateRow = [{ v: 'Gegenereerd op:', t: 's' }, { v: new Date().toLocaleDateString('nl-BE'), t: 's' }, '', '', '', ''];
            const kostRow = [
               { v: 'Factuurkosten:', t: 's' },
               { v: `€ ${geschatteKost.toFixed(2)}`, t: 's' },
               { v: 'Prijs/streep:', t: 's' },
               { v: prijsPerStreep > 0 ? `€ ${prijsPerStreep.toFixed(2)}` : 'N.v.t.', t: 's' },
               '', ''
            ];
            const spacerRow = ['', '', '', '', '', ''];
            const labelsRow = [
               { v: 'Naam', t: 's' },
               { v: 'Strepen', t: 's' },
               { v: 'Berekend (€)', t: 's' },
               { v: 'Correctie (€)', t: 's' },
               { v: 'Totaal (€)', t: 's' },
               { v: 'Status', t: 's' },
            ];

            const userRows = billingData.map(u => [
               { v: u.name, t: 's' },
               { v: u.userStrepen, t: 'n' },
               { v: u.berekendBedrag, t: 'n', z: '#,##0.00' },
               { v: u.totalCorrection, t: 'n', z: '#,##0.00' },
               { v: u.totaalSchuld, t: 'n', z: '#,##0.00' },
               { v: 'Onbetaald', t: 's' },
            ]);

            const footerRow = [
               { v: 'TOTAAL', t: 's' },
               { v: totalStrepen, t: 'n' },
               { v: billingData.reduce((s, u) => s + u.berekendBedrag, 0), t: 'n', z: '#,##0.00' },
               { v: billingData.reduce((s, u) => s + u.totalCorrection, 0), t: 'n', z: '#,##0.00' },
               { v: totalOutstanding, t: 'n', z: '#,##0.00' },
               '',
            ];

            const ws1Data = [headerRow, dateRow, kostRow, spacerRow, labelsRow, ...userRows, ['', '', '', '', '', ''], footerRow];
            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
            ws1['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(wb, ws1, 'Overzicht');

            // === Sheet 2: Detail per drank ===
            const drinkColumns = [...new Set(filteredStreaks.map(s => s.drinkName))].sort();
            const detailHeader = [
               { v: 'Naam', t: 's' },
               ...drinkColumns.map(d => ({ v: d, t: 's' })),
               { v: 'Correctie (€)', t: 's' },
               { v: 'TOTAAL (€)', t: 's' },
            ];

            const detailRows = billingData.map(u => {
               const drinkCounts = drinkColumns.map(dName => ({
                  v: u.drinkBreakdown[dName] || 0, t: 'n'
               }));
               return [
                  { v: u.name, t: 's' },
                  ...drinkCounts,
                  { v: u.totalCorrection, t: 'n', z: '#,##0.00' },
                  { v: u.totaalSchuld, t: 'n', z: '#,##0.00' },
               ];
            });

            const drinkTotals = drinkColumns.map(dName => ({
               v: billingData.reduce((sum, u) => sum + (u.drinkBreakdown[dName] || 0), 0), t: 'n'
            }));

            const detailFooterRow = [
               { v: 'TOTAAL', t: 's' },
               ...drinkTotals,
               { v: billingData.reduce((s, u) => s + u.totalCorrection, 0), t: 'n', z: '#,##0.00' },
               { v: totalOutstanding, t: 'n', z: '#,##0.00' },
            ];

            const ws2Data = [detailHeader, ...detailRows, detailFooterRow];
            const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
            ws2['!cols'] = [{ wch: 25 }, ...drinkColumns.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Detail per Drank');

            // Download
            const safeName = (selectedPeriod?.naam || 'Alle').replace(/[^a-zA-Z0-9]/g, '_');
            const safeYear = (selectedPeriod?.werkjaar || '').replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `KSA_Rekeningen_${safeName}${safeYear ? `_${safeYear}` : ''}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);

            setGenerated(true);
         } catch (error) {
            console.error('Excel generation error:', error);
            alert('Fout bij het genereren van het Excel bestand.');
         } finally {
            setIsGenerating(false);
         }
      }, 300);
   };

   return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white font-sans transition-colors duration-200">
         {/* Excel-like Header */}
         <header className="bg-[#1D6F42] text-white px-4 py-3 shadow-md z-10">
            <div className="flex items-center gap-4">
               <button onClick={onBack || (() => navigate(-1))} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <span className="material-icons-round text-xl">arrow_back</span>
               </button>
               <div className="flex items-center gap-2 flex-1">
                  <span className="material-icons-round">table_view</span>
                  <div>
                     <h1 className="font-bold text-lg leading-tight">Excel Drankrekeningen</h1>
                     {selectedPeriod && (
                        <p className="text-[10px] text-green-200 leading-tight">
                           {selectedPeriod.naam} {selectedPeriod.werkjaar ? `(${selectedPeriod.werkjaar})` : ''}
                        </p>
                     )}
                  </div>
               </div>
            </div>
         </header>

         <main className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-[#0f172a]">
            {/* Period Info */}
            {selectedPeriod && (
               <div className="bg-green-50 dark:bg-green-900/10 border-b border-green-200 dark:border-green-800 px-4 py-2 text-xs flex justify-between">
                  <span className="text-gray-500">Factuurkosten: <strong className="text-gray-900 dark:text-white">€ {geschatteKost.toFixed(2).replace('.', ',')}</strong></span>
                  <span className="text-gray-500">Prijs/streep: <strong className="text-green-700 dark:text-green-400">{prijsPerStreep > 0 ? `€ ${prijsPerStreep.toFixed(2).replace('.', ',')}` : 'N.v.t.'}</strong></span>
               </div>
            )}

            {/* Preview Table */}
            <div className="absolute inset-0 overflow-auto" style={{ top: selectedPeriod ? '2rem' : 0 }}>
               <table className="w-full border-collapse text-xs">
                  <thead>
                     <tr>
                        <th className="w-8 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1"></th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-400">Naam</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Strepen</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Berekend</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Correctie</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Totaal</th>
                     </tr>
                  </thead>
                  <tbody>
                     {billingData.length > 0 ? (
                        billingData.map((user, i) => (
                           <tr key={i}>
                              <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-center text-gray-500">{i + 1}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 font-medium">{user.name}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">{user.userStrepen}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">€ {user.berekendBedrag.toFixed(2).replace('.', ',')}</td>
                              <td className={`bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right ${user.totalCorrection !== 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
                                 {user.totalCorrection !== 0 ? `€ ${user.totalCorrection.toFixed(2).replace('.', ',')}` : '—'}
                              </td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right font-bold">€ {user.totaalSchuld.toFixed(2).replace('.', ',')}</td>
                           </tr>
                        ))
                     ) : (
                        <tr>
                           <td colSpan={6} className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-gray-400">
                              Geen consumpties gevonden voor deze periode
                           </td>
                        </tr>
                     )}
                     {billingData.length > 0 && (
                        <tr className="font-bold">
                           <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"></td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1">TOTAAL</td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">{totalStrepen}</td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">
                              € {billingData.reduce((s, u) => s + u.berekendBedrag, 0).toFixed(2).replace('.', ',')}
                           </td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right text-orange-600">
                              € {billingData.reduce((s, u) => s + u.totalCorrection, 0).toFixed(2).replace('.', ',')}
                           </td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right text-green-700 dark:text-green-400">
                              € {totalOutstanding.toFixed(2).replace('.', ',')}
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>

            {/* Download Card Overlay */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6 z-10">
               <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl p-5 max-w-sm w-full border border-gray-200 dark:border-gray-700">
                  {generated ? (
                     <div className="text-center">
                        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                           <span className="material-icons-round text-3xl text-green-600 dark:text-green-400">check_circle</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Excel gedownload!</h3>
                        <p className="text-xs text-gray-500 mb-4">2 sheets: Overzicht + Detail per Drank</p>
                        <div className="flex gap-2">
                           <button onClick={handleGenerateExcel} className="flex-1 py-2.5 bg-[#1D6F42] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5">
                              <span className="material-icons-round text-sm">refresh</span>
                              Opnieuw
                           </button>
                           <button onClick={onBack || (() => navigate(-1))} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm">
                              Terug
                           </button>
                        </div>
                     </div>
                  ) : (
                     <div className="text-center">
                        <div className="flex items-center justify-center gap-3 mb-3">
                           <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                              <span className="material-icons-round text-xl text-green-600 dark:text-green-400">download</span>
                           </div>
                           <div className="text-left">
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Exporteer Rekeningen</h3>
                              <p className="text-[10px] text-gray-500">{billingData.length} leden • € {totalOutstanding.toFixed(2).replace('.', ',')} totaal</p>
                           </div>
                        </div>
                        <button
                           onClick={handleGenerateExcel}
                           disabled={isGenerating || billingData.length === 0}
                           className="w-full py-3 bg-[#1D6F42] hover:bg-[#155230] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                           {isGenerating ? (
                              <>
                                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                 <span>Genereren...</span>
                              </>
                           ) : (
                              <>
                                 <span className="material-icons-round text-sm">table_view</span>
                                 <span>Download .xlsx</span>
                              </>
                           )}
                        </button>
                     </div>
                  )}
               </div>
            </div>
         </main>
      </div>
   );
};

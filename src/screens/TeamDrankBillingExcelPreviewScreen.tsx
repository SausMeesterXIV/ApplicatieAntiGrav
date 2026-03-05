import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { AppContextType } from '../App';

export interface TeamDrankBillingExcelPreviewScreenProps {
   onBack?: () => void;
}

export const TeamDrankBillingExcelPreviewScreen: React.FC<TeamDrankBillingExcelPreviewScreenProps> = ({ onBack }) => {
   const navigate = useNavigate();
   const { users, drinks, streaks, balance } = useOutletContext<AppContextType>();
   const [isGenerating, setIsGenerating] = useState(false);
   const [generated, setGenerated] = useState(false);

   // Build billing data from real Supabase data
   const billingData = useMemo(() => {
      // Group consumptions by user
      const userConsumptions: Record<string, { drinkName: string; count: number; unitPrice: number }[]> = {};

      streaks.forEach(streak => {
         if (!userConsumptions[streak.userId]) {
            userConsumptions[streak.userId] = [];
         }
         const existing = userConsumptions[streak.userId].find(c => c.drinkName === streak.drinkName);
         if (existing) {
            existing.count += 1;
         } else {
            const drink = drinks.find(d => d.name === streak.drinkName);
            userConsumptions[streak.userId].push({
               drinkName: streak.drinkName,
               count: 1,
               unitPrice: drink?.price || streak.price,
            });
         }
      });

      // Build rows per user
      return users.map(user => {
         const consumptions = userConsumptions[user.id] || [];
         const totalAmount = consumptions.reduce((sum, c) => sum + (c.count * c.unitPrice), 0);
         return {
            name: user.naam || user.name || 'Onbekend',
            consumptions,
            totalAmount,
         };
      }).filter(u => u.totalAmount > 0) // Only users with consumptions
         .sort((a, b) => b.totalAmount - a.totalAmount); // Highest debt first
   }, [users, drinks, streaks]);

   const totalOutstanding = billingData.reduce((sum, u) => sum + u.totalAmount, 0);

   const handleGenerateExcel = () => {
      setIsGenerating(true);

      setTimeout(() => {
         try {
            // Create workbook
            const wb = XLSX.utils.book_new();

            // === Sheet 1: Overview ===
            const headerRow = [{ v: 'KSA Drankrekeningen', t: 's' }, '', '', ''];
            const dateRow = [{ v: 'Gegenereerd op:', t: 's' }, { v: new Date().toLocaleDateString('nl-BE'), t: 's' }, '', ''];
            const spacerRow = ['', '', '', ''];
            const labelsRow = [
               { v: 'Naam', t: 's' },
               { v: 'Totaal Strepen', t: 's' },
               { v: 'Totaal Bedrag (€)', t: 's' },
               { v: 'Status', t: 's' }
            ];

            const userRows = billingData.map(u => [
               { v: u.name, t: 's' },
               { v: u.consumptions.reduce((s, c) => s + c.count, 0), t: 'n' },
               { v: u.totalAmount, t: 'n', z: '#,##0.00" €"' },
               { v: 'Onbetaald', t: 's' },
            ]);

            const totalStrepen = billingData.reduce((s, u) => s + u.consumptions.reduce((ss, c) => ss + c.count, 0), 0);

            const footerRow = [
               { v: 'TOTAAL', t: 's' },
               { v: totalStrepen, t: 'n' },
               { v: totalOutstanding, t: 'n', z: '#,##0.00" €"' },
               ''
            ];

            const ws1Data = [
               headerRow,
               dateRow,
               spacerRow,
               labelsRow,
               ...userRows,
               ['', '', '', ''],
               footerRow
            ];

            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
            // Set column widths
            ws1['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 12 }];
            // Freeze top rows
            ws1['!freeze'] = { xSplit: 0, ySplit: 4 };
            XLSX.utils.book_append_sheet(wb, ws1, 'Overzicht');

            // === Sheet 2: Detail per drank ===
            const drinkColumns = [...new Set(streaks.map(s => s.drinkName))].sort();
            const detailHeader = [
               { v: 'Naam', t: 's' },
               ...drinkColumns.map(d => ({ v: d, t: 's' })),
               { v: 'TOTAAL (€)', t: 's' }
            ];

            const detailRows = billingData.map(u => {
               const drinkCounts = drinkColumns.map(dName => {
                  const c = u.consumptions.find(cc => cc.drinkName === dName);
                  return { v: c ? c.count : 0, t: 'n' };
               });
               return [
                  { v: u.name, t: 's' },
                  ...drinkCounts,
                  { v: u.totalAmount, t: 'n', z: '#,##0.00" €"' }
               ];
            });

            // Totals row
            const drinkTotals = drinkColumns.map(dName => {
               const total = billingData.reduce((sum, u) => {
                  const c = u.consumptions.find(cc => cc.drinkName === dName);
                  return sum + (c ? c.count : 0);
               }, 0);
               return { v: total, t: 'n' };
            });

            const detailFooterRow = [
               { v: 'TOTAAL', t: 's' },
               ...drinkTotals,
               { v: totalOutstanding, t: 'n', z: '#,##0.00" €"' }
            ];

            const ws2Data = [detailHeader, ...detailRows, detailFooterRow];
            const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

            ws2['!cols'] = [{ wch: 25 }, ...drinkColumns.map(() => ({ wch: 12 })), { wch: 15 }];
            // Freeze header row
            ws2['!freeze'] = { xSplit: 0, ySplit: 1 };

            XLSX.utils.book_append_sheet(wb, ws2, 'Detail per Drank');

            // Download
            XLSX.writeFile(wb, `KSA_Drankrekeningen_${new Date().toISOString().split('T')[0]}.xlsx`);

            setGenerated(true);
         } catch (error) {
            console.error('Excel generation error:', error);
            alert('Fout bij het genereren van het Excel bestand.');
         } finally {
            setIsGenerating(false);
         }
      }, 300); // Small delay for UI feedback
   };

   return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white font-sans transition-colors duration-200">
         {/* Excel-like Header */}
         <header className="bg-[#1D6F42] text-white px-4 py-3 shadow-md z-10">
            <div className="flex items-center gap-4">
               <button onClick={onBack || (() => navigate(-1))} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <span className="material-icons-round text-xl">arrow_back</span>
               </button>
               <div className="flex items-center gap-2">
                  <span className="material-icons-round">table_view</span>
                  <h1 className="font-bold text-lg">Excel Drankrekeningen</h1>
               </div>
            </div>
         </header>

         <main className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-[#0f172a]">
            {/* Preview Table */}
            <div className="absolute inset-0 overflow-auto">
               <table className="w-full border-collapse text-xs">
                  <thead>
                     <tr>
                        <th className="w-8 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1"></th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-400">Naam</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Strepen</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Bedrag</th>
                     </tr>
                  </thead>
                  <tbody>
                     {billingData.length > 0 ? (
                        billingData.map((user, i) => (
                           <tr key={i}>
                              <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-center text-gray-500">{i + 1}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 font-medium">{user.name}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">{user.consumptions.reduce((s, c) => s + c.count, 0)}</td>
                              <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right font-bold">€ {user.totalAmount.toFixed(2).replace('.', ',')}</td>
                           </tr>
                        ))
                     ) : (
                        <tr>
                           <td colSpan={4} className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-gray-400">
                              Geen consumpties gevonden
                           </td>
                        </tr>
                     )}
                     {billingData.length > 0 && (
                        <tr className="font-bold">
                           <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"></td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1">TOTAAL</td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">
                              {billingData.reduce((s, u) => s + u.consumptions.reduce((ss, c) => ss + c.count, 0), 0)}
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

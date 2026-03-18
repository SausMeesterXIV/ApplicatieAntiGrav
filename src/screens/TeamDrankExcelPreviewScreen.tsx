import React, { useState } from 'react';
import { useDrink } from '../contexts/DrinkContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';

export const TeamDrankExcelPreviewScreen: React.FC = () => {
   const navigate = useNavigate();
     const { stockItems, dranken : drinks } = useDrink();
   const [isGenerating, setIsGenerating] = useState(false);
   const [generated, setGenerated] = useState(false);

   const getPriceForStockItem = (itemName: string) => {
      const drink = drinks.find(d => d.name.toLowerCase() === itemName.toLowerCase() || d.name.toLowerCase().includes(itemName.toLowerCase()) || itemName.toLowerCase().includes(d.name.toLowerCase()));
      return drink ? drink.price : 0;
   };

   const handleGenerateExcel = () => {
      setIsGenerating(true);

      setTimeout(() => {
         try {
            // Create workbook
            const wb = XLSX.utils.book_new();

            // === Sheet 1: Stock Overview ===
            // Using Cell Objects instead of just values to allow for formatting
            const headerRow = [
               { v: 'KSA Drankvoorraad', t: 's' }, '', '', ''
            ];
            const dateRow = [
               { v: 'Gegenereerd op:', t: 's' }, { v: new Date().toLocaleDateString('nl-BE'), t: 's' }, '', ''
            ];
            const spacerRow = ['', '', '', ''];

            const labelsRow = [
               { v: 'Drank', t: 's' },
               { v: 'Categorie', t: 's' },
               { v: 'Huidige Voorraad', t: 's' },
               { v: 'Waarde per stuk (€)', t: 's' },
               { v: 'Totale Waarde (€)', t: 's' }
            ];

            const stockRows = stockItems.map(item => {
               // Prefer matching by ID if available (from drinks data)
               const drink = drinks.find(d =>
                  String(d.id) === String(item.id) ||
                  d.name.toLowerCase() === item.name.toLowerCase()
               );
               const unitPrice = drink ? drink.price : 0;
               const totalPrice = item.count * unitPrice;

               return [
                  { v: item.name, t: 's' },
                  { v: item.category || 'Algemeen', t: 's' },
                  { v: item.count, t: 'n' }, // 'n' for number
                  { v: unitPrice, t: 'n', z: '#,##0.00" €"' }, // 'z' for number format
                  { v: totalPrice, t: 'n', z: '#,##0.00" €"' }
               ];
            });

            const totalStockValue = stockItems.reduce((sum, item) => {
               const drink = drinks.find(d => String(d.id) === String(item.id) || d.name.toLowerCase() === item.name.toLowerCase());
               return sum + (item.count * (drink?.price || 0));
            }, 0);

            const footerRow = [
               { v: 'TOTAAL WAARDE', t: 's' }, '', '', '',
               { v: totalStockValue, t: 'n', z: '#,##0.00" €"' }
            ];

            const ws1Data = [
               headerRow,
               dateRow,
               spacerRow,
               labelsRow,
               ...stockRows,
               ['', '', '', '', ''],
               footerRow
            ];

            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

            // Set column widths
            ws1['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

            // Freeze top rows (header up to labels)
            ws1['!freeze'] = { xSplit: 0, ySplit: 4 };

            XLSX.utils.book_append_sheet(wb, ws1, 'Voorraad');

            // Download
            XLSX.writeFile(wb, `KSA_Voorraad_${new Date().toISOString().split('T')[0]}.xlsx`);

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
         <header className="bg-[#1D6F42] text-white px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-3 shadow-md z-10">
            <div className="flex items-center gap-4">
               <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <span className="material-icons-round text-xl">arrow_back</span>
               </button>
               <div className="flex items-center gap-2">
                  <span className="material-icons-round">table_view</span>
                  <h1 className="font-bold text-lg">Excel Voorraad</h1>
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
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-400">Drank</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Categorie</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Voorraad</th>
                        <th className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Actuele Waarde</th>
                     </tr>
                  </thead>
                  <tbody>
                     {stockItems.length > 0 ? (
                        stockItems.map((item, i) => {
                           const p = getPriceForStockItem(item.name);
                           return (
                              <tr key={i}>
                                 <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-center text-gray-500">{i + 1}</td>
                                 <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 font-medium">{item.name}</td>
                                 <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">{item.category || 'Algemeen'}</td>
                                 <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">{item.count}</td>
                                 <td className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-2 py-1 text-right font-bold">€ {(item.count * p).toFixed(2).replace('.', ',')}</td>
                              </tr>
                           );
                        })
                     ) : (
                        <tr>
                           <td colSpan={5} className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-gray-400">
                              Geen voorraad gevonden.
                           </td>
                        </tr>
                     )}
                     {stockItems.length > 0 && (
                        <tr className="font-bold">
                           <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"></td>
                           <td colSpan={3} className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right">TOTAAL WAARDE</td>
                           <td className="bg-yellow-50 dark:bg-yellow-900/20 border border-gray-300 dark:border-gray-700 px-2 py-1 text-right text-green-700 dark:text-green-400">
                              € {stockItems.reduce((sum, item) => sum + (item.count * getPriceForStockItem(item.name)), 0).toFixed(2).replace('.', ',')}
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
                        <p className="text-xs text-gray-500 mb-4">Waarde berekening toegevoegd.</p>
                        <div className="flex gap-2">
                           <button onClick={handleGenerateExcel} className="flex-1 py-2.5 bg-[#1D6F42] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5">
                              <span className="material-icons-round text-sm">refresh</span>
                              Opnieuw
                           </button>
                           <button onClick={() => navigate(-1)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm">
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
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Exporteer Voorraad</h3>
                              <p className="text-[10px] text-gray-500">{stockItems.length} producten in de frigo</p>
                           </div>
                        </div>
                        <button
                           onClick={handleGenerateExcel}
                           disabled={isGenerating || stockItems.length === 0}
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

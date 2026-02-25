import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const TeamDrankExcelPreviewScreen: React.FC = () => {
   const navigate = useNavigate();
   const [excelLink, setExcelLink] = useState('');

   useEffect(() => {
      const savedLink = localStorage.getItem('teamDrankExcelLink');
      if (savedLink) {
         setExcelLink(savedLink);
      }
   }, []);

   const handleOpenRealExcel = () => {
      if (excelLink) {
         window.open(excelLink, '_blank');
      } else {
         alert('Geen link ingesteld. Ga naar instellingen.');
      }
   };

   // Generate some dummy grid data for visual flair
   const rows = Array.from({ length: 15 }, (_, i) => i + 1);
   const cols = ['A', 'B', 'C', 'D', 'E'];

   return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white font-sans transition-colors duration-200">
         {/* Excel-like Header */}
         <header className="bg-[#1D6F42] text-white px-4 py-3 shadow-md z-10">
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

         {/* Excel-like Toolbar */}
         <div className="bg-[#f3f2f1] dark:bg-[#0f172a] border-b border-gray-300 dark:border-gray-700 px-2 py-2 flex gap-4 overflow-x-auto">
            <div className="flex gap-1 border-r border-gray-300 dark:border-gray-700 pr-4">
               <div className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center rounded text-xs">
                  <span className="material-icons-round text-sm">save</span>
               </div>
               <div className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center rounded text-xs">
                  <span className="material-icons-round text-sm">undo</span>
               </div>
            </div>
            <div className="flex gap-2 items-center">
               <span className="font-sans text-xs font-bold text-gray-600 dark:text-gray-300">Arial</span>
               <span className="font-sans text-xs text-gray-600 dark:text-gray-300">11</span>
               <div className="flex gap-1">
                  <span className="font-bold text-gray-700 dark:text-gray-300 px-1">B</span>
                  <span className="italic text-gray-700 dark:text-gray-300 px-1">I</span>
                  <span className="underline text-gray-700 dark:text-gray-300 px-1">U</span>
               </div>
            </div>
         </div>

         {/* Formula Bar */}
         <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-[#1e293b] border-b border-gray-300 dark:border-gray-700">
            <div className="w-8 text-center text-xs text-gray-500 border-r border-gray-300 dark:border-gray-700">A1</div>
            <div className="flex-1 text-xs text-gray-400 italic px-2">fx =SUM(B2:B10)</div>
         </div>

         <main className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-[#0f172a]">
            {/* Background Grid (Visual Only) */}
            <div className="absolute inset-0 overflow-auto opacity-50 pointer-events-none">
               <table className="w-full border-collapse">
                  <thead>
                     <tr>
                        <th className="w-8 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"></th>
                        {cols.map(col => (
                           <th key={col} className="w-24 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-normal text-gray-600 dark:text-gray-400 py-1">{col}</th>
                        ))}
                     </tr>
                  </thead>
                  <tbody>
                     {rows.map(row => (
                        <tr key={row}>
                           <td className="bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500">{row}</td>
                           {cols.map(col => (
                              <td key={`${col}${row}`} className="bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 h-6"></td>
                           ))}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Overlay Card */}
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/5 backdrop-blur-[1px]">
               <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                     <span className="material-icons-round text-3xl text-green-600 dark:text-green-400">table_view</span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Excel Bestand Openen</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                     Je wordt nu doorgestuurd naar het externe Excel bestand voor gedetailleerd voorraadbeheer.
                  </p>

                  <div className="space-y-3">
                     <button
                        onClick={handleOpenRealExcel}
                        className="w-full py-3 bg-[#1D6F42] hover:bg-[#155230] text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                     >
                        <span>Open in Excel / Sheets</span>
                        <span className="material-icons-round text-sm">open_in_new</span>
                     </button>
                     <button
                        onClick={() => navigate(-1)}
                        className="w-full py-3 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
                     >
                        Annuleren
                     </button>
                  </div>
               </div>
            </div>
         </main>
      </div>
   );
};

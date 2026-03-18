import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

export const TeamDrankInvoicesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vergelijking' | 'facturen'>('vergelijking');
  const [isUploading, setIsUploading] = useState(false);

  const handleTakeReceiptPhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt
      });

      if (image.base64String) {
        uploadToSupabase(image.base64String, image.format);
      }
    } catch (error) {
      console.log('Camera geannuleerd of fout:', error);
    }
  };

  const uploadToSupabase = async (base64Data: string, format: string = 'jpeg') => {
    setIsUploading(true);
    try {
      const fileExt = format;
      const fileName = `bonnetje_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const fetchResponse = await fetch(`data:image/${format};base64,${base64Data}`);
      const blob = await fetchResponse.blob();

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, blob, {
          contentType: `image/${format}`,
          upsert: false
        });

      if (uploadError) throw uploadError;

      showToast('Bonnetje succesvol bewaard in het archief!', 'success');
    } catch (error: any) {
      showToast('Upload mislukt: ' + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { error } = await supabase.storage.from('invoices').upload(`pdf_${Date.now()}_${file.name}`, file);
      if (error) throw error;
      showToast('Document geüpload!', 'success');
    } catch (e) {
      showToast('Fout tijdens uploaden', 'error');
    }
    setIsUploading(false);
  }

  // Mock data for comparison logic
  const comparisonData = [
    { id: '1', name: 'Stella Artois', consumed: 124, purchased: 144, unit: 'flesjes' },
    { id: '2', name: 'Cola / Fanta / Water', consumed: 86, purchased: 72, unit: 'blikjes' },
    { id: '3', name: 'Zware Bieren (Duvel/Karmeliet)', consumed: 42, purchased: 48, unit: 'flesjes' },
    { id: '4', name: 'Chips & Snacks', consumed: 15, purchased: 20, unit: 'zakjes' },
  ];

  const invoices = [
    { id: '1', supplier: 'Colruyt Aalst', date: '12 Okt 2026', amount: 342.50 },
    { id: '2', supplier: 'Brouwerij De Brabandere', date: '05 Okt 2026', amount: 840.00 },
    { id: '3', supplier: 'Sligro', date: '28 Sept 2026', amount: 156.20 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200/50 dark:border-gray-800/50 transition-colors">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-tight">Facturen & Controle</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Periode: Sept - Okt</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/strepen/facturatie/periodes')}
              className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-blue-600"
              title="Periodebeheer"
            >
              <span className="material-icons-round">event_note</span>
            </button>
            <button
              onClick={() => navigate('/strepen/facturatie/nieuw')}
              className="bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-600/30"
            >
              Periode sluiten
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
          <button
            onClick={() => setActiveTab('vergelijking')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'vergelijking' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Controle
          </button>
          <button
            onClick={() => setActiveTab('facturen')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'facturen' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Facturen
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe overflow-y-auto">

        {activeTab === 'vergelijking' ? (
          <div className="space-y-6">
            {/* Period Summary Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-900 dark:to-slate-900 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-500/30 shadow-lg text-white">
              <h2 className="text-sm font-bold text-indigo-100 dark:text-indigo-200 uppercase tracking-wide mb-4">Periode Overzicht</h2>
              <div className="flex justify-between items-center relative">
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-white">1.338,70</div>
                  <div className="text-[10px] text-indigo-100 dark:text-indigo-300 uppercase">Ingekocht</div>
                </div>
                <div className="w-px h-10 bg-indigo-300 dark:bg-indigo-500/30"></div>
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-white">1.210,00</div>
                  <div className="text-[10px] text-indigo-100 dark:text-indigo-300 uppercase">Gestreept</div>
                </div>
                <div className="w-px h-10 bg-indigo-300 dark:bg-indigo-500/30"></div>
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-white">-128,70</div>
                  <div className="text-[10px] text-indigo-100 dark:text-indigo-300 uppercase">Verschil</div>
                </div>
              </div>
              <div className="mt-4 bg-white/10 dark:bg-indigo-950/50 rounded-lg p-3 border border-white/20 dark:border-indigo-500/20 text-xs text-indigo-50 dark:text-indigo-200 flex items-start gap-2">
                <span className="material-icons-round text-sm mt-0.5">info</span>
                <span>Selecteer een periode om de vergelijking tussen inkoop en verbruik te zien.</span>
              </div>
            </div>

            {/* Detailed List */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Details per categorie</h3>
              <div className="space-y-3">
                {comparisonData.length > 0 ? comparisonData.map((item) => {
                  const diff = item.consumed - item.purchased;
                  return (
                    <div key={item.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-gray-900 dark:text-white">{item.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${diff < -10 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/50'}`}>
                          {diff > 0 ? '+' : ''}{diff} {item.unit}
                        </span>
                      </div>

                      {/* Progress Bar Visual */}
                      <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div
                          className="absolute top-0 left-0 h-full bg-blue-500 rounded-full z-10"
                          style={{ width: `${(item.consumed / item.purchased) * 100}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Gestreept: <span className="text-gray-900 dark:text-white font-medium">{item.consumed}</span></span>
                        <span>Ingekocht: <span className="text-gray-900 dark:text-white font-medium">{item.purchased}</span></span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-6 text-gray-400 text-xs italic">Geen categoriegegevens beschikbaar.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Camera Upload Knop */}
            <div
              onClick={handleTakeReceiptPhoto}
              className="border-2 border-transparent bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg cursor-pointer mb-6 relative overflow-hidden"
            >
              {isUploading && (
                <div className="absolute inset-0 bg-blue-900/80 flex items-center justify-center z-20">
                  <span className="material-icons-round animate-spin text-4xl">refresh</span>
                </div>
              )}
              <span className="material-icons-round text-5xl mb-4">document_scanner</span>
              <h2 className="text-xl font-black">Scan Kassaticket</h2>
              <p className="text-sm text-blue-200 mt-1">Gebruik de camera van je smartphone</p>
            </div>

            {/* Filepicker voor andere bestanden */}
            <div className="relative bg-white dark:bg-[#1e293b] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-blue-500">
              <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={handlePdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <span className="material-icons-round text-gray-400 text-4xl mb-2">upload_file</span>
              <h3 className="font-bold text-gray-700 dark:text-gray-200">Kies PDF, DOCX of afbeelding</h3>
              <p className="text-xs text-gray-500 mt-1">Tik of sleep om te bladeren in je bestanden</p>
            </div>

            {/* Invoices List */}
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1 mt-6">Verwerkte Facturen</h3>
            <div className="space-y-3">
              {invoices.length > 0 ? invoices.map((inv) => (
                <div key={inv.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors">
                      <span className="material-icons-round">description</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{inv.supplier}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{inv.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">€ {inv.amount.toFixed(2)}</div>
                    <div className="text-[10px] text-green-600 dark:text-green-400 flex items-center justify-end gap-1">
                      <span className="material-icons-round text-[10px]">check_circle</span>
                      Verwerkt
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 text-gray-400 text-xs italic">Geen facturen gevonden.</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Actions */}
      <footer className="fixed bottom-nav-offset left-0 right-0 p-4 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-20 flex gap-3 transition-colors">
        {activeTab === 'vergelijking' ? (
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <span className="material-icons-round">assessment</span>
            Rapport Genereren
          </button>
        ) : (
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <span className="material-icons-round">add</span>
            Nieuwe Factuur
          </button>
        )}
      </footer>
    </div>
  );
};

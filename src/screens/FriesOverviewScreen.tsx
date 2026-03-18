import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFries } from '../contexts/FriesContext';
import { useAgenda } from '../contexts/AgendaContext';
import { BottomSheet } from '../components/Modal';
import { showToast } from '../components/Toast';
import { FRITUUR_STATUS } from '../lib/constants';

export const FriesOverviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { handleAddNotification: onAddNotification } = useAgenda();
  const { 
      friesOrders: orders, 
      activeFrituurSession, 
      setFriesSessionStatus: onSessionChange, 
      setFriesPickupTime: onSetPickupTime, 
      handleCompleteFriesPayment: onCompletePayment 
  } = useFries();
  
  const sessionStatus = activeFrituurSession?.status || FRITUUR_STATUS.CLOSED;
  const pickupTime = activeFrituurSession?.pickupTime;
  
  const [activeTab, setActiveTab] = useState<string>('Alles');
  const [showReopenConfirmation, setShowReopenConfirmation] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  // Payment state
  const [actualAmount, setActualAmount] = useState<number | string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time input state
  const [tempPickupTime, setTempPickupTime] = useState('');

  // Filter only ACTIVE orders safely
  const activeOrders = useMemo(() => (orders || []).filter(o => o?.status === 'open'), [orders]);

  useEffect(() => {
    if (pickupTime) {
      setTempPickupTime(pickupTime);
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setTempPickupTime(now.toTimeString().slice(0, 5));
    }
  }, [pickupTime]);

  const capitalize = (s: any) => {
      if (!s || typeof s !== 'string') return 'Overig';
      return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const aggregatedItems = useMemo(() => {
    const itemMap = new Map<string, { id: string, name: string, count: number, price: number, category: string }>();

    activeOrders.forEach(order => {
      if (!order || !order.items) return; 
      
      order.items.forEach(item => {
        if (!item) return; 
        
        const key = item.id || Math.random().toString(); 
        const qty = item.quantity || 1;
        const price = item.price || 0;
        
        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.count += qty;
          existing.price += (price * qty); 
        } else {
          itemMap.set(key, {
            id: key,
            name: item.name || 'Onbekend',
            count: qty,
            price: price * qty,
            category: capitalize(item.category),
          });
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeOrders]);

  const dynamicTabs = useMemo(() => {
      const cats = new Set(aggregatedItems.map(i => i.category));
      return ['Alles', ...Array.from(cats).sort()];
  }, [aggregatedItems]);

  useEffect(() => {
      if (activeTab !== 'Alles' && !dynamicTabs.includes(activeTab)) {
          setActiveTab('Alles');
      }
  }, [dynamicTabs, activeTab]);

  useEffect(() => {
    if (sessionStatus !== FRITUUR_STATUS.COMPLETED) {
      setShowReopenConfirmation(false);
    }
    if (sessionStatus !== FRITUUR_STATUS.ORDERING) {
      setShowTimeInput(false);
    }
  }, [sessionStatus]);

  const filteredItems = activeTab === 'Alles'
    ? aggregatedItems
    : aggregatedItems.filter(i => i.category === activeTab);

  const totalAmount = aggregatedItems.reduce((acc, item) => acc + item.price, 0);

  const handleFooterAction = () => {
    if (sessionStatus === FRITUUR_STATUS.OPEN) {
      onSessionChange(FRITUUR_STATUS.COMPLETED);
    } else if (sessionStatus === FRITUUR_STATUS.COMPLETED) {
      if (showReopenConfirmation) {
        onSessionChange(FRITUUR_STATUS.OPEN);
        setShowReopenConfirmation(false);
      } else {
        setShowReopenConfirmation(true);
      }
    } else if (sessionStatus === FRITUUR_STATUS.CLOSED) {
      onSessionChange(FRITUUR_STATUS.OPEN);
    }
  };

  const startOrderingProcess = () => {
    onSessionChange(FRITUUR_STATUS.ORDERING);
  };

  const handleMarkOrdered = () => {
    setShowTimeInput(true);
  };

  const confirmTime = () => {
    onSetPickupTime(tempPickupTime);
    onSessionChange(FRITUUR_STATUS.ORDERED);

    onAddNotification({
      type: 'order',
      sender: 'Friet Verantwoordelijke',
      role: 'ADMIN',
      title: 'Frieten Besteld! 🍟',
      content: `De bestelling is doorgegeven. Jullie mogen de frieten gaan afhalen om ${tempPickupTime}.`,
      time: 'Zonet',
      isRead: false,
      action: '',
      icon: 'fastfood',
      color: 'bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-500'
    } as any);

    setShowTimeInput(false);
  };

  const handleFinishPayment = async () => {
    const amount = typeof actualAmount === 'string' ? parseFloat(actualAmount.replace(',', '.')) : actualAmount;
    if (isNaN(amount)) {
      showToast('Voer een geldig bedrag in', 'error');
      return;
    }
    if (!receiptFile) {
      showToast('Een foto van het kasticket is verplicht!', 'error');
      return;
    }

    setIsSubmitting(true);
    await onCompletePayment(amount, receiptFile);
    setIsSubmitting(false);
    
    setShowPaymentSheet(false);
    setActualAmount('');
    setReceiptFile(null);
    setReceiptPreview(null);
    navigate('/frituur');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusLabel = () => {
    if (sessionStatus === FRITUUR_STATUS.OPEN) return 'Verzamelen';
    if (sessionStatus === FRITUUR_STATUS.COMPLETED) return 'Afgerond (Review)';
    if (sessionStatus === FRITUUR_STATUS.ORDERING) return 'Aan het bestellen...';
    if (sessionStatus === FRITUUR_STATUS.ORDERED) return 'Besteld';
    return 'Niet gestart';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center justify-between sticky top-0 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md z-10 transition-colors border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <span className="material-icons-round text-gray-900 dark:text-white text-2xl">arrow_back_ios_new</span>
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Bestelling Overzicht</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Totaal voor {activeOrders.length} personen</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-64 overflow-y-auto space-y-6">
        <div className={`rounded-2xl p-5 shadow-lg mt-4 text-white transition-colors 
            ${sessionStatus === FRITUUR_STATUS.ORDERED
            ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/20'
            : sessionStatus === FRITUUR_STATUS.ORDERING
              ? 'bg-gradient-to-r from-orange-500 to-orange-400 shadow-orange-500/20'
              : sessionStatus === FRITUUR_STATUS.COMPLETED
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-blue-500/20'
                : 'bg-gradient-to-r from-gray-600 to-gray-500 shadow-gray-500/20'
          }`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Totaal te betalen</p>
              <h2 className="text-4xl font-bold text-white">€ {totalAmount.toFixed(2).replace('.', ',')}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/80 mb-1">Status: <span className="font-bold text-white">{getStatusLabel()}</span></p>
              <div className="flex justify-end mt-1">
                {sessionStatus === FRITUUR_STATUS.COMPLETED ? (
                  <span className="material-icons-round text-white/50 text-4xl">lock</span>
                ) : sessionStatus === FRITUUR_STATUS.ORDERED ? (
                  <span className="material-icons-round text-white/50 text-4xl">check_circle</span>
                ) : sessionStatus === FRITUUR_STATUS.ORDERING ? (
                  <span className="material-icons-round text-white/50 text-4xl">call</span>
                ) : (
                  <span className="material-icons-round text-white/50 text-4xl">shopping_cart</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {dynamicTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${activeTab === tab
                ? 'bg-white dark:bg-[#1e293b] border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'bg-gray-100 dark:bg-[#1e293b]/50 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{activeTab === 'Alles' ? 'ITEMS' : activeTab.toUpperCase()}</h3>
            <span className="text-xs bg-gray-200 dark:bg-[#1e293b] text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md">{filteredItems.reduce((acc, i) => acc + i.count, 0)} items</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>Nog geen items in deze categorie.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between group shadow-sm transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-gray-50 dark:bg-[#0f172a] border border-blue-100 dark:border-blue-500/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">{item.count}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">{item.name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">€ {item.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-[85px] left-0 right-0 px-4 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-md dark:bg-[#1e2330]/95 p-4 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-gray-200/80 dark:border-gray-700/80 pointer-events-auto transition-all duration-300">

          {sessionStatus === FRITUUR_STATUS.ORDERED && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <span className="material-icons-round">alarm_on</span>
                  <span className="font-bold text-sm">Besteld voor {pickupTime}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setActualAmount(totalAmount.toFixed(2));
                  setShowPaymentSheet(true);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span className="material-icons-round">receipt_long</span>
                Betaal & Rond af
              </button>
            </div>
          )}

          {showTimeInput && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 mb-1 px-1">
                <span className="material-icons-round text-green-600 dark:text-green-400">schedule</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Hoe laat om de frieten?</h3>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="time"
                    value={tempPickupTime}
                    onChange={(e) => setTempPickupTime(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xl font-bold rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 text-center"
                  />
                </div>
                <button
                  onClick={confirmTime}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round">check</span>
                </button>
              </div>
              <button onClick={() => setShowTimeInput(false)} className="w-full mt-1 text-xs font-medium text-gray-400 hover:text-gray-600 py-2 transition-colors">Annuleren</button>
            </div>
          )}

          {sessionStatus === FRITUUR_STATUS.ORDERING && !showTimeInput && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-200 dark:border-orange-800 flex items-center gap-3 text-orange-800 dark:text-orange-200">
                <span className="material-icons-round animate-pulse">call</span>
                <span className="text-sm font-bold uppercase tracking-wide">Je bestelt nu bij de frituur...</span>
              </div>
              <button
                onClick={handleMarkOrdered}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="material-icons-round">check_circle</span>
                <span>Bevestig: Bestelling is doorgegeven!</span>
              </button>
            </div>
          )}

          {sessionStatus === FRITUUR_STATUS.COMPLETED && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <button
                onClick={startOrderingProcess}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span className="material-icons-round">call</span>
                Nu Telefonisch Bestellen
              </button>

              <button
                onClick={handleFooterAction}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {showReopenConfirmation ? (
                  <>
                    <span className="material-icons-round text-red-500">warning</span>
                    <span className="text-red-500">Zeker? Klik om te heropenen</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round">lock_open</span>
                    <span>Bestellingen Heropenen</span>
                  </>
                )}
              </button>
            </div>
          )}

          {(sessionStatus === FRITUUR_STATUS.OPEN || sessionStatus === FRITUUR_STATUS.CLOSED) && (
            <div className="animate-in slide-in-from-bottom-2">
              <button
                onClick={handleFooterAction}
                className={`w-full text-white font-bold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 group active:scale-[0.99] transition-all bg-blue-600 hover:bg-blue-500 shadow-blue-500/20`}
              >
                <div className="flex items-center gap-3 flex-1 justify-start">
                  <div className="bg-white/20 p-1 rounded-md flex items-center justify-center">
                    <span className="material-icons-round text-lg">
                      {sessionStatus === FRITUUR_STATUS.OPEN ? 'check_circle' : 'play_arrow'}
                    </span>
                  </div>
                  <span>
                    {sessionStatus === FRITUUR_STATUS.OPEN ? 'Opnemen Stoppen' : 'Sessie Starten'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">€ {totalAmount.toFixed(2).replace('.', ',')}</span>
                  <span className="material-icons-round group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </button>
            </div>
          )}

        </div>
      </div>

      <BottomSheet
        isOpen={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        title="Betaal & Rond af"
      >
        <div className="space-y-6 pb-[100px]">
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Verwacht bedrag (App)</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">€ {totalAmount.toFixed(2).replace('.', ',')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              Werkelijk betaald bedrag <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">€</span>
              <input
                type="number"
                step="0.01"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-700 outline-none transition-all font-bold text-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              Foto van rekening <span className="text-red-500">*</span>
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${receiptPreview ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {receiptPreview ? (
                <img src={receiptPreview} alt="Receipt" className="w-full h-full object-contain" />
              ) : (
                <>
                  <span className="material-icons-round text-4xl text-gray-400 mb-2">add_a_photo</span>
                  <p className="text-xs font-bold text-gray-400">Tik om foto te nemen (Verplicht)</p>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileChange} 
            />
          </div>

          {/* SLIMME KNOP: Toont precies wat er nog mist */}
          <button
            onClick={handleFinishPayment}
            disabled={!actualAmount || !receiptFile || isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="material-icons-round animate-spin">refresh</span>
            ) : (
              <span className="material-icons-round">{(!actualAmount || !receiptFile) ? 'lock' : 'check_circle'}</span>
            )}
            
            {isSubmitting 
              ? 'Bezig met afronden...'
              : !actualAmount 
                ? 'Vul bedrag in' 
                : !receiptFile 
                  ? 'Foto is verplicht' 
                  : 'Bevestig & Sluit Sessie'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
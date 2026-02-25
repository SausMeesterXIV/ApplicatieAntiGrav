import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Order, Notification, User } from '../types';
import { AppContextType } from '../App';

export const FriesOverviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    friesOrders: orders,
    friesSessionStatus: sessionStatus,
    setFriesSessionStatus: onSessionChange,
    friesPickupTime: pickupTime,
    setFriesPickupTime: onSetPickupTime,
    handleArchiveSession: onArchiveSession,
    handleAddNotification: onAddNotification,
    currentUser
  } = useOutletContext<AppContextType>();
  const [activeTab, setActiveTab] = useState<'Alles' | 'Frieten' | 'Snacks' | 'Sauzen'>('Alles');
  const [aggregatedItems, setAggregatedItems] = useState<any[]>([]);
  const [showReopenConfirmation, setShowReopenConfirmation] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);

  // Time input state (default to now + 30m if not set)
  const [tempPickupTime, setTempPickupTime] = useState('');

  // Filter only ACTIVE orders (pending) for the calculation
  const activeOrders = orders.filter(o => o.status === 'pending');

  useEffect(() => {
    if (pickupTime) {
      setTempPickupTime(pickupTime);
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setTempPickupTime(now.toTimeString().slice(0, 5));
    }
  }, [pickupTime]);

  // Aggregate items from all ACTIVE orders
  useEffect(() => {
    const itemMap = new Map<string, { id: string, name: string, count: number, price: number, category: string }>();

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.id; // Group by Item ID
        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.count += item.quantity;
          existing.price += (item.price * item.quantity); // Total accumulated price
        } else {
          itemMap.set(key, {
            id: item.id,
            name: item.name,
            count: item.quantity,
            price: item.price * item.quantity,
            category: capitalize(item.category),
          });
        }
      });
    });

    setAggregatedItems(Array.from(itemMap.values()));
  }, [orders]); // Re-run when orders change

  // Reset confirmation state if session status changes
  useEffect(() => {
    if (sessionStatus !== 'completed') {
      setShowReopenConfirmation(false);
    }
    // Hide time input if we move out of ordering state without setting it
    if (sessionStatus !== 'ordering') {
      setShowTimeInput(false);
    }
  }, [sessionStatus]);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const filteredItems = activeTab === 'Alles'
    ? aggregatedItems
    : aggregatedItems.filter(i => i.category === activeTab);

  const totalAmount = aggregatedItems.reduce((acc, item) => acc + item.price, 0);

  const handleFooterAction = () => {
    if (sessionStatus === 'open') {
      // Closing the session -> Review Mode
      onSessionChange('completed');
    } else if (sessionStatus === 'completed') {
      // Here we can either Reopen OR go to "Aan het bestellen"
      // This function handles the Reopen button click
      if (showReopenConfirmation) {
        onSessionChange('open');
        setShowReopenConfirmation(false);
      } else {
        setShowReopenConfirmation(true);
      }
    } else if (sessionStatus === 'closed') {
      // Starting the session (if closed)
      onSessionChange('open');
    }
  };

  const startOrderingProcess = () => {
    // Lock the session, no reopening allowed after this
    onSessionChange('ordering');
  };

  const handleMarkOrdered = () => {
    // Show Time Input
    setShowTimeInput(true);
  };

  const confirmTime = () => {
    onSetPickupTime(tempPickupTime);
    onSessionChange('ordered');

    // Send notification to all
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
    });

    setShowTimeInput(false);
  };

  // Status Text Helper
  const getStatusLabel = () => {
    if (sessionStatus === 'open') return 'Verzamelen';
    if (sessionStatus === 'completed') return 'Afgerond (Review)';
    if (sessionStatus === 'ordering') return 'Aan het bestellen...';
    if (sessionStatus === 'ordered') return 'Besteld';
    return 'Niet gestart';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <span className="material-icons-round text-gray-900 dark:text-white text-2xl">arrow_back_ios_new</span>
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Bestelling Overzicht</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Totaal voor {activeOrders.length} bestellingen</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
          <span className="material-icons-round text-gray-900 dark:text-white text-xl">share</span>
        </button>
      </header>

      <main className="flex-1 px-4 pb-48 overflow-y-auto space-y-6">
        {/* Hero Card */}
        <div className={`rounded-2xl p-5 shadow-lg mt-2 text-white transition-colors 
            ${sessionStatus === 'ordered'
            ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/20'
            : sessionStatus === 'ordering'
              ? 'bg-gradient-to-r from-orange-500 to-orange-400 shadow-orange-500/20'
              : sessionStatus === 'completed'
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
                {sessionStatus === 'completed' ? (
                  <span className="material-icons-round text-white/50 text-4xl">lock</span>
                ) : sessionStatus === 'ordered' ? (
                  <span className="material-icons-round text-white/50 text-4xl">check_circle</span>
                ) : sessionStatus === 'ordering' ? (
                  <span className="material-icons-round text-white/50 text-4xl">call</span>
                ) : (
                  <span className="material-icons-round text-white/50 text-4xl">shopping_cart</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {['Alles', 'Frieten', 'Snacks', 'Sauzen'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${activeTab === tab
                ? 'bg-white dark:bg-[#1e293b] border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'bg-gray-100 dark:bg-[#1e293b]/50 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
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
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between group shadow-sm transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Quantity Badge */}
                    <div className="h-10 w-10 rounded-lg bg-gray-50 dark:bg-[#0f172a] border border-blue-100 dark:border-blue-500/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{item.count}</span>
                    </div>

                    {/* Info */}
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">{item.name}</h4>
                    </div>
                  </div>

                  {/* Right Side */}
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">€ {item.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800 z-20 transition-colors shadow-2xl">
        <div className="space-y-3">

          {/* STEP 4: ORDERED (Final State) */}
          {sessionStatus === 'ordered' && (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <span className="material-icons-round">alarm_on</span>
                  <span className="font-bold text-sm">Besteld voor {pickupTime}</span>
                </div>
              </div>
              <p className="text-xs text-center text-gray-500">
                De sessie reset automatisch wanneer dit tijdstip gepasseerd is.
              </p>
            </div>
          )}

          {/* STEP 3: TIME INPUT (Overlay) */}
          {showTimeInput && (
            <div className="bg-white dark:bg-[#1e293b] rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-lg animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-icons-round text-green-600">schedule</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Hoe laat om de frieten?</h3>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="time"
                    value={tempPickupTime}
                    onChange={(e) => setTempPickupTime(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-lg font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 text-center"
                  />
                </div>
                <button
                  onClick={confirmTime}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 rounded-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round">check</span>
                  <span>Bevestig</span>
                </button>
              </div>
              <button
                onClick={() => setShowTimeInput(false)}
                className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                Annuleren
              </button>
            </div>
          )}

          {/* STEP 2: ORDERING IN PROGRESS */}
          {sessionStatus === 'ordering' && !showTimeInput && (
            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-200 dark:border-orange-800 shadow-sm animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-3 mb-3 text-orange-800 dark:text-orange-200">
                <span className="material-icons-round animate-pulse">call</span>
                <span className="text-xs font-bold uppercase tracking-wide">Bestelling doorgeven...</span>
              </div>
              <button
                onClick={handleMarkOrdered}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="material-icons-round">check_circle</span>
                <span>Besteld</span>
              </button>
            </div>
          )}

          {/* STEP 1: COMPLETED (Review) */}
          {sessionStatus === 'completed' && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-5">
              <button
                onClick={startOrderingProcess}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span className="material-icons-round">call</span>
                Aan het bestellen
              </button>

              <button
                onClick={handleFooterAction}
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                {showReopenConfirmation ? (
                  <>
                    <span className="material-icons-round text-red-500">warning</span>
                    <span className="text-red-500">Zeker? Klik om te heropenen</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round">lock_open</span>
                    <span>Bestelling Heropenen</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* DEFAULT: CLOSED or OPEN */}
          {(sessionStatus === 'open' || sessionStatus === 'closed') && (
            <button
              onClick={handleFooterAction}
              className={`w-full text-white font-bold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 group active:scale-[0.99] transition-all bg-blue-600 hover:bg-blue-500 shadow-blue-500/20`}
            >
              <div className="flex items-center gap-3 flex-1 justify-start">
                <div className="bg-white/20 p-1 rounded-md">
                  <span className="material-icons-round text-lg">
                    {sessionStatus === 'open' ? 'check_circle' : 'play_arrow'}
                  </span>
                </div>
                <span>
                  {sessionStatus === 'open' ? 'Bestelling Afronden' : 'Sessie Starten'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">€ {totalAmount.toFixed(2).replace('.', ',')}</span>
                <span className="material-icons-round group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
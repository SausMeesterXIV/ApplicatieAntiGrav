import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { BottomSheet } from '../components/Modal';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const TeamDrankFriesHistoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<any[]>([]);
    const [allOrders, setAllOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [editingSession, setEditingSession] = useState<any | null>(null);
    
    // De prijzen die de admin aanpast in de modal
    const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});

    const loadData = async () => {
        setLoading(true);
        try {
            const [sessData, ordersData] = await Promise.all([
                db.fetchAllFrituurSessies(),
                db.fetchAllFrituurBestellingen()
            ]);
            setSessions(sessData);
            setAllOrders(ordersData);
        } catch (error) {
            console.error(error);
            showToast('Kon data niet laden', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedSessionId(prev => prev === id ? null : id);
    };

    const getExpectedTotal = (sessionId: string) => {
        const sessionOrders = allOrders.filter(o => o.sessie_id === sessionId);
        return sessionOrders.reduce((acc, o) => acc + Number(o.totaal_prijs || 0), 0);
    };

    const startEditingPrices = (session: any, e: React.MouseEvent) => {
        e.stopPropagation(); // Voorkom dat de rij inklapt
        const sessionOrders = allOrders.filter(o => o.sessie_id === session.id);
        const uniqueItems = new Map<string, { id: string, name: string, price: number }>();
        
        sessionOrders.forEach(order => {
            (order.items || []).forEach((item: any) => {
                if (!uniqueItems.has(item.id)) {
                    uniqueItems.set(item.id, { id: item.id, name: item.name, price: item.price });
                }
            });
        });

        const initialEdits: Record<string, number> = {};
        uniqueItems.forEach(item => {
            initialEdits[item.id] = item.price;
        });

        setPriceEdits(initialEdits);
        setEditingSession({ ...session, items: Array.from(uniqueItems.values()) });
    };

    const handleSavePriceUpdates = async () => {
        if (!editingSession) return;
        
        showToast('Prijzen updaten en rekeningen herberekenen...', 'info');
        
        try {
            // 1. Update de globale prijzen in het menu (frituur_items tabel)
            for (const [itemId, newPrice] of Object.entries(priceEdits)) {
                await db.updateFryItem(itemId, { price: newPrice });
            }

            // 2. Herbereken de bestellingen van DEZE specifieke sessie
            const sessionOrders = allOrders.filter(o => o.sessie_id === editingSession.id);
            
            for (const order of sessionOrders) {
                let newOrderTotal = 0;
                const newItemsJson = (order.items || []).map((item: any) => {
                    // Als we deze hebben aangepast, neem de nieuwe prijs, anders de oude
                    const updatedPrice = priceEdits[item.id] !== undefined ? priceEdits[item.id] : item.price;
                    newOrderTotal += (updatedPrice * item.quantity);
                    return { ...item, price: updatedPrice };
                });

                // Update bestelling in DB met nieuwe totaalprijs
                await db.updateFrituurBestelling(order.id, newOrderTotal, newItemsJson);
            }

            showToast('Succesvol aangepast en verrekend!', 'success');
            setEditingSession(null);
            loadData(); // Herlaad de data om nieuwe totalen te zien

        } catch (error) {
            console.error(error);
            showToast('Fout bij het updaten van prijzen', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-24 transition-colors">
            <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 flex items-center gap-4 bg-white dark:bg-[#1e2330] shadow-sm sticky top-0 z-20">
                <ChevronBack onClick={() => navigate(-1)} />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Frituurgeschiedenis</h1>
            </header>

            <main className="p-4 space-y-4">
                {sessions.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">Nog geen frituursessies gevonden.</div>
                ) : (
                    sessions.map(session => {
                        const expectedTotal = getExpectedTotal(session.id);
                        const actualTotal = Number(session.actual_amount || 0);
                        const isPaid = session.status === 'paid' || session.actual_amount !== null;
                        
                        // Bepaal kleur: Groen als ze overeenkomen (of als er < 0.05c verschil op zit), anders Rood
                        const isMismatch = isPaid && Math.abs(expectedTotal - actualTotal) > 0.05;
                        const headerColor = !isPaid 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700' // Nog bezig / niet betaald
                            : isMismatch 
                                ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800' // FOUT!
                                : 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800'; // GOED!

                        const isExpanded = expandedSessionId === session.id;
                        const sessionOrders = allOrders.filter(o => o.sessie_id === session.id);

                        return (
                            <div key={session.id} className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                                
                                {/* Header / Klikbare balk */}
                                <div 
                                    onClick={() => toggleExpand(session.id)}
                                    className={`p-4 cursor-pointer transition-colors border-b flex justify-between items-center ${headerColor} ${!isExpanded ? 'border-b-transparent' : ''}`}
                                >
                                    <div>
                                        <h3 className="font-bold text-sm">
                                            {new Date(session.created_at).toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                        </h3>
                                        <div className="flex gap-4 mt-1 text-xs opacity-80">
                                            <span>Betaald: <b>€{actualTotal.toFixed(2)}</b></span>
                                            <span>Verwacht: <b>€{expectedTotal.toFixed(2)}</b></span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isMismatch && (
                                            <span className="material-icons-round text-red-600 dark:text-red-400">warning</span>
                                        )}
                                        <span className="material-icons-round text-gray-500 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                            expand_more
                                        </span>
                                    </div>
                                </div>

                                {/* Uitgeklapte Details */}
                                {isExpanded && (
                                    <div className="p-4 space-y-5 bg-white dark:bg-[#1e2330]">
                                        
                                        {/* Knoppen Paneel */}
                                        {isMismatch && (
                                            <button 
                                                onClick={(e) => startEditingPrices(session, e)}
                                                className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">edit</span>
                                                Pas prijzen aan
                                            </button>
                                        )}

                                        {/* Kasticket Foto */}
                                        {session.receipt_url && (
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Kasticket</h4>
                                                <a href={session.receipt_url} target="_blank" rel="noreferrer" className="block w-full max-w-[200px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:opacity-80 transition-opacity">
                                                    <img src={session.receipt_url} alt="Kasticket" className="w-full h-auto" />
                                                </a>
                                            </div>
                                        )}

                                        {/* Wie bestelde wat */}
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Bestellingen ({sessionOrders.length})</h4>
                                            <div className="space-y-2">
                                                {sessionOrders.map(order => (
                                                    <div key={order.id} className="flex justify-between items-start bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{order.user_name}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                                                {(order.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                                                            </p>
                                                        </div>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400 text-sm ml-3 shrink-0">
                                                            €{Number(order.totaal_prijs).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </main>

            {/* Prijs Editor Modal */}
            <BottomSheet isOpen={!!editingSession} onClose={() => setEditingSession(null)} title="Prijzen Herberekenen">
                {editingSession && (
                    <div className="space-y-4 pb-12">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 text-sm mb-4">
                            <span className="font-bold">Let op:</span> Als je deze prijzen aanpast, veranderen we de prijs in het menu voor de toekomst, én herberekenen we de individuele rekeningen van <b>deze specifieke bestelling</b>. Oude bestellingen blijven ongewijzigd.
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto space-y-2 px-1">
                            {editingSession.items.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate pr-2">{item.name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-gray-500 font-bold">€</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={priceEdits[item.id]} 
                                            onChange={(e) => setPriceEdits(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                            className="w-20 p-2 text-center font-bold bg-white dark:bg-[#1e2330] border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleSavePriceUpdates}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform mt-4"
                        >
                            <span className="material-icons-round">save</span>
                            Opslaan & Herberekenen
                        </button>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
};

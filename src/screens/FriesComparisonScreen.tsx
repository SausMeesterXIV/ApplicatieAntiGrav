import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { Order, FryItem } from '../types';
import * as db from '../lib/supabaseService';
import { SkeletonCard, SkeletonRow } from '../components/Skeleton';
import { supabase } from '../lib/supabase';

export const FriesComparisonScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [aggregatedItems, setAggregatedItems] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch session details
        const { data: sessionData, error: sessionError } = await supabase
          .from('frituur_sessies')
          .select('*')
          .eq('id', sessionId)
          .single();
        
        if (sessionError) throw sessionError;
        setSession(sessionData);

        // Fetch orders for this session
        const ordersData = await db.fetchFrituurBestellingen(sessionId);
        setOrders(ordersData);

        // Aggregate items
        const itemMap = new Map<string, { name: string, count: number, pricePerUnit: number, totalPrice: number }>();
        
        ordersData.forEach(order => {
          order.items.forEach(item => {
            const key = item.id;
            if (itemMap.has(key)) {
              const existing = itemMap.get(key)!;
              existing.count += item.quantity;
              existing.totalPrice += (item.price * item.quantity);
            } else {
              itemMap.set(key, {
                name: item.name,
                count: item.quantity,
                pricePerUnit: item.price,
                totalPrice: item.price * item.quantity
              });
            }
          });
        });

        setAggregatedItems(Array.from(itemMap.values()));
      } catch (error) {
        console.error('Error fetching comparison data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  const expectedTotal = aggregatedItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const actualTotal = session?.actual_amount || 0;
  const difference = actualTotal - expectedTotal;

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] p-4 space-y-4">
        <SkeletonCard lines={3} />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!sessionId || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0f172a] p-6 text-center">
        <span className="material-icons-round text-6xl text-gray-300 mb-4">error_outline</span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sessie niet gevonden</h2>
        <button onClick={() => navigate(-1)} className="text-blue-600 font-bold">Ga Terug</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-xl font-bold leading-tight tracking-tight">Rekening & Bestelling</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Prijsvergelijking Audit</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Comparison Summary Card */}
        <div className={`p-6 rounded-3xl shadow-xl text-white ${Math.abs(difference) < 0.01 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Verwacht (App)</p>
              <p className="text-2xl font-black">€ {expectedTotal.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">Werkelijk (Betaald)</p>
              <p className="text-2xl font-black">€ {actualTotal.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/20 flex justify-between items-center">
            <p className="font-bold">Verschil</p>
            <p className={`text-xl font-black ${difference > 0 ? 'text-white' : 'text-white'}`}>
              {difference > 0 ? '+' : ''}€ {difference.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Receipt Photo */}
        {session.receipt_url && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">Kasticket</h3>
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-2 border border-gray-100 dark:border-gray-800 shadow-sm">
              <img 
                src={session.receipt_url} 
                alt="Receipt" 
                className="w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(session.receipt_url, '_blank')}
              />
              <p className="text-[10px] text-center text-gray-400 mt-2 italic">Klik op de foto om te vergroten</p>
            </div>
          </section>
        )}

        {/* Item Breakdown */}
        <section className="space-y-3 pb-8">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">Bestelde Items</h3>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Aantal</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Prijs p.s.</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Totaal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {aggregatedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-md">
                        {item.count}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-bold text-gray-700 dark:text-gray-200">
                      {item.name}
                    </td>
                    <td className="p-3 text-right text-xs text-gray-500 dark:text-gray-400 font-medium">
                      € {item.pricePerUnit.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                      € {item.totalPrice.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-800/50 font-black">
                  <td colSpan={3} className="p-3 text-right text-sm uppercase text-gray-500 dark:text-gray-400">Verwacht Totaal</td>
                  <td className="p-3 text-right text-sm text-blue-600 dark:text-blue-400">
                    € {expectedTotal.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 px-2 italic">
            Tip: Als deze lijst korter is dan de rekening, zijn er mogelijk items niet ingevoerd in de app.
          </p>
        </section>
      </main>
    </div>
  );
};

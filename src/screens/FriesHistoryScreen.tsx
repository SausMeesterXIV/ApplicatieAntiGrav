import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { AppContextType } from '../App';
import { Order } from '../types';

export const FriesHistoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const { friesOrders, users, currentUser } = useOutletContext<AppContextType>();

    // Group completed orders by date (day)
    const groupedByDate = (() => {
        const completed = friesOrders.filter(o => o.userId === currentUser.id);
        const groups = new Map<string, { date: Date; orders: Order[]; total: number }>();

        completed.forEach(order => {
            const d = new Date(order.date);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!groups.has(key)) {
                groups.set(key, { date: d, orders: [], total: 0 });
            }
            const group = groups.get(key)!;
            group.orders.push(order);
            group.total += order.totalPrice;
        });

        return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
    })();

    const formatDate = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
            {/* Header */}
            <header className="px-4 py-4 flex items-center gap-4 sticky top-0 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md z-10 border-b border-gray-100 dark:border-gray-800 transition-colors">
                <ChevronBack onClick={() => navigate(-1)} />
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">🍟 Frieten Geschiedenis</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{groupedByDate.length} sessie{groupedByDate.length !== 1 ? 's' : ''}</p>
                </div>
            </header>

            <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6 pt-4">
                {groupedByDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <span className="material-icons-round text-5xl mb-3 opacity-40">receipt_long</span>
                        <p className="font-medium">Nog geen frituurbestellingen</p>
                        <p className="text-sm mt-1">Bestellingen verschijnen hier na afronding</p>
                    </div>
                ) : (
                    groupedByDate.map((group, idx) => (
                        <div key={idx} className="space-y-3">
                            {/* Date Header */}
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider capitalize">
                                    {formatDate(group.date)}
                                </h3>
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-lg">
                                    € {group.total.toFixed(2).replace('.', ',')}
                                </span>
                            </div>

                            {/* Session Card */}
                            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                                {/* Summary Bar */}
                                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <span className="material-icons-round text-base">people</span>
                                        <span className="text-xs font-bold">{group.orders.length} bestelling{group.orders.length !== 1 ? 'en' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <span className="material-icons-round text-base">shopping_cart</span>
                                        <span className="text-xs font-bold">{group.orders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.quantity, 0), 0)} items</span>
                                    </div>
                                </div>

                                {/* Per-person orders */}
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {group.orders.map(order => (
                                        <div key={order.id} className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {order.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white">{order.userName}</span>
                                                </div>
                                                <span className="font-bold text-sm text-gray-900 dark:text-white">€ {order.totalPrice.toFixed(2).replace('.', ',')}</span>
                                            </div>
                                            <div className="ml-10 space-y-0.5">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                        <span>{item.quantity}x {item.name}</span>
                                                        <span>€ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total */}
                                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-800/30 flex items-center justify-between">
                                    <span className="font-bold text-sm text-blue-700 dark:text-blue-400">Totaal sessie</span>
                                    <span className="font-bold text-lg text-blue-700 dark:text-blue-400">€ {group.total.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};

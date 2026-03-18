import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import * as db from '../lib/supabaseService';
import { ShopProduct } from '../types';
import { showToast } from '../components/Toast';

export const ShopInventoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<ShopProduct[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const loadInventory = async () => {
        try {
            setLoading(true);
            const data = await db.fetchShopProducts();
            setProducts(data);
        } catch (error) {
            showToast('Fout bij laden inventaris', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    const handleUpdateStock = async (productId: string, variantId: string, newStock: number) => {
        if (newStock < 0 || isNaN(newStock)) return;
        try {
            await db.updateShopVariantStock(variantId, newStock);
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return {
                        ...p,
                        variants: (p.variants || []).map(v => v.id === variantId ? { ...v, stock: newStock } : v)
                    };
                }
                return p;
            }));
            showToast('Voorraad bijgewerkt', 'success');
        } catch (error) {
            showToast('Fout bij bijwerken voorraad', 'error');
        }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const categories = ['hemden', 't-shirts', 'truien', 'sjaaltjes', 'schildjes', 'extras'];

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
            <header className="px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] bg-gray-50 dark:bg-[#0f172a] sticky top-0 z-20">
                <div className="flex items-center gap-4 mb-6">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">Beheer</span>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Inventaris</h1>
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="material-icons-round text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                    </div>
                    <input
                        type="text"
                        placeholder="Zoek op naam of categorie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-[#1e2330] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all text-gray-900 dark:text-white font-medium"
                    />
                </div>
            </header>

            <main className="px-4 space-y-8">
                {categories.map(category => {
                    const catProducts = filteredProducts.filter(p => p.category === category);
                    if (catProducts.length === 0) return null;

                    return (
                        <section key={category}>
                            <div className="flex items-center gap-2 px-4 mb-4">
                                <span className="material-icons-round text-primary text-sm">label</span>
                                <h2 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{category}</h2>
                            </div>
                            <div className="space-y-3">
                                {catProducts.map(product => {
                                    const variant = product.variants?.[0];
                                    if (!variant) return null;

                                    return (
                                        <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{product.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className={`w-2 h-2 rounded-full ${variant.stock <= 5 ? 'bg-red-500 animate-pulse' : variant.stock <= 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{variant.stock} op voorraad</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleUpdateStock(product.id, variant.id, variant.stock - 1)}
                                                    className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center active:scale-90 text-gray-900 dark:text-white"
                                                >
                                                    <span className="material-icons-round text-lg">remove</span>
                                                </button>
                                                
                                                <input
                                                    type="number"
                                                    value={variant.stock}
                                                    onChange={(e) => handleUpdateStock(product.id, variant.id, parseInt(e.target.value) || 0)}
                                                    className="w-14 h-10 text-center bg-gray-100 dark:bg-gray-900 rounded-xl font-black text-lg text-gray-900 dark:text-white outline-none border-2 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-black transition-all shadow-inner"
                                                />

                                                <button
                                                    onClick={() => handleUpdateStock(product.id, variant.id, variant.stock + 1)}
                                                    className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center active:scale-90 text-gray-900 dark:text-white"
                                                >
                                                    <span className="material-icons-round text-lg">add</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}

                {filteredProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-[#1e2330] rounded-3xl flex items-center justify-center mb-4 text-gray-300">
                            <span className="material-icons-round text-4xl">search_off</span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Geen items gevonden die voldoen aan je zoekopdracht.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

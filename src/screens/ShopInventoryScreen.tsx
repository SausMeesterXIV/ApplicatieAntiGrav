import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import * as db from '../lib/supabaseService';
import { ShopProduct } from '../types';
import { showToast } from '../components/Toast';

export const ShopInventoryScreen: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<ShopProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        try {
            const data = await db.fetchShopProducts();
            setProducts(data);
        } catch (error) {
            console.error(error);
            showToast('Fout bij het laden van de voorraad', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
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
        } catch (error) {
            showToast('Fout bij bijwerken voorraad', 'error');
        }
    };

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products;
        const query = searchQuery.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.category.toLowerCase().includes(query) ||
            p.variants?.some(v => v.name.toLowerCase().includes(query))
        );
    }, [products, searchQuery]);

    const groupedProducts = useMemo(() => {
        const groups: Record<string, ShopProduct[]> = {};
        filteredProducts.forEach(p => {
            // Filter producten zonder varianten uit de lijst om lege witte balken te voorkomen
            if (!p.variants || p.variants.length === 0) return;
            
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, [filteredProducts]);

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
            <header className="px-6 py-6 flex flex-col bg-gray-50 dark:bg-[#0f172a] sticky top-0 z-20 gap-4">
                <div className="flex items-center gap-4">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">Inventaris</span>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">Producten Tellen</h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                    <input
                        type="text"
                        placeholder="Zoek product of categorie..."
                        className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-gray-900 dark:text-white font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            <main className="p-4 space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-500 font-medium">Laden van producten...</p>
                    </div>
                ) : Object.keys(groupedProducts).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-[#1e2330] rounded-3xl flex items-center justify-center mb-4 text-gray-300">
                            <span className="material-icons-round text-4xl">search_off</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Geen producten gevonden</h2>
                        <p className="text-gray-500">Probeer een andere zoekterm.</p>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, products]) => (
                        <section key={category} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <span className="material-icons-round text-primary text-sm">label</span>
                                <h2 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{category}</h2>
                            </div>
                            
                            <div className="space-y-3">
                                {products.map(product => (
                                    <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-[2rem] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center shrink-0 border border-primary/10">
                                                    <span className="material-icons-round text-primary">shopping_bag</span>
                                                </div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{product.name}</h3>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                {(product.variants || []).map(variant => (
                                                    <div key={variant.id} className="flex items-center justify-between p-3 px-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100/50 dark:border-gray-700/30 group">
                                                        <span className="font-bold text-gray-600 dark:text-gray-400 text-sm tracking-wide">{variant.name}</span>
                                                        
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleUpdateStock(product.id, variant.id, variant.stock - 1)}
                                                                className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:scale-90 text-gray-900 dark:text-white"
                                                            >
                                                                <span className="material-icons-round text-base">remove</span>
                                                            </button>

                                                            <input
                                                                type="number"
                                                                value={variant.stock}
                                                                onChange={(e) => handleUpdateStock(product.id, variant.id, parseInt(e.target.value) || 0)}
                                                                className="w-16 h-10 text-center bg-gray-100 dark:bg-gray-900 rounded-xl font-black text-lg text-gray-900 dark:text-white outline-none border-2 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-black transition-all shadow-inner"
                                                            />

                                                            <button
                                                                onClick={() => handleUpdateStock(product.id, variant.id, variant.stock + 1)}
                                                                className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:scale-90 transition-all text-gray-900 dark:text-white"
                                                            >
                                                                <span className="material-icons-round text-base">add</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </main>
        </div>
    );
};

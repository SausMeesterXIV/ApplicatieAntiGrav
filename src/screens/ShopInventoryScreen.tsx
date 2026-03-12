import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import * as db from '../lib/supabaseService';
import { ShopProduct, ShopVariant } from '../types';
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
        if (newStock < 0) return;
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
            <header className="px-6 py-4 bg-white dark:bg-[#1e2330] shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-4 mb-4">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Producten Tellen</h1>
                </div>
                
                <div className="relative">
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Zoek product of categorie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl outline-none border-2 border-transparent focus:border-primary transition-all text-gray-900 dark:text-white"
                    />
                </div>
            </header>

            <main className="p-4 space-y-8">
                {Object.entries(groupedProducts).length === 0 ? (
                    <div className="py-20 text-center">
                        <span className="material-icons-round text-6xl text-gray-300 mb-4">search_off</span>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Geen producten gevonden</p>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, catProducts]) => (
                        <section key={category}>
                            <h2 className="text-xs font-black text-primary dark:text-primary-light uppercase tracking-widest mb-4 px-2">{category}</h2>
                            <div className="space-y-4">
                                {catProducts.map(product => (
                                    <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">{product.name}</h3>
                                        <div className="space-y-3">
                                            {(product.variants || []).map(variant => (
                                                <div key={variant.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{variant.name}</span>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleUpdateStock(product.id, variant.id, variant.stock - 1)}
                                                            className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow-sm border dark:border-gray-600 flex items-center justify-center active:scale-90"
                                                        >
                                                            <span className="material-icons-round text-gray-600 dark:text-gray-300">remove</span>
                                                        </button>
                                                        
                                                        <input
                                                            type="number"
                                                            value={variant.stock}
                                                            onChange={(e) => handleUpdateStock(product.id, variant.id, parseInt(e.target.value) || 0)}
                                                            className="w-20 h-12 text-center bg-white dark:bg-gray-800 rounded-xl font-black text-xl text-primary dark:text-primary-light outline-none border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                                                        />

                                                        <button
                                                            onClick={() => handleUpdateStock(product.id, variant.id, variant.stock + 1)}
                                                            className="w-10 h-10 rounded-full bg-primary text-white shadow-md flex items-center justify-center active:scale-90"
                                                        >
                                                            <span className="material-icons-round">add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
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

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import * as db from '../lib/supabaseService';
import { ShopProduct } from '../types';
import { showToast } from '../components/Toast';

export const ShopCategoryScreen: React.FC = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const [products, setProducts] = useState<ShopProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [imageActionProductId, setImageActionProductId] = useState<string | null>(null);

    const isClothing = ['hemden', 't-shirts', 'truien'].includes(categoryId || '');
    const isSjaaltjes = categoryId === 'sjaaltjes';
    const isSchildjes = categoryId === 'schildjes';
    const isExtras = categoryId === 'extras';

    const loadProducts = async () => {
        try {
            setLoading(true);
            let data = await db.fetchShopProducts(categoryId);

            // Auto-initialisatie voor lege categorieën
            if (data.length === 0) {
                if (isSjaaltjes) {
                    const p1 = await db.saveShopProduct({ name: 'Leiding', category: 'sjaaltjes' });
                    await db.addShopVariant(p1.id, 'Standaard');
                    const p2 = await db.saveShopProduct({ name: 'Leden', category: 'sjaaltjes' });
                    await db.addShopVariant(p2.id, 'Standaard');
                    data = await db.fetchShopProducts(categoryId);
                } else if (isClothing && categoryId === 'hemden') {
                    // Voorbeeld auto-init voor hemden
                    const sizes = ['116', '128', '140', '152', 'S', 'M', 'L', 'XL', 'XXL'];
                    for (const size of sizes) {
                        const p = await db.saveShopProduct({ name: `Hemd ${size}`, category: 'hemden' });
                        await db.addShopVariant(p.id, 'Standaard');
                    }
                    data = await db.fetchShopProducts(categoryId);
                }
            }

            setProducts(data);
        } catch (error) {
            console.error(error);
            showToast('Fout bij het laden van producten', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [categoryId]);

    const handleAddProduct = async () => {
        if (!newProductName.trim()) return;
        try {
            const newProduct = await db.saveShopProduct({ name: newProductName, category: categoryId as any });
            const variant = await db.addShopVariant(newProduct.id, 'Standaard');
            
            // Map variant to product for UI
            const productWithVariant = { ...newProduct, variants: [variant] };
            
            setProducts(prev => [...prev, productWithVariant]);
            setNewProductName('');
            setIsProductModalOpen(false);
            showToast('Product toegevoegd', 'success');
        } catch (error) {
            console.error(error);
            showToast('Fout bij toevoegen product', 'error');
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Zeker dat je dit product wilt verwijderen?')) return;
        try {
            await db.deleteShopProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
            showToast('Product verwijderd', 'info');
        } catch (error) {
            showToast('Fout bij verwijderen product', 'error');
        }
    };

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

    const handleImageUpload = async (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            showToast('Foto uploaden...', 'info');
            const imageUrl = await db.uploadShopImage(productId, file);
            await db.saveShopProduct({ id: productId, image_url: imageUrl });
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: imageUrl } : p));
            showToast('Foto succesvol geüpload', 'success');
        } catch (error) {
            showToast('Upload mislukt', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
            <header className="px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] flex items-center justify-between bg-gray-50 dark:bg-[#0f172a] sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">Winkeltje</span>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none capitalize">{categoryId}</h1>
                    </div>
                </div>
                <button
                    onClick={() => setIsProductModalOpen(true)}
                    className="w-12 h-12 bg-primary hover:bg-primary-dark text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center border border-white/10"
                >
                    <span className="material-icons-round text-white">add</span>
                </button>
            </header>

            <main className="p-4 space-y-4">
                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-[#1e2330] rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                            <span className="material-icons-round text-5xl text-gray-300">inventory_2</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Geen items</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[280px] leading-relaxed">
                            Er zijn nog geen items in deze categorie. Voeg er nu eentje toe!
                        </p>
                        <button
                            onClick={() => setIsProductModalOpen(true)}
                            className="w-full max-w-[240px] py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <span className="material-icons-round">add</span>
                            Item toevoegen
                        </button>
                    </div>
                ) : (
                    products.map(product => {
                        const variant = product.variants?.[0]; // Alleen de eerste variant gebruiken (platgeslagen concept)
                        if (!variant) return null;

                        return (
                            <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:border-gray-200 dark:hover:border-gray-700">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        {isSchildjes && (
                                            <div 
                                                className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 cursor-pointer active:scale-95 transition-transform group"
                                                onClick={() => setImageActionProductId(product.id)}
                                            >
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <span className="material-icons-round text-2xl">image</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="material-icons-round text-white text-lg">camera_alt</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{product.name}</h3>
                                            <button 
                                                onClick={() => handleDeleteProduct(product.id)}
                                                className="text-xs font-bold text-red-500/50 hover:text-red-500 uppercase tracking-widest mt-1 transition-colors"
                                            >
                                                Verwijderen
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <button
                                            onClick={() => handleUpdateStock(product.id, variant.id, variant.stock - 1)}
                                            className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center active:scale-90 text-gray-900 dark:text-white"
                                        >
                                            <span className="material-icons-round text-base">remove</span>
                                        </button>
                                        
                                        <input
                                            type="number"
                                            value={variant.stock}
                                            onChange={(e) => handleUpdateStock(product.id, variant.id, parseInt(e.target.value) || 0)}
                                            className="w-14 h-10 text-center bg-gray-100 dark:bg-gray-900 rounded-xl font-black text-lg text-gray-900 dark:text-white outline-none border-2 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-black transition-all shadow-inner"
                                        />

                                        <button
                                            onClick={() => handleUpdateStock(product.id, variant.id, variant.stock + 1)}
                                            className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center active:scale-90 transition-all text-gray-900 dark:text-white"
                                        >
                                            <span className="material-icons-round text-base">add</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsProductModalOpen(false)}>
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <span className="material-icons-round text-3xl">add_shopping_cart</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">Nieuw Item</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Voeg een item toe aan {categoryId}</p>
                        
                        <input
                            type="text"
                            placeholder={isClothing ? "Bijv. Hemd M..." : "Naam van het item..."}
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="w-full p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl mb-6 outline-none border-2 border-gray-100 dark:border-gray-700 focus:border-primary transition-all text-gray-900 dark:text-white font-bold text-lg text-center shadow-inner"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold text-gray-500 dark:text-gray-400 active:scale-95 transition-transform"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleAddProduct}
                                className="flex-1 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                            >
                                Toevoegen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Sheet voor Foto Upload */}
            {imageActionProductId && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setImageActionProductId(null)}>
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden"></div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 text-center">Foto toevoegen</h2>
                        
                        <div className="space-y-3">
                            <label className="w-full py-5 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/20 hover:bg-primary-dark">
                                <span className="material-icons-round text-2xl">photo_camera</span>
                                Foto maken
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    capture="environment" 
                                    onChange={(e) => {
                                        handleImageUpload(imageActionProductId, e);
                                        setImageActionProductId(null);
                                    }} 
                                />
                            </label>

                            <label className="w-full py-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all cursor-pointer border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750">
                                <span className="material-icons-round text-2xl text-primary">photo_library</span>
                                Kies uit galerij
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                        handleImageUpload(imageActionProductId, e);
                                        setImageActionProductId(null);
                                    }} 
                                />
                            </label>
                        </div>

                        <button
                            onClick={() => setImageActionProductId(null)}
                            className="w-full py-4 mt-6 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold text-gray-500 dark:text-gray-400 active:scale-[0.98] transition-transform"
                        >
                            Annuleren
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


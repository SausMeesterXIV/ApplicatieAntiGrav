import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import * as db from '../lib/supabaseService';
import { ShopProduct, ShopVariant } from '../types';
import { showToast } from '../components/Toast';

export const ShopCategoryScreen: React.FC = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const [products, setProducts] = useState<ShopProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newVariantName, setNewVariantName] = useState('');
    const [activeProductId, setActiveProductId] = useState<string | null>(null);

    const isClothing = ['hemden', 't-shirts', 'truien'].includes(categoryId || '');
    const isSchildjes = categoryId === 'schildjes';
    const isExtras = categoryId === 'extras';

    const loadProducts = async () => {
        try {
            const data = await db.fetchShopProducts(categoryId);
            setProducts(data);
        } catch (error) {
            console.error(error);
            showToast('Fout bij het laden van producten', 'error');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [categoryId]);

    const handleAddProduct = async () => {
        if (!newProductName.trim()) return;
        try {
            const newProduct = await db.saveShopProduct({ name: newProductName, category: categoryId as any });
            setProducts(prev => [...prev, newProduct]);
            setNewProductName('');
            setIsProductModalOpen(false);
            showToast('Product toegevoegd', 'success');
        } catch (error) {
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

    const handleAddVariant = async () => {
        if (!newVariantName.trim() || !activeProductId) return;
        try {
            const newVariant = await db.addShopVariant(activeProductId, newVariantName);
            setProducts(prev => prev.map(p => {
                if (p.id === activeProductId) {
                    return { ...p, variants: [...(p.variants || []), newVariant] };
                }
                return p;
            }));
            setNewVariantName('');
            setIsVariantModalOpen(false);
            showToast('Variant toegevoegd', 'success');
        } catch (error) {
            showToast('Fout bij toevoegen variant', 'error');
        }
    };

    const handleDeleteVariant = async (productId: string, variantId: string) => {
        if (!confirm('Variant verwijderen?')) return;
        try {
            await db.deleteShopVariant(variantId);
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, variants: (p.variants || []).filter(v => v.id !== variantId) };
                }
                return p;
            }));
            showToast('Variant verwijderd', 'info');
        } catch (error) {
            showToast('Fout bij verwijderen variant', 'error');
        }
    };

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
            <header className="px-6 py-4 flex items-center justify-between bg-white dark:bg-[#1e2330] shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize">{categoryId}</h1>
                </div>
                <button
                    onClick={() => setIsProductModalOpen(true)}
                    className="p-3 bg-primary text-white rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center"
                >
                    <span className="material-icons-round">add</span>
                </button>
            </header>

            <main className="p-4 space-y-4">
                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <span className="material-icons-round text-4xl text-gray-400">inventory_2</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Geen producten</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[250px]">
                            Er zijn nog geen producten in deze categorie. Voeg er nu eentje toe!
                        </p>                        <button
                            onClick={() => setIsProductModalOpen(true)}
                            className="w-full max-w-[200px] py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <span className="material-icons-round">add</span>
                            Product toevoegen
                        </button>
                    </div>
                ) : (
                    products.map(product => (
                        <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                    {isSchildjes && (
                                        <div className="relative group w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <span className="material-icons-round">image</span>
                                                </div>
                                            )}
                                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(product.id, e)} />
                                                <span className="material-icons-round text-white text-sm">edit</span>
                                            </label>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{product.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{categoryId}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteProduct(product.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <span className="material-icons-round text-lg">delete</span>
                                </button>
                            </div>
 
                            <div className="space-y-3">
                                {(product.variants || []).map(variant => (
                                    <div key={variant.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-900 dark:text-white min-w-[30px]">{variant.name}</span>
                                            <button onClick={() => handleDeleteVariant(product.id, variant.id)} className="text-gray-300 hover:text-red-500">
                                                <span className="material-icons-round text-xs">close</span>
                                            </button>
                                        </div>
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
                                                className="w-24 h-12 text-center bg-white dark:bg-gray-800 rounded-xl font-black text-xl text-primary dark:text-primary-light outline-none border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
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
 
                                <button
                                    onClick={() => {
                                        setActiveProductId(product.id);
                                        setIsVariantModalOpen(true);
                                    }}
                                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 hover:bg-primary-dark active:scale-[0.97] transition-all mt-4"
                                >
                                    <span className="material-icons-round text-2xl">add_circle</span>
                                    {isClothing ? 'MAAT TOEVOEGEN' : isSchildjes ? 'VARIANT TOEVOEGEN' : isExtras ? 'WOORD TOEVOEGEN' : 'TOEVOEGEN'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </main>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Nieuw Product</h2>
                        <input
                            type="text"
                            placeholder="Naam van het product..."
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-6 outline-none border-2 border-transparent focus:border-primary transition-all text-gray-900 dark:text-white font-bold"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-bold text-gray-500 dark:text-gray-300 active:scale-95 transition-transform"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleAddProduct}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                            >
                                Toevoegen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Variant Modal */}
            {isVariantModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Maat toevoegen</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{isClothing ? 'Bijv. M, L, XL, 152, etc.' : 'Bijv. Naam variant'}</p>
                        <input
                            type="text"
                            placeholder={isClothing ? "Maat..." : "Naam..."}
                            value={newVariantName}
                            onChange={(e) => setNewVariantName(e.target.value)}
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-6 outline-none border-2 border-transparent focus:border-primary transition-all text-gray-900 dark:text-white font-bold text-xl text-center"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsVariantModalOpen(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-bold text-gray-500 dark:text-gray-300 active:scale-95 transition-transform"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleAddVariant}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                            >
                                Opslaan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


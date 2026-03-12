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
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [imageActionProductId, setImageActionProductId] = useState<string | null>(null);
    const [newProductName, setNewProductName] = useState('');
    const [newVariantName, setNewVariantName] = useState('');
    const [activeProductId, setActiveProductId] = useState<string | null>(null);

    const isClothing = ['hemden', 't-shirts', 'truien'].includes(categoryId || '');
    const isSjaaltjes = categoryId === 'sjaaltjes';
    const isSchildjes = categoryId === 'schildjes';
    const isExtras = categoryId === 'extras';

    const isSimplifiedView = isClothing || isSjaaltjes;

    const loadProducts = async () => {
        try {
            let data = await db.fetchShopProducts(categoryId);

            // Auto-initialisatie voor kleding en sjaaltjes
            if (isSimplifiedView && data.length === 0) {
                const newProd = await db.saveShopProduct({ name: categoryId || 'Product', category: categoryId as any });
                
                if (isSjaaltjes) {
                    const var1 = await db.addShopVariant(newProd.id, 'Leiding');
                    const var2 = await db.addShopVariant(newProd.id, 'Leden');
                    newProd.variants = [var1, var2];
                } else {
                    newProd.variants = [];
                }
                data = [newProd];
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

    const renderSimplifiedView = () => {
        const defaultProduct = products[0];
        if (!defaultProduct) return null;

        return (
            <div className="bg-white dark:bg-[#1e2330] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="space-y-4">
                    {(defaultProduct.variants || []).map(variant => (
                        <div key={variant.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100/50 dark:border-gray-700/30 group hover:border-primary/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-900 dark:text-white text-lg">
                                    {isClothing ? `Maat: ${variant.name}` : `${variant.name} sjaaltje`}
                                </span>
                                {isClothing && (
                                    <button onClick={() => handleDeleteVariant(defaultProduct.id, variant.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-2 opacity-0 group-hover:opacity-100">
                                        <span className="material-icons-round text-sm">delete</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-4 self-end sm:self-auto">
                                <button
                                    onClick={() => handleUpdateStock(defaultProduct.id, variant.id, variant.stock - 1)}
                                    className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:scale-90 transition-transform text-gray-900 dark:text-white"
                                >
                                    <span className="material-icons-round">remove</span>
                                </button>

                                <input
                                    type="number"
                                    value={variant.stock}
                                    onChange={(e) => handleUpdateStock(defaultProduct.id, variant.id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-12 text-center bg-gray-100 dark:bg-gray-900 rounded-2xl font-black text-xl text-gray-900 dark:text-white outline-none border-2 border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-black transition-all shadow-inner"
                                />

                                <button
                                    onClick={() => handleUpdateStock(defaultProduct.id, variant.id, variant.stock + 1)}
                                    className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center active:scale-90 transition-transform text-gray-900 dark:text-white"
                                >
                                    <span className="material-icons-round">add</span>
                                </button>
                            </div>
                        </div>
                    ))}

                    {isClothing && (
                        <button
                            onClick={() => {
                                setActiveProductId(defaultProduct.id);
                                setIsVariantModalOpen(true);
                            }}
                            className="w-full py-5 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl font-bold text-lg border-2 border-dashed border-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all mt-4"
                        >
                            <span className="material-icons-round text-2xl">add_circle_outline</span>
                            MAAT TOEVOEGEN
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderStandardView = () => {
        if (products.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-[#1e2330] rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                        <span className="material-icons-round text-5xl text-gray-300">inventory_2</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Geen producten</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[280px] leading-relaxed">
                        Er zijn nog geen producten in deze categorie. Voeg er nu eentje toe!
                    </p>
                    <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="w-full max-w-[240px] py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        <span className="material-icons-round">add</span>
                        Product toevoegen
                    </button>
                </div>
            );
        }

        return products.map(product => (
            <div key={product.id} className="bg-white dark:bg-[#1e2330] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4">
                        {isSchildjes && (
                            <div 
                                className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 cursor-pointer active:scale-95 transition-transform group"
                                onClick={() => setImageActionProductId(product.id)}
                            >
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                        <span className="material-icons-round text-3xl">image</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="material-icons-round text-white text-xl">camera_alt</span>
                                </div>
                                <div className="absolute bottom-1 right-1 bg-white dark:bg-black w-6 h-6 rounded-lg shadow-sm flex items-center justify-center border border-gray-200 dark:border-gray-700">
                                    <span className="material-icons-round text-[12px] text-primary">add_a_photo</span>
                                </div>
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">{product.name}</h3>
                            <p className="text-[10px] font-black text-primary dark:text-primary-light uppercase tracking-widest mt-1 opacity-60">{categoryId}</p>
                        </div>
                    </div>
                    <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                        <span className="material-icons-round text-xl">delete_outline</span>
                    </button>
                </div>

                <div className="space-y-3">
                    {(product.variants || []).map(variant => (
                        <div key={variant.id} className="flex items-center justify-between p-3 px-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100/50 dark:border-gray-700/30 group">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-900 dark:text-white min-w-[30px]">{variant.name}</span>
                                <button onClick={() => handleDeleteVariant(product.id, variant.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <span className="material-icons-round text-lg">close</span>
                                </button>
                            </div>
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

                    <button
                        onClick={() => {
                            setActiveProductId(product.id);
                            setIsVariantModalOpen(true);
                        }}
                        className="w-full py-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl font-bold border-2 border-dashed border-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all mt-4"
                    >
                        <span className="material-icons-round text-xl">add_circle_outline</span>
                        {isSchildjes ? 'VARIANT TOEVOEGEN' : isExtras ? 'WOORD TOEVOEGEN' : 'TOEVOEGEN'}
                    </button>
                </div>
            </div>
        ));
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-20">
            <header className="px-6 py-6 flex items-center justify-between bg-gray-50 dark:bg-[#0f172a] sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary dark:text-blue-500 uppercase tracking-wider mb-1">Categorie</span>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none capitalize">{categoryId}</h1>
                    </div>
                </div>
                {!isSimplifiedView && (
                    <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="w-12 h-12 bg-primary hover:bg-primary-dark text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center border border-white/10"
                    >
                        <span className="material-icons-round text-white">add</span>
                    </button>
                )}
            </header>

            <main className="p-4 space-y-4">
                {isSimplifiedView ? renderSimplifiedView() : renderStandardView()}
            </main>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsProductModalOpen(false)}>
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <span className="material-icons-round text-3xl">add_shopping_cart</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">Nieuw Product</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Voeg een nieuw item toe aan {categoryId}</p>
                        
                        <input
                            type="text"
                            placeholder="Naam van het product..."
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

            {/* Variant Modal */}
            {isVariantModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsVariantModalOpen(false)}>
                    <div className="bg-white dark:bg-[#1e2330] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <span className="material-icons-round text-3xl">straighten</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">{isClothing ? 'Maat toevoegen' : 'Variant toevoegen'}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm text-center">{isClothing ? 'Bijv. M, L, XL, 152, etc.' : 'Bijv. Naam variant'}</p>
                        
                        <input
                            type="text"
                            placeholder={isClothing ? "Maat..." : "Naam..."}
                            value={newVariantName}
                            onChange={(e) => setNewVariantName(e.target.value)}
                            className="w-full p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl mb-6 outline-none border-2 border-gray-100 dark:border-gray-700 focus:border-primary transition-all text-gray-900 dark:text-white font-bold text-2xl text-center shadow-inner"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsVariantModalOpen(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold text-gray-500 dark:text-gray-400 active:scale-95 transition-transform"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleAddVariant}
                                className="flex-1 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                            >
                                Opslaan
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

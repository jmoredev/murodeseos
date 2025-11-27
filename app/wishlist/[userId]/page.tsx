'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { WishlistCard, GiftItem, Priority } from '@/components/WishlistCard';

export default function FriendWishlistPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const friendName = searchParams.get('name') || 'Usuario';

    const [items, setItems] = useState<GiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
    const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);

    useEffect(() => {
        const init = async () => {
            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setCurrentUserId(user.id);

            // 2. Fetch friend's wishlist
            fetchWishlist();
        };

        init();
    }, [userId, router]);

    const fetchWishlist = async () => {
        try {
            const { data, error } = await supabase
                .from('wishlist_items')
                .select('*')
                .eq('user_id', userId)
                .order('title', { ascending: true }); // Ordenar por nombre por defecto

            if (error) throw error;

            const mappedItems: GiftItem[] = (data || []).map(item => ({
                id: item.id,
                title: item.title,
                links: item.links || [],
                imageUrl: item.image_url,
                price: item.price,
                notes: item.notes,
                priority: item.priority as Priority,
                reservedBy: item.reserved_by
            }));

            setItems(mappedItems);
        } catch (error) {
            console.error('Error fetching wishlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReserve = async (item: GiftItem) => {
        if (!currentUserId) return;

        try {
            // Optimistic update
            setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, reservedBy: currentUserId } : i
            ));

            const { error } = await supabase
                .from('wishlist_items')
                .update({ reserved_by: currentUserId })
                .eq('id', item.id);

            if (error) {
                // Rollback on error
                setItems(prev => prev.map(i =>
                    i.id === item.id ? { ...i, reservedBy: null } : i
                ));
                throw error;
            }
        } catch (error) {
            console.error('Error reserving item:', error);
            alert('No se pudo reservar el regalo. Inténtalo de nuevo.');
        }
    };

    const handleCancelReserve = async (item: GiftItem) => {
        if (!currentUserId) return;

        try {
            // Optimistic update
            setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, reservedBy: null } : i
            ));

            const { error } = await supabase
                .from('wishlist_items')
                .update({ reserved_by: null })
                .eq('id', item.id);

            if (error) {
                // Rollback on error
                setItems(prev => prev.map(i =>
                    i.id === item.id ? { ...i, reservedBy: currentUserId } : i
                ));
                throw error;
            }
        } catch (error) {
            console.error('Error canceling reservation:', error);
            alert('No se pudo cancelar la reserva.');
        }
    };

    // Ordenar items según la opción seleccionada
    const sortedItems = [...items].sort((a, b) => {
        if (sortBy === 'name') {
            return a.title.localeCompare(b.title);
        } else {
            // Ordenar por precio
            const priceA = typeof a.price === 'number' ? a.price : parseFloat(a.price || '0');
            const priceB = typeof b.price === 'number' ? b.price : parseFloat(b.price || '0');
            return priceA - priceB;
        }
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">Cargando lista de deseos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                            Lista de deseos de {friendName}
                        </h1>
                    </div>
                </div>

                {/* Sorting controls */}
                {items.length > 0 && (
                    <div className="max-w-5xl mx-auto px-4 pb-4 flex gap-2">
                        <button
                            onClick={() => setSortBy('name')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'name'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Por nombre
                        </button>
                        <button
                            onClick={() => setSortBy('price')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'price'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Por precio
                        </button>
                    </div>
                )}
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {sortedItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sortedItems.map(item => (
                            <WishlistCard
                                key={item.id}
                                item={item}
                                onClick={() => setSelectedItem(item)}
                                isOwner={false}
                                currentUserId={currentUserId || undefined}
                                onReserve={handleReserve}
                                onCancelReserve={handleCancelReserve}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl text-zinc-400">
                            📭
                        </div>
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Lista vacía</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                            {friendName} aún no ha añadido deseos.
                        </p>
                    </div>
                )}
            </main>

            {/* Modal de Detalles */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedItem(null)}
                    ></div>

                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white pr-8">
                                    {selectedItem.title}
                                </h2>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            {/* Imagen */}
                            {selectedItem.imageUrl && (
                                <div className="mb-6">
                                    <img
                                        src={selectedItem.imageUrl}
                                        alt={selectedItem.title}
                                        className="w-full rounded-xl object-cover max-h-64"
                                    />
                                </div>
                            )}

                            {/* Precio */}
                            {selectedItem.price && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Precio aproximado</p>
                                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                        {typeof selectedItem.price === 'number' ? `$${selectedItem.price}` : selectedItem.price}
                                    </p>
                                </div>
                            )}

                            {/* Notas */}
                            {selectedItem.notes && (
                                <div className="mb-6">
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Notas</p>
                                    <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
                                        {selectedItem.notes}
                                    </p>
                                </div>
                            )}

                            {/* Enlaces de Compra */}
                            {selectedItem.links && selectedItem.links.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">Enlaces de compra</p>
                                    <div className="space-y-2">
                                        {selectedItem.links.map((link, index) => (
                                            <a
                                                key={index}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors group"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                <span className="font-medium text-sm truncate flex-1">{new URL(link).hostname}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex gap-3">
                                {!selectedItem.reservedBy && (
                                    <button
                                        onClick={() => {
                                            handleReserve(selectedItem);
                                            setSelectedItem(null);
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                                        Reservar
                                    </button>
                                )}

                                {selectedItem.reservedBy === currentUserId && (
                                    <button
                                        onClick={() => {
                                            handleCancelReserve(selectedItem);
                                            setSelectedItem(null);
                                        }}
                                        className="flex-1 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        Cancelar reserva
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

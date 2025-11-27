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
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedItems: GiftItem[] = (data || []).map(item => ({
                id: item.id,
                title: item.title,
                links: item.links || [],
                imageUrl: item.image_url,
                price: item.price,
                notes: item.notes,
                priority: item.priority as Priority,
                isReserved: item.is_reserved,
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
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {items.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(item => (
                            <WishlistCard
                                key={item.id}
                                item={item}
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
        </div>
    );
}

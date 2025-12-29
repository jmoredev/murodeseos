'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCssColor } from '@/lib/color-utils';
import { WishlistCard, GiftItem, Priority } from '@/components/WishlistCard';

export default function FriendWishlistPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const friendName = searchParams.get('name') || 'Usuario';

    const [items, setItems] = useState<GiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'priority'>('name');
    const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

    useEffect(() => {
        const init = async () => {
            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setCurrentUserId(user.id);

            // 2. Fetch friend's wishlist and profile
            fetchWishlist();
            fetchProfile();
        };

        init();
    }, [userId, router]);

    const fetchWishlist = async () => {
        try {
            const { data, error } = await supabase
                .from('wishlist_items')
                .select('*')
                .eq('user_id', userId)
                .order('title', { ascending: true });

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

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('display_name, avatar_url, shirt_size, pants_size, shoe_size, favorite_brands, favorite_color')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
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

    const sortedItems = [...items].sort((a, b) => {
        if (sortBy === 'name') {
            return a.title.localeCompare(b.title);
        } else if (sortBy === 'price') {
            const priceA = typeof a.price === 'number' ? a.price : parseFloat(a.price || '0');
            const priceB = typeof b.price === 'number' ? b.price : parseFloat(b.price || '0');
            return priceA - priceB;
        } else {
            const priorityValues = { high: 3, medium: 2, low: 1 };
            const priorityA = priorityValues[a.priority || 'medium'] || 2;
            const priorityB = priorityValues[b.priority || 'medium'] || 2;
            return priorityB - priorityA;
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
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                            Lista de deseos de {profile?.display_name || friendName}
                        </h1>
                    </div>
                </div>

                {/* Sorting controls */}
                {items.length > 0 && (
                    <div className="max-w-6xl mx-auto px-4 pb-4 flex gap-2">
                        <button
                            onClick={() => setSortBy('name')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'name'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Nombre
                        </button>
                        <button
                            onClick={() => setSortBy('price')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'price'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Precio
                        </button>
                        <button
                            onClick={() => setSortBy('priority')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'priority'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Prioridad
                        </button>
                    </div>
                )}
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                    {/* Sidebar / Top Info Card (Desktop Only) */}
                    <aside className="hidden lg:block w-80 flex-shrink-0">
                        <div className="sticky top-24 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
                                <div className="h-24 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700"></div>
                                <div className="px-6 pb-8 relative">
                                    {/* Avatar */}
                                    <div className="absolute -top-12 left-6">
                                        <div className="w-24 h-24 rounded-2xl bg-white dark:bg-zinc-900 p-1.5 shadow-xl">
                                            <div className="w-full h-full rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl overflow-hidden border border-zinc-100 dark:border-zinc-700">
                                                {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
                                                    <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    profile?.avatar_url || '👤'
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-14 mb-8">
                                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
                                            {profile?.display_name || friendName}
                                        </h2>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                                            Perfil de Estilo
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Tallas */}
                                        {(profile?.shirt_size || profile?.pants_size || profile?.shoe_size) && (
                                            <div className="space-y-3">
                                                <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">Tallas</h3>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {profile?.shirt_size && (
                                                        <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700 transition-colors">
                                                            <span className="text-xs text-zinc-500">Camiseta</span>
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{profile.shirt_size}</span>
                                                        </div>
                                                    )}
                                                    {profile?.pants_size && (
                                                        <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700 transition-colors">
                                                            <span className="text-xs text-zinc-500">Pantalón</span>
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{profile.pants_size}</span>
                                                        </div>
                                                    )}
                                                    {profile?.shoe_size && (
                                                        <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700 transition-colors">
                                                            <span className="text-xs text-zinc-500">Calzado</span>
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{profile.shoe_size}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Color Favorito */}
                                        {profile?.favorite_color && (
                                            <div className="space-y-3">
                                                <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">Color Favorito</h3>
                                                <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                                    <div className="w-8 h-8 rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: getCssColor(profile.favorite_color) }}></div>
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{profile.favorite_color}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Marcas */}
                                        {profile?.favorite_brands && (
                                            <div className="space-y-3">
                                                <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">Marcas Favoritas</h3>
                                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                                                    "{profile.favorite_brands}"
                                                </div>
                                            </div>
                                        )}

                                        {!(profile?.shirt_size || profile?.pants_size || profile?.shoe_size || profile?.favorite_brands || profile?.favorite_color) && (
                                            <div className="py-8 px-4 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                                <p className="text-xs text-zinc-400 italic">No ha compartido sus preferencias aún.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content: Wishlist Grid */}
                    <section className="flex-1">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                Lista de Deseos
                                <span className="text-sm font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                    {items.length}
                                </span>
                            </h2>
                        </div>

                        {sortedItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                            <div className="text-center py-24 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                    🎁
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Aún no hay deseos</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto">
                                    Cuando {profile?.display_name || friendName} añada regalos, aparecerán aquí.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* Floating Action Button (Mobile Only) */}
            <div className="lg:hidden fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => setIsProfileDrawerOpen(true)}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform border-4 border-white dark:border-zinc-900"
                >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-xl bg-indigo-500">
                        {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
                            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                            profile?.avatar_url || '👤'
                        )}
                    </div>
                    {/* Badge/Indicator */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </div>
                </button>
            </div>

            {/* Mobile Profile Drawer (Bottom Sheet) */}
            {isProfileDrawerOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setIsProfileDrawerOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="relative w-full bg-white dark:bg-zinc-900 rounded-t-[2.5rem] shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                        {/* Handle */}
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 pt-3 pb-1 flex justify-center z-10">
                            <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                        </div>

                        <div className="px-6 pb-10 pt-4">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl overflow-hidden border border-zinc-100 dark:border-zinc-700">
                                    {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
                                        <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                                    ) : (
                                        profile?.avatar_url || '👤'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white truncate">
                                        {profile?.display_name || friendName}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Perfil de Estilo</p>
                                </div>
                                <button
                                    onClick={() => setIsProfileDrawerOpen(false)}
                                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="space-y-8">
                                {/* Tallas */}
                                {(profile?.shirt_size || profile?.pants_size || profile?.shoe_size) && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Tallas</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {profile?.shirt_size && (
                                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-500 mb-1">Camiseta</p>
                                                    <p className="text-base font-bold text-zinc-900 dark:text-white uppercase">{profile.shirt_size}</p>
                                                </div>
                                            )}
                                            {profile?.pants_size && (
                                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-500 mb-1">Pantalón</p>
                                                    <p className="text-base font-bold text-zinc-900 dark:text-white uppercase">{profile.pants_size}</p>
                                                </div>
                                            )}
                                            {profile?.shoe_size && (
                                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-500 mb-1">Calzado</p>
                                                    <p className="text-base font-bold text-zinc-900 dark:text-white uppercase">{profile.shoe_size}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Color y Marcas */}
                                <div className="grid grid-cols-1 gap-6">
                                    {profile?.favorite_color && (
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Color Favorito</h3>
                                            <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-50 dark:border-zinc-700 rounded-2xl">
                                                <div className="w-10 h-10 rounded-xl border-4 border-white dark:border-zinc-900 shadow-sm" style={{ backgroundColor: getCssColor(profile.favorite_color) }}></div>
                                                <span className="text-lg font-bold text-zinc-900 dark:text-white">{profile.favorite_color}</span>
                                            </div>
                                        </div>
                                    )}

                                    {profile?.favorite_brands && (
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Marcas Favoritas</h3>
                                            <div className="p-5 bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-800/50 dark:to-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                                                "{profile.favorite_brands}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalles del Artículo */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedItem(null)}
                    ></div>

                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white pr-8">
                                    {selectedItem.title}
                                </h2>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            {selectedItem.imageUrl && (
                                <div className="mb-8 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <img
                                        src={selectedItem.imageUrl}
                                        alt={selectedItem.title}
                                        className="w-full h-auto object-cover max-h-72"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                {selectedItem.price && (
                                    <div>
                                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Precio</p>
                                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                                            {typeof selectedItem.price === 'number' ? `$${selectedItem.price}` : selectedItem.price}
                                        </p>
                                    </div>
                                )}
                                {selectedItem.priority && (
                                    <div>
                                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Prioridad</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${selectedItem.priority === 'high' ? 'bg-red-500' :
                                                selectedItem.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}></span>
                                            <span className="font-bold text-zinc-900 dark:text-white capitalize">{selectedItem.priority}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedItem.notes && (
                                <div className="mb-8">
                                    <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2.5">Notas</p>
                                    <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl text-zinc-700 dark:text-zinc-300 text-sm italic border border-zinc-100 dark:border-zinc-700/50">
                                        "{selectedItem.notes}"
                                    </div>
                                </div>
                            )}

                            {selectedItem.links && selectedItem.links.length > 0 && (
                                <div className="mb-8">
                                    <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Dónde comprar</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedItem.links.map((link, index) => (
                                            <a
                                                key={index}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white text-zinc-700 dark:text-zinc-300 rounded-xl transition-all font-medium text-sm group shadow-sm border border-zinc-200 dark:border-zinc-700"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                {new URL(link).hostname.replace('www.', '')}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4">
                                {!selectedItem.reservedBy ? (
                                    <button
                                        onClick={() => {
                                            handleReserve(selectedItem);
                                            setSelectedItem(null);
                                        }}
                                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                                        Reservar Regalo
                                    </button>
                                ) : (
                                    selectedItem.reservedBy === currentUserId && (
                                        <button
                                            onClick={() => {
                                                handleCancelReserve(selectedItem);
                                                setSelectedItem(null);
                                            }}
                                            className="flex-1 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-100"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            Cancelar Reserva
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

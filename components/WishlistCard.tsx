'use client';

import React from 'react';

// --- Types ---
export type Priority = 'low' | 'medium' | 'high';

export interface GiftItem {
    id: string;
    title: string;
    links: string[];
    imageUrl?: string;
    price?: string | number;
    notes?: string;
    priority: Priority;
    reservedBy?: string | null; // ID of the user who reserved it
    excludedGroupIds?: string[];
}

// --- Icons ---
const Icons = {
    Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
    Gift: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>,
    Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    Lock: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
    X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

interface WishlistCardProps {
    item: GiftItem;
    onClick?: (item: GiftItem) => void;
    isOwner: boolean;
    currentUserId?: string;
    onReserve?: (item: GiftItem) => void;
    onCancelReserve?: (item: GiftItem) => void;
    onDelete?: (item: GiftItem) => void;
}

export function WishlistCard({
    item,
    onClick,
    isOwner,
    currentUserId,
    onReserve,
    onCancelReserve,
    onDelete
}: WishlistCardProps) {
    const priorityColors = {
        low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    };

    const priorityLabels = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta'
    };

    // --- Reservation Logic ---
    const isReservedByMe = !isOwner && item.reservedBy === currentUserId;
    const isReservedByOther = !isOwner && item.reservedBy && item.reservedBy !== currentUserId;
    const isAvailable = !isOwner && !item.reservedBy;

    // If owner, we ignore reservation state visually (privacy rule)

    return (
        <div
            onClick={() => onClick && onClick(item)}
            className={`group relative bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden transition-all flex flex-col h-full
                ${isReservedByMe
                    ? 'border-green-500 dark:border-green-500 shadow-md shadow-green-500/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700'}
                ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            {/* Imagen / Cover */}
            <div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                {item.imageUrl ? (
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        className={`w-full h-full object-cover transition-transform duration-500 ${onClick ? 'group-hover:scale-105' : ''}`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                        <div className="transform scale-150 opacity-50">
                            <Icons.Gift />
                        </div>
                    </div>
                )}

                {/* Badges superpuestos */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${priorityColors[item.priority]}`}>
                        {priorityLabels[item.priority]}
                    </span>
                </div>

                {/* Reservation Overlay (if reserved by other) */}
                {isReservedByOther && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="bg-white/90 dark:bg-zinc-900/90 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300 shadow-lg">
                            <Icons.Lock />
                            Reservado
                        </div>
                    </div>
                )}

                {/* Reserved by me Badge */}
                {isReservedByMe && (
                    <div className="absolute top-3 left-3">
                        <span className="bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                            <Icons.Check />
                            Reservado por ti
                        </span>
                    </div>
                )}
            </div>

            {/* Contenido */}
            <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-white line-clamp-2 leading-tight">
                        {item.title}
                    </h3>
                </div>

                {item.notes && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
                        {item.notes}
                    </p>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between text-sm">
                    <div className={item.price
                        ? "font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-800/30 text-sm shadow-sm"
                        : "text-zinc-400 text-sm font-normal italic pl-1"
                    }>
                        {item.price ? `${item.price} €` : 'Sin precio'}
                    </div>

                    {item.links.length > 0 && (
                        <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md text-xs font-medium">
                            <Icons.Link />
                            <span>{item.links.length}</span>
                        </div>
                    )}
                </div>

                {/* Owner Actions: Já lo tengo (Quick Delete) */}
                {isOwner && (
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('¿Ya tienes este artículo? Se eliminará de tu lista.')) {
                                    onDelete && onDelete(item);
                                }
                            }}
                            className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        >
                            <Icons.Check />
                            Ya lo tengo
                        </button>
                    </div>
                )}

                {/* Reservation Actions (Only for non-owners) */}
                {!isOwner && (
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        {isAvailable && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReserve && onReserve(item);
                                }}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Icons.Gift />
                                Reservar
                            </button>
                        )}

                        {isReservedByMe && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelReserve && onCancelReserve(item);
                                }}
                                className="w-full py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Icons.X />
                                Cancelar reserva
                            </button>
                        )}

                        {isReservedByOther && (
                            <button
                                disabled
                                className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Icons.Lock />
                                Reservado por otro
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface UserProfileData {
    id: string;
    display_name: string;
    avatar_url: string;
    shirt_size?: string;
    pants_size?: string;
    shoe_size?: string;
    favorite_brands?: string;
    favorite_color?: string;
}

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: UserProfileData | null;
}

export function UserProfileModal({ isOpen, onClose, profile }: UserProfileModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isOpen || !profile) return null;

    const hasStyleInfo = profile.shirt_size || profile.pants_size || profile.shoe_size || profile.favorite_brands || profile.favorite_color;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header/Cover */}
                <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

                <div className="px-6 pb-8 pt-0 relative">
                    {/* Avatar */}
                    <div className="absolute -top-12 left-6">
                        <div className="w-24 h-24 rounded-2xl bg-white dark:bg-zinc-900 p-1.5 shadow-xl">
                            <div className="w-full h-full rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl overflow-hidden border border-zinc-100 dark:border-zinc-700">
                                {profile.avatar_url && profile.avatar_url.startsWith('http') ? (
                                    <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                                ) : (
                                    profile.avatar_url || '👤'
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-14 mb-8">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {profile.display_name}
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                            Perfil de Miembro
                        </p>
                    </div>

                    <div className="space-y-6">
                        {!hasStyleInfo ? (
                            <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">
                                    Este usuario no ha completado su perfil de estilo aún.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Sizes */}
                                {(profile.shirt_size || profile.pants_size || profile.shoe_size) && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Tallas</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {profile.shirt_size && (
                                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Camiseta</p>
                                                    <p className="font-bold text-zinc-900 dark:text-white uppercase">{profile.shirt_size}</p>
                                                </div>
                                            )}
                                            {profile.pants_size && (
                                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Pantalón</p>
                                                    <p className="font-bold text-zinc-900 dark:text-white uppercase">{profile.pants_size}</p>
                                                </div>
                                            )}
                                            {profile.shoe_size && (
                                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Calzado</p>
                                                    <p className="font-bold text-zinc-900 dark:text-white uppercase">{profile.shoe_size}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Color */}
                                {profile.favorite_color && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Color Favorito</h3>
                                        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                            <div
                                                className="w-8 h-8 rounded-lg border border-black/10 shadow-sm"
                                                style={{ backgroundColor: profile.favorite_color.toLowerCase() }}
                                            />
                                            <span className="font-bold text-zinc-900 dark:text-white">{profile.favorite_color}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Brands */}
                                {profile.favorite_brands && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Marcas Preferidas</h3>
                                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                            <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed font-medium">
                                                {profile.favorite_brands}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-8 py-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

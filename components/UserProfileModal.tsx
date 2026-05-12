"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
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
    const titleId = useId();
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen || !profile) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        const t = window.requestAnimationFrame(() => {
            document.getElementById(titleId)?.focus?.();
        });

        return () => {
            window.cancelAnimationFrame(t);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, profile, onClose, titleId]);

    useEffect(() => {
        if (isOpen) return;
        previouslyFocused.current?.focus?.();
    }, [isOpen]);

    if (!mounted || !isOpen || !profile) return null;

    const hasStyleInfo = profile.shirt_size || profile.pants_size || profile.shoe_size || profile.favorite_brands || profile.favorite_color;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
            <div
                className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
                aria-hidden
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-ambient-lg overflow-hidden animate-in zoom-in-95 fade-in duration-300 ring-1 ring-outline-variant/10"
            >
                <div className="h-24 bg-gradient-to-br from-primary to-primary-container" aria-hidden />

                <div className="px-6 pb-8 pt-0 relative">
                    <div className="absolute -top-12 left-6">
                        <div className="w-24 h-24 rounded-2xl bg-surface-container-lowest p-1.5 shadow-xl" aria-hidden>
                            <div className="w-full h-full rounded-xl bg-surface-container-low flex items-center justify-center text-4xl overflow-hidden">
                                {profile.avatar_url && profile.avatar_url.startsWith('http') ? (
                                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span aria-hidden>{profile.avatar_url || '👤'}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-14 mb-8">
                        <h2 id={titleId} tabIndex={-1} className="text-2xl font-display text-on-background outline-none">
                            {profile.display_name}
                        </h2>
                        <p className="text-on-surface/55 text-sm font-sans">
                            Perfil de miembro
                        </p>
                    </div>

                    <div className="space-y-6">
                        {!hasStyleInfo ? (
                            <div className="py-8 text-center bg-surface-container-low rounded-2xl">
                                <p className="text-on-surface/55 text-sm italic font-sans">
                                    Este usuario no ha completado su perfil de estilo aún.
                                </p>
                            </div>
                        ) : (
                            <>
                                {(profile.shirt_size || profile.pants_size || profile.shoe_size) && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-wider">Tallas</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {profile.shirt_size && (
                                                <div className="p-3 bg-surface-container-low rounded-xl">
                                                    <p className="text-[10px] text-on-surface/45 mb-1 font-sans">Camiseta</p>
                                                    <p className="font-sans-bold text-on-background uppercase">{profile.shirt_size}</p>
                                                </div>
                                            )}
                                            {profile.pants_size && (
                                                <div className="p-3 bg-surface-container-low rounded-xl">
                                                    <p className="text-[10px] text-on-surface/45 mb-1 font-sans">Pantalón</p>
                                                    <p className="font-sans-bold text-on-background uppercase">{profile.pants_size}</p>
                                                </div>
                                            )}
                                            {profile.shoe_size && (
                                                <div className="p-3 bg-surface-container-low rounded-xl">
                                                    <p className="text-[10px] text-on-surface/45 mb-1 font-sans">Calzado</p>
                                                    <p className="font-sans-bold text-on-background uppercase">{profile.shoe_size}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {profile.favorite_color && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-wider">Color favorito</h3>
                                        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                                            <div
                                                className="w-8 h-8 rounded-lg border border-black/10 shadow-sm"
                                                style={{ backgroundColor: profile.favorite_color.toLowerCase() }}
                                                role="img"
                                                aria-label={`Muestra de color: ${profile.favorite_color}`}
                                            />
                                            <span className="font-sans-bold text-on-background">{profile.favorite_color}</span>
                                        </div>
                                    </div>
                                )}

                                {profile.favorite_brands && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-wider">Marcas preferidas</h3>
                                        <div className="p-4 bg-surface-container-low rounded-xl">
                                            <p className="text-on-background text-sm leading-relaxed font-sans-medium">
                                                {profile.favorite_brands}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full mt-8 py-3.5 bg-surface-container-high hover:opacity-90 text-primary rounded-full font-sans-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

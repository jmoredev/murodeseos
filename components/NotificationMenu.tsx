'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '@/lib/notification-utils';
import { NotificationItem } from './NotificationItem';
import { createPortal } from 'react-dom';

interface NotificationMenuProps {
    userId: string;
}

export function NotificationMenu({ userId }: NotificationMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isDesktop, setIsDesktop] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dialogTitleId = 'notifications-dialog-title';
    const previouslyFocused = useRef<HTMLElement | null>(null);

    // Cargar notificaciones iniciales y configurar suscripción
    const loadNotifications = async () => {
        if (!userId) return;
        try {
            const data = await getNotifications(userId);
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setIsMounted(true);
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 640);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);

        loadNotifications();

        const channel = supabase
            .channel(`notifications_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('resize', checkDesktop);
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // Cerrar al hacer click fuera (solo modo escritorio)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isDesktop && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDesktop]);

    // Focus management + Escape close (web)
    useEffect(() => {
        if (!isOpen) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Defer focus until DOM is painted.
        const t = window.setTimeout(() => {
            const el = document.getElementById(dialogTitleId);
            el?.focus?.();
        }, 0);

        return () => {
            window.clearTimeout(t);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) return;
        // Restore focus after closing.
        (previouslyFocused.current || buttonRef.current)?.focus?.();
    }, [isOpen]);

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.is_read) {
            await markAsRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead(userId);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const NotificationList = (
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            {loading ? (
                <div className="flex-1 flex items-center justify-center p-12 text-on-surface/50 italic text-sm font-sans">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-primary/25 border-t-primary rounded-full animate-spin"></div>
                        <span>Cargando notificaciones...</span>
                    </div>
                </div>
            ) : notifications.length > 0 ? (
                <div className="flex flex-col gap-1 py-2">
                    {notifications.map(n => (
                        <NotificationItem
                            key={n.id}
                            notification={n}
                            onClick={handleNotificationClick}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full">
                    <div className="text-6xl mb-6 opacity-20">🔔</div>
                    <h4 className="text-on-background font-display text-xl mb-2">Sin notificaciones</h4>
                    <p className="text-on-surface/55 text-sm max-w-[240px] leading-relaxed font-sans">
                        Te avisaremos cuando pase algo importante en tus grupos o listas de deseos.
                    </p>
                </div>
            )}
        </div>
    );

    if (!isMounted) return null;

    return (
        <div className="relative" ref={menuRef}>
            {/* Botón de Campana */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-on-surface/60 hover:bg-surface-container-low transition-all active:scale-90"
                aria-label="Ver notificaciones"
            >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary text-on-primary text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-surface-container-lowest animate-in zoom-in-50 duration-300">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {/* VISTA ESCRITORIO (Bocadillo Flotante) */}
            {isOpen && isDesktop && (
                <div
                    className="absolute right-0 mt-3 w-96 bg-surface/90 backdrop-blur-xl rounded-3xl shadow-ambient-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col ring-1 ring-outline-variant/10"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={dialogTitleId}
                >
                    <div className="p-5 bg-surface-container-low flex justify-between items-center shrink-0">
                        <h3 id={dialogTitleId} tabIndex={-1} className="font-display text-lg text-on-background">
                            Notificaciones
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-sans-bold text-primary hover:opacity-80 transition-colors"
                            >
                                Leer todas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[500px] flex flex-col overflow-hidden">
                        {NotificationList}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 bg-surface-container-low text-center shrink-0">
                            <span className="text-[10px] uppercase tracking-widest font-sans-bold text-on-surface/45">Sólo las últimas 20</span>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA MÓVIL (Pantalla Completa Real) */}
            {isOpen && !isDesktop && createPortal(
                <div
                    className="fixed inset-0 z-[200] bg-surface flex flex-col animate-in slide-in-from-bottom duration-300"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={dialogTitleId}
                >
                    <div className="flex items-center justify-between p-4 h-20 shrink-0 bg-surface-container-low">
                        <div className="flex flex-col">
                            <h2 id={dialogTitleId} tabIndex={-1} className="text-2xl font-display text-on-background">
                                Notificaciones
                            </h2>
                            {unreadCount > 0 && <span className="text-xs font-sans-medium text-primary">Tienes {unreadCount} por leer</span>}
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-container-lowest text-on-background active:scale-90 transition-transform shadow-ambient"
                            aria-label="Cerrar notificaciones"
                        >
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {unreadCount > 0 && (
                            <div className="p-4 bg-surface-container-low shrink-0">
                                <button
                                    onClick={handleMarkAllRead}
                                    className="w-full py-3 bg-surface-container-lowest rounded-xl text-center text-sm font-sans-bold text-primary shadow-ambient ring-1 ring-outline-variant/10"
                                >
                                    Marcar todas como leídas
                                </button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            {NotificationList}
                        </div>
                    </div>

                    <div className="p-6 bg-surface-container-low pb-safe shrink-0">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full py-4 bg-on-background text-surface-container-lowest rounded-2xl font-sans-bold text-lg shadow-ambient-lg active:scale-95 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

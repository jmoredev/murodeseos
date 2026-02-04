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
                <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 italic text-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span>Cargando notificaciones...</span>
                    </div>
                </div>
            ) : notifications.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                    <h4 className="text-zinc-900 dark:text-white font-extrabold text-xl mb-2">Sin notificaciones</h4>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[240px] leading-relaxed">
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
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
                aria-label="Ver notificaciones"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 animate-in zoom-in-50 duration-300">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {/* VISTA ESCRITORIO (Bocadillo Flotante) */}
            {isOpen && isDesktop && (
                <div className="absolute right-0 mt-3 w-96 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col">
                    <div className="p-5 bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                            >
                                Leer todas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[500px] flex flex-col overflow-hidden">
                        {NotificationList}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 text-center shrink-0">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Sólo las últimas 20</span>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA MÓVIL (Pantalla Completa Real) */}
            {isOpen && !isDesktop && createPortal(
                <div className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 h-20 shrink-0 bg-white dark:bg-zinc-950">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Notificaciones</h2>
                            {unreadCount > 0 && <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Tienes {unreadCount} por leer</span>}
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white active:scale-90 transition-transform"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {unreadCount > 0 && (
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/20 shrink-0">
                                <button
                                    onClick={handleMarkAllRead}
                                    className="w-full py-3 bg-white dark:bg-zinc-900 rounded-xl text-center text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/30"
                                >
                                    Marcar todas como leídas
                                </button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            {NotificationList}
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 pb-safe shrink-0">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all"
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

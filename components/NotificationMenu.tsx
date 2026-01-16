'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '@/lib/notification-utils';
import { NotificationItem } from './NotificationItem';

interface NotificationMenuProps {
    userId: string;
}

export function NotificationMenu({ userId }: NotificationMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    // Cargar notificaciones iniciales
    const loadNotifications = async () => {
        try {
            const data = await getNotifications(userId);
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch (error) {
            console.error('Error loading notifications:', error);
            if (error && typeof error === 'object') {
                console.error('Error details:', JSON.stringify(error, null, 2));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) return;
        loadNotifications();

        // Suscripción Realtime
        const channel = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    // Recargar para obtener los datos con join
                    loadNotifications();
                    // Opcional: Sonido o aviso visual
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.is_read) {
            await markAsRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        // Aquí podrías añadir navegación al deseo o grupo si fuera necesario
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead(userId);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Campana */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
                aria-label="Notificaciones"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 animate-in zoom-in-50 duration-300">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-900 dark:text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                            >
                                Leer todas
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto no-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-400 italic text-sm">Cargando...</div>
                        ) : notifications.length > 0 ? (
                            notifications.map(n => (
                                <NotificationItem
                                    key={n.id}
                                    notification={n}
                                    onClick={handleNotificationClick}
                                />
                            ))
                        ) : (
                            <div className="p-12 text-center">
                                <div className="text-4xl mb-4 opacity-20">🔔</div>
                                <h4 className="text-zinc-900 dark:text-white font-bold mb-1">Sin notificaciones</h4>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Te avisaremos cuando pase algo importante.</p>
                            </div>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800 text-center">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Sólo las últimas 20</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

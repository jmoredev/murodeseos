'use client';

import React from 'react';
import { Notification } from '@/lib/notification-utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItemProps {
    notification: Notification;
    onClick: (notification: Notification) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const isWishAdded = notification.type === 'wish_added';

    // Iconos y colores según el tipo
    const icon = isWishAdded ? '✨' : '🎁';
    const bgColor = isWishAdded ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30';

    // Texto de la notificación
    const actorName = notification.actor?.display_name || 'Alguien';
    const groupName = notification.group?.name || 'un grupo';
    const wishTitle = notification.wish?.title || 'un deseo';

    const content = isWishAdded ? (
        <>
            <span className="font-bold text-zinc-900 dark:text-white">{actorName}</span> ha añadido "
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{wishTitle}</span>" en
            <span className="font-medium text-zinc-700 dark:text-zinc-300"> {groupName}</span>.
        </>
    ) : (
        <>
            <span className="font-bold text-zinc-900 dark:text-white">{actorName}</span> ha reservado "
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{wishTitle}</span>" en
            <span className="font-medium text-zinc-700 dark:text-zinc-300"> {groupName}</span>.
        </>
    );

    return (
        <div
            onClick={() => onClick(notification)}
            className={`flex gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${!notification.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
        >
            <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center text-2xl flex-shrink-0 animate-in zoom-in-50 duration-300`}>
                {notification.actor?.avatar_url && notification.actor.avatar_url.startsWith('http') ? (
                    <img src={notification.actor.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                    notification.actor?.avatar_url || icon
                )}
                {!notification.is_read && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white dark:border-zinc-900" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug mb-1.5">
                    {content}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                </p>
            </div>
        </div>
    );
}

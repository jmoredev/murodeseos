'use client';

import React from 'react';
import { Notification } from '@/lib/notification-utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItemProps {
    notification: Notification;
    onClick: (notification: Notification) => void;
}

function wishTitleFromNotification(notification: Notification): string {
    const raw = notification.metadata?.wish_title;
    if (typeof raw === 'string' && raw.trim()) return raw;
    return notification.wish?.title || 'un deseo';
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const actorName = notification.actor?.display_name || 'Alguien';
    const groupName = notification.group?.name || 'un grupo';
    const wishTitle = wishTitleFromNotification(notification);

    let icon: string;
    let bgColor: string;
    let content: React.ReactNode;
    let summary: string;

    switch (notification.type) {
        case 'wish_added':
            icon = '✨';
            bgColor = 'bg-secondary/15';
            content = (
                <>
                    <span className="font-sans-bold text-on-background">{actorName}</span> ha añadido &quot;
                    <span className="font-sans-semibold text-primary">{wishTitle}</span>&quot; en
                    <span className="font-sans-medium text-on-surface/70"> {groupName}</span>.
                </>
            );
            summary = `${actorName} añadió el deseo ${wishTitle} en ${groupName}`;
            break;
        case 'wish_reserved':
            icon = '🎁';
            bgColor = 'bg-primary/10';
            content = (
                <>
                    <span className="font-sans-bold text-on-background">{actorName}</span> ha reservado &quot;
                    <span className="font-sans-semibold text-primary">{wishTitle}</span>&quot; en
                    <span className="font-sans-medium text-on-surface/70"> {groupName}</span>.
                </>
            );
            summary = `${actorName} reservó el deseo ${wishTitle} en ${groupName}`;
            break;
        case 'wish_deleted_by_owner':
            icon = '📭';
            bgColor = 'bg-tertiary/15';
            content = (
                <>
                    <span className="font-sans-bold text-on-background">{actorName}</span> eliminó &quot;
                    <span className="font-sans-semibold text-primary">{wishTitle}</span>&quot;, que tenías reservado
                    {notification.group_id ? (
                        <>
                            {' '}
                            en<span className="font-sans-medium text-on-surface/70"> {groupName}</span>
                        </>
                    ) : null}
                    .
                </>
            );
            summary = `${actorName} eliminó el deseo ${wishTitle} que tenías reservado`;
            break;
        case 'draw_performed':
            icon = '🎅';
            bgColor = 'bg-secondary/15';
            content = (
                <>
                    <span className="font-sans-bold text-on-background">{actorName}</span> ha realizado el sorteo
                    del Amigo Invisible en
                    <span className="font-sans-medium text-on-surface/70"> {groupName}</span>.
                </>
            );
            summary = `${actorName} realizó el sorteo en ${groupName}`;
            break;
        default:
            icon = '🔔';
            bgColor = 'bg-surface-container-high';
            content = <span className="text-on-surface/70">Notificación</span>;
            summary = 'Notificación';
            break;
    }

    return (
        <button
            type="button"
            onClick={() => onClick(notification)}
            aria-label={summary}
            className={`flex gap-4 p-4 rounded-xl mx-2 mb-1 w-[calc(100%-1rem)] text-left hover:bg-surface-container-low transition-colors cursor-pointer border-0 ${!notification.is_read ? 'bg-surface-container-low/80' : 'bg-surface-container-lowest'}`}
        >
            <div className={`relative w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center text-2xl flex-shrink-0 animate-in zoom-in-50 duration-300`} aria-hidden>
                {notification.actor?.avatar_url && notification.actor.avatar_url.startsWith('http') ? (
                    <img src={notification.actor.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                    notification.actor?.avatar_url || icon
                )}
                {!notification.is_read && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full ring-2 ring-surface-container-lowest" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface/70 leading-snug mb-1.5 font-sans">
                    {content}
                </p>
                <p className="text-[10px] font-sans-bold uppercase tracking-wider text-on-surface/45 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-outline-variant/40" aria-hidden />
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                </p>
            </div>
        </button>
    );
}

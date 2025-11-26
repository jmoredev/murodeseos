"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export interface GroupMember {
    id: string;
    name: string;
    avatar?: string;
}

export interface Group {
    id: string;
    name: string;
    icon: string;
    members: GroupMember[];
}

interface GroupCardProps {
    group: Group;
    isAdmin?: boolean;
    onShare: (groupId: string) => void;
    onRename?: (groupId: string, currentName: string) => void;
    onDelete?: (groupId: string, groupName: string) => void;
}

export function GroupCard({ group, isAdmin, onShare, onRename, onDelete }: GroupCardProps) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleCardClick = () => {
        router.push(`/groups/${group.id}`);
    };

    const handleShareClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onShare(group.id);
    };

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(!menuOpen);
    };

    const handleRenameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (onRename) onRename(group.id, group.name);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (onDelete) onDelete(group.id, group.name);
    };

    // Logic for truncating members
    const displayMembers = group.members.slice(0, 3);
    const remainingCount = group.members.length - 3;

    return (
        <div
            onClick={handleCardClick}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition-all cursor-pointer hover:shadow-md relative overflow-visible group"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-2xl shadow-inner">
                        {group.icon}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-tight">
                            {group.name}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                            {group.members.length} participantes
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={handleShareClick}
                        className="p-2.5 rounded-full bg-zinc-50 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        aria-label="Compartir código de grupo"
                    >
                        {/* Share Icon SVG */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                    </button>

                    {isAdmin && (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={handleMenuClick}
                                className="p-2.5 rounded-full bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                aria-label="Opciones de grupo"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-700 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        onClick={handleRenameClick}
                                        className="w-full text-left px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        Cambiar nombre
                                    </button>
                                    <button
                                        onClick={handleDeleteClick}
                                        className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        Eliminar grupo
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Members List */}
            <div className="space-y-2.5">
                {displayMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                            {/* Avatar: Check if it's a URL, emoji, or use initials */}
                            {member.avatar && member.avatar.startsWith('http') ? (
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                            ) : member.avatar ? (
                                <div className="w-full h-full flex items-center justify-center text-sm">
                                    {member.avatar}
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate">
                            {member.name}
                        </span>
                    </div>
                ))}
                {remainingCount > 0 && (
                    <div className="text-xs font-medium text-zinc-400 pl-10">
                        ... y {remainingCount} más
                    </div>
                )}
            </div>
        </div>
    );
}

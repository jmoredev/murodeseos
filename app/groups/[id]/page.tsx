"use client";

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Group, GroupMember } from '@/components/GroupCard';
import { removeMemberFromGroup, shareGroup } from '@/lib/group-utils';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<GroupMember | null>(null);

    useEffect(() => {
        const fetchGroupDetails = async () => {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }
                setCurrentUserId(user.id);

                // Fetch group info
                const { data: groupData, error: groupError } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (groupError) throw groupError;

                // Fetch members for this group
                const { data: membersData, error: membersError } = await supabase
                    .from('group_members')
                    .select('user_id, role')
                    .eq('group_id', id);

                if (membersError) throw membersError;

                // Get profiles for all members
                const userIds = membersData.map(m => m.user_id);
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, display_name, avatar_url')
                    .in('id', userIds);

                if (profilesError) throw profilesError;

                // Create a map of user profiles
                const profilesMap = new Map(profilesData.map(p => [p.id, p]));

                // Transform members data
                const members: GroupMember[] = membersData.map((m: { user_id: string; role: string }) => {
                    const profile = profilesMap.get(m.user_id);
                    return {
                        id: m.user_id,
                        name: profile?.display_name || 'Usuario',
                        avatar: profile?.avatar_url
                    };
                });

                setGroup({
                    id: groupData.id,
                    name: groupData.name,
                    icon: groupData.icon,
                    members: members
                });

                // Check admin status
                const currentUserMember = membersData.find((m: { user_id: string; role: string }) => m.user_id === user.id);
                setIsAdmin(currentUserMember?.role === 'admin');

            } catch (error) {
                console.error('Error fetching group details:', error);
                // Handle error (maybe redirect or show toast)
            } finally {
                setLoading(false);
            }
        };

        fetchGroupDetails();
    }, [id, router]);

    const handleRemoveMember = async () => {
        if (!memberToDelete || !group) return;

        try {
            await removeMemberFromGroup(group.id, memberToDelete.id);

            // Update local state
            setGroup(prev => prev ? ({
                ...prev,
                members: prev.members.filter(m => m.id !== memberToDelete.id)
            }) : null);

            // Show success message (could use a toast library here)
            // alert(`Usuario ${memberToDelete.name} eliminado correctamente`);

        } catch (error) {
            console.error('Error removing member:', error);
            alert('Error al eliminar usuario');
        }
    };

    const handleShare = async () => {
        if (!group) return;
        await shareGroup(group.name, group.id);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center p-4">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Grupo no encontrado</h1>
                <button
                    onClick={() => router.back()}
                    className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                    Volver atrás
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div className="flex-1 min-w-0 text-center pr-10">
                        <h1 className="text-lg font-bold text-zinc-900 dark:text-white truncate flex items-center justify-center gap-2">
                            <span className="text-xl">{group.icon}</span>
                            {group.name}
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                {/* Draw Placeholder */}
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 text-center border border-indigo-100 dark:border-indigo-900/30 border-dashed">
                    <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">
                        🎁
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        El sorteo aún no ha comenzado
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                        Espera a que el administrador inicie el sorteo para ver a quién te toca regalar.
                    </p>
                </div>

                {/* Participants List */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Participantes ({group.members.length})
                        </h2>
                    </div>

                    {group.members.length === 1 ? (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="29" y2="8" /><line x1="24" y1="3" x2="24" y2="13" /></svg>
                            </div>
                            <p className="text-zinc-600 dark:text-zinc-300 font-medium mb-1">
                                Estás solo en este grupo
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                ¡Invita a tus amigos o familiares para empezar!
                            </p>
                            <button
                                onClick={handleShare}
                                className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline"
                            >
                                Invitar ahora
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {group.members.map((member) => (
                                <div
                                    key={member.id}
                                    onClick={() => {
                                        if (member.id !== currentUserId) {
                                            router.push(`/wishlist/${member.id}?name=${encodeURIComponent(member.name)}`);
                                        }
                                    }}
                                    className={`p-4 flex items-center justify-between group transition-colors ${member.id !== currentUserId
                                        ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                                            {member.avatar && member.avatar.startsWith('http') ? (
                                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                            ) : member.avatar ? (
                                                <div className="w-full h-full flex items-center justify-center text-lg">
                                                    {member.avatar}
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                {member.name}
                                                {member.id === currentUserId && (
                                                    <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                                                        Tú
                                                    </span>
                                                )}
                                            </p>
                                            {member.id !== currentUserId && (
                                                <p className="text-xs text-zinc-400 mt-0.5">Ver lista de deseos →</p>
                                            )}
                                        </div>
                                    </div>

                                    {isAdmin && member.id !== currentUserId && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMemberToDelete(member);
                                            }}
                                            className="p-2 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            aria-label="Expulsar usuario"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Action Button for Share */}
            <div className="fixed bottom-6 right-6 z-20">
                <button
                    onClick={handleShare}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    <span className="font-medium pr-1">Invitar</span>
                </button>
            </div>

            <ConfirmModal
                isOpen={!!memberToDelete}
                onClose={() => setMemberToDelete(null)}
                onConfirm={handleRemoveMember}
                title="Expulsar participante"
                message={`¿Estás seguro que deseas expulsar a ${memberToDelete?.name} del grupo? Esta acción no se puede deshacer.`}
                confirmText="Expulsar"
                isDestructive={true}
            />
        </div>
    );
}

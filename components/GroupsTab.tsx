'use client'

import { useEffect, useState } from 'react'
import Link from "next/link";
import { supabase } from '@/lib/supabase'
import { GroupCard, Group } from '@/components/GroupCard';
import { updateGroupName, deleteGroup } from '@/lib/group-utils';
import { getUserAliases, setUserAlias } from '@/lib/aliases';

interface GroupsTabProps {
    userId: string;
}

export function GroupsTab({ userId }: GroupsTabProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [groupToRename, setGroupToRename] = useState<{ id: string, name: string } | null>(null);
    const [newName, setNewName] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<{ id: string, name: string } | null>(null);
    const [userRoles, setUserRoles] = useState<Map<string, string>>(new Map());

    // Almacenamos aliases localmente para refresco rápido
    const [aliases, setAliases] = useState<Record<string, string>>({});

    const fetchUserGroups = async (userId: string) => {
        try {
            const { data: myMemberships, error: membershipError } = await supabase
                .from('group_members')
                .select('group_id, role')
                .eq('user_id', userId)

            if (membershipError) {
                console.error('Error fetching memberships:', membershipError)
                throw membershipError
            }

            if (!myMemberships || myMemberships.length === 0) {
                setGroups([])
                setLoading(false)
                return
            }

            const groupIds = myMemberships.map(m => m.group_id)

            const rolesMap = new Map();
            myMemberships.forEach(m => {
                rolesMap.set(m.group_id, m.role);
            });
            setUserRoles(rolesMap);

            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('id, name, icon')
                .in('id', groupIds)

            if (groupsError) {
                console.error('Error fetching groups:', groupsError)
                throw groupsError
            }

            const { data: membersData, error: membersError } = await supabase
                .from('group_members')
                .select('group_id, user_id')
                .in('group_id', groupIds)

            if (membersError) {
                console.error('Error fetching members:', membersError)
                throw membersError
            }

            const userIdsItems = [...new Set(membersData.map(m => m.user_id))]
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url')
                .in('id', userIdsItems)

            if (profilesError) {
                console.error('Error fetching profiles:', profilesError)
                throw profilesError
            }

            const profilesMap = new Map(profilesData.map(p => [p.id, p]))

            // Obtener apodos
            const userAliases = await getUserAliases();
            setAliases(userAliases);

            const formattedGroups: Group[] = groupsData.map(g => {
                const allGroupMembers = membersData.filter(m => m.group_id === g.id)

                const groupMembers = allGroupMembers
                    .filter(m => m.user_id !== userId)
                    .map(m => {
                        const profile = profilesMap.get(m.user_id)
                        const alias = userAliases[m.user_id];
                        return {
                            id: m.user_id,
                            name: alias || profile?.display_name || 'Usuario',
                            originalName: alias ? (profile?.display_name || 'Usuario') : undefined,
                            avatar: profile?.avatar_url
                        }
                    })

                return {
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    members: groupMembers
                }
            })

            setGroups(formattedGroups)

        } catch (error) {
            console.error('Error fetching groups:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        fetchUserGroups(userId)
    }, [userId])

    const handleShare = (groupId: string) => {
        setSelectedGroupId(groupId);
        setShareModalOpen(true);
    };

    const closeShareModal = () => {
        setShareModalOpen(false);
        setTimeout(() => setSelectedGroupId(null), 300);
    };

    const copyToClipboard = async () => {
        if (selectedGroupId) {
            try {
                await navigator.clipboard.writeText(selectedGroupId);
                alert('¡Código copiado al portapapeles!');
            } catch (err) {
                console.error('Failed to copy', err);
            }
        }
    };

    const shareNative = async () => {
        if (selectedGroupId && typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: 'Únete a mi grupo en Muro de Deseos',
                    text: `Usa el código: ${selectedGroupId}`,
                    url: window.location.origin + '/groups/join?code=' + selectedGroupId
                });
            } catch (err) {

            }
        } else {
            copyToClipboard();
        }
    };

    const openRenameModal = (groupId: string, currentName: string) => {
        setGroupToRename({ id: groupId, name: currentName });
        setNewName(currentName);
        setRenameModalOpen(true);
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupToRename || !newName.trim()) return;

        try {
            await updateGroupName(groupToRename.id, newName.trim());

            setGroups(groups.map(g =>
                g.id === groupToRename.id ? { ...g, name: newName.trim() } : g
            ));

            // Invalidate cache
            sessionStorage.removeItem(`groups_${userId}`);

            setRenameModalOpen(false);
            setGroupToRename(null);
        } catch (error) {
            console.error('Error renaming group:', error);
            alert('Error al renombrar el grupo');
        }
    };

    const openDeleteModal = (groupId: string, currentName: string) => {
        setGroupToDelete({ id: groupId, name: currentName });
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!groupToDelete) return;

        try {
            await deleteGroup(groupToDelete.id);

            setGroups(groups.filter(g => g.id !== groupToDelete.id));

            // Invalidate cache
            sessionStorage.removeItem(`groups_${userId}`);

            setDeleteModalOpen(false);
            setGroupToDelete(null);
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Error al eliminar el grupo');
        }
    };

    const handleMemberEdit = async (memberId: string, newAlias: string): Promise<boolean> => {
        try {
            const success = await setUserAlias(memberId, newAlias);
            if (success) {
                // Actualizar estado local
                const updatedAliases = { ...aliases };
                if (newAlias.trim()) {
                    updatedAliases[memberId] = newAlias.trim();
                } else {
                    delete updatedAliases[memberId];
                }
                setAliases(updatedAliases);

                // Actualizar grupos
                setGroups(groups.map(g => ({
                    ...g,
                    members: g.members.map(m => {
                        if (m.id === memberId) {
                            return {
                                ...m,
                                name: newAlias.trim() || m.originalName || m.name,
                                originalName: newAlias.trim() ? (m.originalName || m.name) : undefined
                            };
                        }
                        return m;
                    })
                })));
            }
            return success;
        } catch (error) {
            console.error('Error setting alias:', error);
            return false;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">Cargando grupos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 pb-24">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 pt-4 max-w-5xl mx-auto">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mis grupos</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Gestiona tus intercambios</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/groups/join"
                        className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg hover:bg-purple-700 transition-colors"
                        title="Unirse a grupo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </Link>
                    <Link
                        href="/groups/create"
                        className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
                        title="Crear grupo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </Link>
                </div>
            </header>

            {/* Group List */}
            <div className="max-w-5xl mx-auto">
                {groups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groups.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                isAdmin={userRoles.get(group.id) === 'admin'}
                                onShare={handleShare}
                                onRename={openRenameModal}
                                onDelete={openDeleteModal}
                                onMemberEdit={handleMemberEdit}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 text-4xl">
                            🎁
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No tienes grupos aún</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mb-8">
                            Crea un nuevo grupo para empezar a organizar tus intercambios de regalos.
                        </p>
                        <div className="flex gap-3 w-full max-w-xs">
                            <Link href="/groups/join" className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium text-center hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                Unirse
                            </Link>
                            <Link href="/groups/create" className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-medium text-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
                                Crear
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {shareModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={closeShareModal}
                    ></div>

                    <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden"></div>

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Invita a tus amigos</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                                Comparte este código para que puedan unirse al grupo.
                            </p>
                        </div>

                        <div
                            onClick={copyToClipboard}
                            className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group"
                        >
                            <span className="text-3xl font-mono font-bold text-zinc-900 dark:text-white tracking-wider">
                                {selectedGroupId}
                            </span>
                            <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </div>
                        </div>

                        <button
                            onClick={shareNative}
                            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            Compartir enlace
                        </button>

                        <button
                            onClick={closeShareModal}
                            className="w-full mt-3 py-3 text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Cambiar nombre del grupo</h3>
                        <form onSubmit={handleRenameSubmit}>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-6"
                                placeholder="Nuevo nombre"
                                autoFocus
                                required
                                minLength={3}
                            />
                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setRenameModalOpen(false)}
                                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20 transition-all"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">¿Eliminar grupo?</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                            Estás a punto de eliminar el grupo <span className="font-bold text-zinc-900 dark:text-white">"{groupToDelete?.name}"</span>. Esta acción no se puede deshacer y se eliminarán todos los datos asociados.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setDeleteModalOpen(false)}
                                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg shadow-red-600/20 transition-all"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

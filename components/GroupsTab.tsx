import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, Platform } from 'react-native'
import { Link } from "expo-router"
import { supabase } from '@/lib/supabase'
import { GroupCard, Group } from '@/components/GroupCard'
import { updateGroupName, deleteGroup, setGroupAlias } from '@/lib/group-utils'
import { getUserAliases, setUserAlias } from '@/lib/aliases'

export interface GroupsTabProps {
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
                .select('group_id, role, group_alias')
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

            // Parallelize requests: group details, members with profiles, and aliases
            const [groupsResult, membersResult, userAliases] = await Promise.all([
                supabase
                    .from('groups')
                    .select('id, name, icon')
                    .in('id', groupIds),
                supabase
                    .from('group_members')
                    .select('group_id, user_id, profiles(id, display_name, avatar_url)')
                    .in('group_id', groupIds),
                getUserAliases()
            ]);

            if (groupsResult.error) {
                console.error('Error fetching groups:', groupsResult.error);
                throw groupsResult.error;
            }

            // Nota: si falla el join hacia `profiles`, igual queremos mostrar los grupos
            // para no dejar la UI en estado vacío (esto afecta e2e en móvil).
            let membersData: any[] = membersResult.data ?? [];
            if (membersResult.error) {
                console.error('Error fetching members (profiles enrich):', membersResult.error);
                membersData = [];
            }

            const groupsData = groupsResult.data;

            setAliases(userAliases);

            const formattedGroups: Group[] = groupsData.map(g => {
                const allGroupMembers = membersData.filter(m => m.group_id === g.id)

                const groupMembers = allGroupMembers
                    .filter(m => m.user_id !== userId)
                    .map(m => {
                        const profile: any = m.profiles;
                        const alias = userAliases[m.user_id];
                        return {
                            id: m.user_id,
                            name: alias || profile?.display_name || 'Usuario',
                            originalName: alias ? (profile?.display_name || 'Usuario') : undefined,
                            avatar: profile?.avatar_url
                        }
                    })

                const myMembership = myMemberships.find(m => m.group_id === g.id);
                const groupAlias = myMembership?.group_alias;

                return {
                    id: g.id,
                    name: groupAlias || g.name,
                    originalName: groupAlias ? g.name : undefined,
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
        if (selectedGroupId && Platform.OS === 'web') {
            try {
                await navigator.clipboard.writeText(selectedGroupId);
                alert('¡Código copiado al portapapeles!');
            } catch (err) {
                console.error('Failed to copy', err);
            }
        }
    };

    const shareNative = async () => {
        if (selectedGroupId && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
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

    const handleRenameSubmit = async () => {
        if (!groupToRename || !newName.trim()) return;

        try {
            await updateGroupName(groupToRename.id, newName.trim());

            setGroups(groups.map(g =>
                g.id === groupToRename.id ? { ...g, name: newName.trim() } : g
            ));

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
                            const realName = m.originalName || m.name;
                            const trimmedAlias = newAlias.trim();
                            const isSameAsOriginal = trimmedAlias === realName;

                            if (!trimmedAlias || isSameAsOriginal) {
                                return {
                                    ...m,
                                    name: realName,
                                    originalName: undefined
                                };
                            }

                            return {
                                ...m,
                                name: trimmedAlias,
                                originalName: realName
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

    const handleGroupAliasEdit = async (groupId: string, newAlias: string): Promise<boolean> => {
        try {
            const success = await setGroupAlias(groupId, userId, newAlias.trim());
            if (success) {
                setGroups(groups.map(g => {
                    if (g.id === groupId) {
                        const realName = g.originalName || g.name;
                        const trimmedAlias = newAlias.trim();
                        const isSameAsOriginal = trimmedAlias === realName;

                        if (!trimmedAlias || isSameAsOriginal) {
                            return { ...g, name: realName, originalName: undefined };
                        }

                        return { ...g, name: trimmedAlias, originalName: realName };
                    }
                    return g;
                }));
            }
            return success;
        } catch (error) {
            console.error('Error setting group alias:', error);
            return false;
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center p-20">
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text className="mt-4 text-zinc-500 font-medium">Cargando grupos...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 p-4 pb-20">
            {/* Header Local de la pestaña */}
            <View className="flex-row justify-between items-end mb-10 px-2">
                <View>
                    <Text className="text-3xl font-black text-zinc-900 dark:text-white">Mis grupos</Text>
                    <Text className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestiona tus intercambios</Text>
                </View>
                <View className="flex-row gap-3">
                    <Link href={"/groups/join" as any} asChild>
                        <Pressable className="w-12 h-12 rounded-2xl bg-purple-600 items-center justify-center shadow-lg shadow-purple-600/30">
                            <Text style={{ fontSize: 20 }}>👤</Text>
                        </Pressable>
                    </Link>
                    <Link href={"/groups/create" as any} asChild>
                        <Pressable className="w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-600/30">
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>+</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>

            {/* Group List Grid */}
            <View className="w-full">
                {groups.length > 0 ? (
                    <View className="flex-row flex-wrap -m-3">
                        {groups.map(group => (
                            <View key={group.id} className="w-full md:w-1/2 lg:w-1/3 p-3">
                                <GroupCard
                                    group={group}
                                    isAdmin={userRoles.get(group.id) === 'admin'}
                                    onShare={handleShare}
                                    onRename={openRenameModal}
                                    onDelete={openDeleteModal}
                                    onMemberEdit={handleMemberEdit}
                                    onGroupAliasEdit={handleGroupAliasEdit}
                                />
                            </View>
                        ))}
                    </View>
                ) : (
                    <View className="items-center justify-center py-20 px-6 text-center">
                        <View className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full items-center justify-center mb-6">
                            <Text style={{ fontSize: 40 }}>🎁</Text>
                        </View>
                        <Text className="text-2xl font-black text-zinc-900 dark:text-white mb-2">No tienes grupos aún</Text>
                        <Text className="text-zinc-500 dark:text-zinc-400 font-medium max-w-xs mb-8">
                            Crea un nuevo grupo para empezar a organizar tus intercambios de regalos.
                        </Text>
                        <View className="flex-row gap-4 w-full max-w-xs">
                            <Link href={"/groups/join" as any} asChild>
                                <Pressable className="flex-1 py-4 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 items-center">
                                    <Text className="text-zinc-900 dark:text-white font-bold">Unirse</Text>
                                </Pressable>
                            </Link>
                            <Link href={"/groups/create" as any} asChild>
                                <Pressable className="flex-1 py-4 rounded-2xl bg-indigo-600 items-center shadow-lg shadow-indigo-600/30">
                                    <Text className="text-white font-bold">Crear</Text>
                                </Pressable>
                            </Link>
                        </View>
                    </View>
                )}
            </View>

            {/* Modals are kept using React Native Modal or simple Views if triggered correctly */}
            {shareModalOpen ? (
                <View
                    className="absolute inset-0 z-[100] items-center justify-center px-4 bg-black/60"
                    style={Platform.OS === 'web' ? { position: 'fixed' as any } : {}}
                    accessibilityViewIsModal
                >
                    <Pressable className="absolute inset-0" onPress={closeShareModal} />
                    <View className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl">
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl items-center justify-center mb-4">
                                <Text style={{ fontSize: 32 }}>↗</Text>
                            </View>
                            <Text className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Invita a tus amigos</Text>
                            <Text className="text-zinc-500 dark:text-zinc-400 font-medium text-center">
                                Comparte este código para que puedan unirse al grupo.
                            </Text>
                        </View>

                        <Pressable
                            onPress={copyToClipboard}
                            className="bg-zinc-50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 mb-8 items-center justify-center active:border-indigo-500"
                        >
                            <Text className="text-4xl font-mono font-black text-zinc-900 dark:text-white tracking-widest uppercase">
                                {selectedGroupId}
                            </Text>
                            <Text className="text-[10px] font-bold text-zinc-400 mt-2 uppercase tracking-widest">Toca para copiar</Text>
                        </Pressable>

                        <Pressable
                            onPress={shareNative}
                            accessibilityRole="button"
                            accessibilityLabel="Compartir enlace"
                            className="w-full py-5 bg-indigo-600 rounded-2xl items-center justify-center shadow-xl shadow-indigo-600/30 active:scale-[0.98] mb-4"
                        >
                            <Text className="text-white font-black text-lg">Compartir enlace</Text>
                        </Pressable>

                        <Pressable
                            onPress={closeShareModal}
                            accessibilityRole="button"
                            accessibilityLabel="Cerrar"
                            className="w-full items-center py-2"
                        >
                            <Text className="text-zinc-400 font-bold">Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            {/* Rename Modal */}
            {renameModalOpen ? (
                <View
                    className="absolute inset-0 z-[100] items-center justify-center px-4 bg-black/60"
                    style={Platform.OS === 'web' ? { position: 'fixed' as any } : {}}
                    accessibilityViewIsModal
                >
                    <Pressable className="absolute inset-0" onPress={() => setRenameModalOpen(false)} />
                    <View className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl">
                        <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Cambiar nombre del grupo</Text>
                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            accessibilityLabel="Nuevo nombre del grupo"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all mb-6"
                            placeholder="Nuevo nombre"
                            autoFocus
                        />
                        <View className="flex-row gap-3 justify-end">
                            <Pressable
                                onPress={() => setRenameModalOpen(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancelar"
                                className="px-4 py-2"
                            >
                                <Text className="text-zinc-600 dark:text-zinc-400 font-medium">Cancelar</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleRenameSubmit}
                                accessibilityRole="button"
                                accessibilityLabel="Guardar"
                                className="px-4 py-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20"
                            >
                                <Text className="text-white font-medium">Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : null}

            {/* Delete Modal */}
            {deleteModalOpen ? (
                <View
                    className="absolute inset-0 z-[100] items-center justify-center px-4 bg-black/60"
                    style={Platform.OS === 'web' ? { position: 'fixed' as any } : {}}
                    accessibilityViewIsModal
                >
                    <Pressable className="absolute inset-0" onPress={() => setDeleteModalOpen(false)} />
                    <View className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl">
                        <View className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 items-center justify-center mb-4">
                            <Text style={{ fontSize: 24 }}>🗑</Text>
                        </View>
                        <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">¿Eliminar grupo?</Text>
                        <Text className="text-zinc-500 dark:text-zinc-400 mb-6 font-medium">
                            Estás a punto de eliminar el grupo <Text className="font-bold text-zinc-900 dark:text-white">"{groupToDelete?.name}"</Text>. Esta acción no se puede deshacer.
                        </Text>
                        <View className="flex-row gap-3 justify-end">
                            <Pressable
                                onPress={() => setDeleteModalOpen(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancelar"
                                className="px-4 py-2"
                            >
                                <Text className="text-zinc-600 dark:text-zinc-400 font-medium">Cancelar</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleDeleteConfirm}
                                accessibilityRole="button"
                                accessibilityLabel="Eliminar"
                                className="px-4 py-2 bg-red-600 rounded-lg shadow-lg shadow-red-600/20"
                            >
                                <Text className="text-white font-medium">Eliminar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

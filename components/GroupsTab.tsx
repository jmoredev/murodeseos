import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, Platform } from 'react-native'
import { Link, useRouter } from "expo-router"
import { supabase } from '@/lib/supabase'
import { GroupCard, Group } from '@/components/GroupCard'
import { updateGroupName, deleteGroup, setGroupAlias } from '@/lib/group-utils'
import { getUserAliases, setUserAlias } from '@/lib/aliases'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

export interface GroupsTabProps {
    userId: string;
}

export function GroupsTab({ userId }: GroupsTabProps) {
    const router = useRouter();
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

            // Parallelize: grupos, filas de membresía (sin embed) y aliases.
            // Los perfiles se cargan aparte como en `app/groups/[id]` — el select anidado
            // `profiles(...)` desde `group_members` a veces falla o devuelve vacío en PostgREST/RLS.
            const [groupsResult, membersResult, userAliases] = await Promise.all([
                supabase
                    .from('groups')
                    .select('id, name, icon')
                    .in('id', groupIds),
                supabase
                    .from('group_members')
                    .select('group_id, user_id')
                    .in('group_id', groupIds),
                getUserAliases()
            ]);

            if (groupsResult.error) {
                console.error('Error fetching groups:', groupsResult.error);
                throw groupsResult.error;
            }

            let membersData: { group_id: string; user_id: string }[] = membersResult.data ?? [];
            if (membersResult.error) {
                console.error('Error fetching group members:', membersResult.error);
                membersData = [];
            }

            const profileIds = [...new Set(membersData.map(m => m.user_id))];
            const profilesByUserId = new Map<
                string,
                { display_name?: string | null; avatar_url?: string | null }
            >();
            if (profileIds.length > 0) {
                const { data: profilesRaw, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, display_name, avatar_url')
                    .in('id', profileIds);

                if (profilesError) {
                    console.error('Error fetching profiles for group list:', profilesError);
                } else if (profilesRaw) {
                    for (const p of profilesRaw) {
                        profilesByUserId.set(p.id, p);
                    }
                }
            }

            const groupsData = groupsResult.data ?? [];

            setAliases(userAliases);

            const formattedGroups: Group[] = groupsData.map(g => {
                const allGroupMembers = membersData.filter(m => m.group_id === g.id)

                const groupMembers = allGroupMembers
                    .filter(m => m.user_id !== userId)
                    .map(m => {
                        const profile = profilesByUserId.get(m.user_id);
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
                    totalMemberCount: allGroupMembers.length,
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
                <ActivityIndicator size="large" color="#aa2c32" />
                <Text className="mt-4 text-on-surface/55 font-sans-medium">Cargando grupos...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 p-4 pb-20">
            {/* Header Local de la pestaña */}
            <View className="flex-row justify-between items-end mb-10 px-2">
                <View>
                    <Text className="text-3xl font-display text-on-background tracking-tight">Mis grupos</Text>
                    <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">Gestiona tus intercambios</Text>
                </View>
                <View className="flex-row gap-3">
                    <Link href={"/groups/join" as any} asChild>
                        <Pressable className="w-12 h-12 rounded-2xl bg-surface-container-high items-center justify-center shadow-ambient">
                            <Text style={{ fontSize: 20 }}>👤</Text>
                        </Pressable>
                    </Link>
                    <PrimaryButton
                        onPress={() => router.push('/groups/create' as any)}
                        accessibilityLabel="Crear grupo"
                        variant="icon"
                        className="w-12 h-12 rounded-2xl"
                        textClassName="text-on-primary font-sans-bold text-2xl leading-none"
                    >
                        +
                    </PrimaryButton>
                </View>
            </View>

            {/* Group List Grid */}
            <View className="w-full">
                {groups.length > 0 ? (
                    <View className="flex-row flex-wrap -m-3 items-stretch">
                        {groups.map(group => (
                            <View key={group.id} className="w-full md:w-1/2 lg:w-1/3 p-3 flex">
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
                        <View className="w-24 h-24 bg-surface-container-low rounded-full items-center justify-center mb-6">
                            <Text style={{ fontSize: 40 }}>🎁</Text>
                        </View>
                        <Text className="text-2xl font-display text-on-background mb-2">No tienes grupos aún</Text>
                        <Text className="text-on-surface/55 font-sans-medium max-w-xs mb-8">
                            Crea un nuevo grupo para empezar a organizar tus intercambios de regalos.
                        </Text>
                        <View className="flex-row gap-4 w-full max-w-xs">
                            <Link href={"/groups/join" as any} asChild>
                                <Pressable className="flex-1 py-4 rounded-full bg-surface-container-high items-center shadow-ambient">
                                    <Text className="text-on-background font-sans-bold">Unirse</Text>
                                </Pressable>
                            </Link>
                            <PrimaryButton
                                onPress={() => router.push('/groups/create' as any)}
                                className="flex-1"
                                textClassName="text-on-primary font-sans-bold"
                                accessibilityLabel="Crear grupo"
                            >
                                Crear
                            </PrimaryButton>
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
                    <View className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-8 shadow-ambient-lg">
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 bg-surface-container-low rounded-3xl items-center justify-center mb-4">
                                <Text style={{ fontSize: 32 }}>↗</Text>
                            </View>
                            <Text className="text-2xl font-display text-on-background mb-2">Invita a tus amigos</Text>
                            <Text className="text-on-surface/55 font-sans-medium text-center">
                                Comparte este código para que puedan unirse al grupo.
                            </Text>
                        </View>

                        <Pressable
                            onPress={copyToClipboard}
                            className="bg-surface-container-low rounded-3xl p-6 mb-8 items-center justify-center active:opacity-90"
                        >
                            <Text className="text-4xl font-mono font-sans-bold text-on-background tracking-widest uppercase">
                                {selectedGroupId}
                            </Text>
                            <Text className="text-[10px] font-sans-bold text-on-surface/45 mt-2 uppercase tracking-widest">Toca para copiar</Text>
                        </Pressable>

                        <PrimaryButton
                            onPress={shareNative}
                            accessibilityLabel="Compartir enlace"
                            className="mb-4"
                            textClassName="text-on-primary font-sans-bold text-lg"
                        >
                            Compartir enlace
                        </PrimaryButton>

                        <Pressable
                            onPress={closeShareModal}
                            accessibilityRole="button"
                            accessibilityLabel="Cerrar"
                            className="w-full items-center py-2"
                        >
                            <Text className="text-primary font-sans-bold">Cerrar</Text>
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
                    <View className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-ambient-lg">
                        <Text className="text-xl font-display text-on-background mb-4">Cambiar nombre del grupo</Text>
                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            accessibilityLabel="Nuevo nombre del grupo"
                            className="w-full px-4 py-3 rounded-full bg-surface-container-highest text-on-background font-sans-semibold mb-6"
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
                                <Text className="text-primary font-sans-semibold">Cancelar</Text>
                            </Pressable>
                            <PrimaryButton onPress={handleRenameSubmit} accessibilityLabel="Guardar" className="px-6">
                                Guardar
                            </PrimaryButton>
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
                    <View className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-ambient-lg">
                        <View className="w-12 h-12 rounded-full bg-primary/12 items-center justify-center mb-4">
                            <Text style={{ fontSize: 24 }}>🗑</Text>
                        </View>
                        <Text className="text-xl font-display text-on-background mb-2">¿Eliminar grupo?</Text>
                        <Text className="text-on-surface/65 mb-6 font-sans-medium">
                            Estás a punto de eliminar el grupo <Text className="font-sans-bold text-on-background">"{groupToDelete?.name}"</Text>. Esta acción no se puede deshacer.
                        </Text>
                        <View className="flex-row gap-3 justify-end">
                            <Pressable
                                onPress={() => setDeleteModalOpen(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancelar"
                                className="px-4 py-2"
                            >
                                <Text className="text-primary font-sans-semibold">Cancelar</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleDeleteConfirm}
                                accessibilityRole="button"
                                accessibilityLabel="Eliminar"
                                className="px-4 py-2 bg-primary rounded-full shadow-ambient"
                            >
                                <Text className="text-on-primary font-sans-semibold">Eliminar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

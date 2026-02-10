import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';

export interface GroupMember {
    id: string;
    name: string;
    originalName?: string; // Nombre original si tiene apodo
    avatar?: string;
    shirt_size?: string;
    pants_size?: string;
    shoe_size?: string;
    favorite_brands?: string;
    favorite_color?: string;
}

export interface Group {
    id: string;
    name: string;
    icon: string;
    originalName?: string;
    members: GroupMember[];
}

interface GroupCardProps {
    group: Group;
    isAdmin?: boolean;
    onShare: (groupId: string) => void;
    onRename?: (groupId: string, currentName: string) => void;
    onDelete?: (groupId: string, groupName: string) => void;
    onMemberEdit?: (memberId: string, newAlias: string) => Promise<boolean>;
    onGroupAliasEdit?: (groupId: string, newAlias: string) => Promise<boolean>;
}

export function GroupCard({ group, isAdmin, onShare, onRename, onDelete, onMemberEdit, onGroupAliasEdit }: GroupCardProps) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    // Estado para edición en línea
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [aliasInput, setAliasInput] = useState("");

    // Estado para edición de alias de grupo
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState("");

    const handleCardClick = () => {
        if (editingMemberId || isEditingGroupName) return;
        router.push(`/groups/${group.id}` as any);
    };

    const handleShareClick = () => {
        onShare(group.id);
    };

    const handleMenuClick = () => {
        setMenuOpen(!menuOpen);
    };

    const handleRenameClick = () => {
        setMenuOpen(false);
        if (onRename) onRename(group.id, group.name);
    };

    const handleDeleteClick = () => {
        setMenuOpen(false);
        if (onDelete) onDelete(group.id, group.name);
    };

    // Alias handlers
    const startEditing = (member: GroupMember) => {
        if (!onMemberEdit) return;
        setEditingMemberId(member.id);
        setAliasInput(member.name);
    };

    const saveAlias = async () => {
        if (!editingMemberId || !onMemberEdit) return;
        const success = await onMemberEdit(editingMemberId, aliasInput);
        if (success) {
            setEditingMemberId(null);
        }
    };

    const cancelEditing = () => {
        setEditingMemberId(null);
        setAliasInput("");
    };

    // Group Alias Handlers
    const startEditingGroupName = () => {
        if (!onGroupAliasEdit) return;
        setIsEditingGroupName(true);
        setGroupNameInput(group.name);
    };

    const saveGroupName = async () => {
        if (!onGroupAliasEdit) return;
        const success = await onGroupAliasEdit(group.id, groupNameInput);
        if (success) {
            setIsEditingGroupName(false);
        }
    };

    const cancelEditingGroupName = () => {
        setIsEditingGroupName(false);
        setGroupNameInput("");
    };

    const displayMembers = group.members.slice(0, 3);
    const remainingCount = group.members.length - 3;

    return (
        <Pressable
            onPress={handleCardClick}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition-all mb-4"
        >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-6">
                <View className="flex-row items-center flex-1">
                    <View className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center shadow-inner">
                        <Text className="text-3xl">{group.icon}</Text>
                    </View>
                    <View className="ml-4 flex-1">
                        {isEditingGroupName ? (
                            <View className="flex-row items-center">
                                <TextInput
                                    value={groupNameInput}
                                    onChangeText={setGroupNameInput}
                                    className="font-bold text-xl text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-b-2 border-indigo-500 flex-1"
                                    autoFocus
                                />
                                <Pressable onPress={saveGroupName} className="p-2 ml-2 bg-green-50 rounded-lg">
                                    <Text className="text-green-600">✓</Text>
                                </Pressable>
                                <Pressable onPress={cancelEditingGroupName} className="p-2 ml-1 bg-red-50 rounded-lg">
                                    <Text className="text-red-600">✕</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View className="flex-row items-center">
                                <Text className="font-black text-xl text-zinc-900 dark:text-zinc-100 flex-1" numberOfLines={1}>
                                    {group.name}
                                </Text>
                                {onGroupAliasEdit && (
                                    <Pressable onPress={startEditingGroupName} className="p-1 ml-1">
                                        <Text className="text-zinc-400 text-xs">✎</Text>
                                    </Pressable>
                                )}
                            </View>
                        )}
                        <Text className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-wider">
                            {group.members.length} participantes
                        </Text>
                    </View>
                </View>

                <View className="flex-row">
                    <Pressable
                        onPress={handleShareClick}
                        className="p-3 rounded-full bg-zinc-50 dark:bg-zinc-800 items-center justify-center mr-2"
                    >
                        <Text className="text-lg">↗</Text>
                    </Pressable>

                    {isAdmin && (
                        <View className="relative">
                            <Pressable
                                onPress={handleMenuClick}
                                className="p-3 rounded-full bg-zinc-50 dark:bg-zinc-800 items-center justify-center"
                            >
                                <Text className="text-lg">⋮</Text>
                            </Pressable>

                            {menuOpen && (
                                <View className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 z-10 overflow-hidden">
                                    <Pressable
                                        onPress={handleRenameClick}
                                        className="w-full px-4 py-4 border-b border-zinc-50 flex-row items-center"
                                    >
                                        <Text className="text-sm font-bold text-zinc-700 dark:text-zinc-200 ml-2">Cambiar nombre</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleDeleteClick}
                                        className="w-full px-4 py-4 flex-row items-center"
                                    >
                                        <Text className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">Eliminar grupo</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* Members List */}
            <View className="space-y-3">
                {displayMembers.map((member) => (
                    <Pressable
                        key={member.id}
                        onPress={() => {
                            if (editingMemberId) return;
                            router.push({
                                pathname: "/wishlist/[id]",
                                params: { id: member.id, name: member.name }
                            } as any);
                        }}
                        className="flex-row items-center p-2 -m-2 rounded-xl active:bg-zinc-50 transition-colors"
                    >
                        <View className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 overflow-hidden items-center justify-center">
                            {member.avatar && (member.avatar.startsWith('http') || member.avatar.length > 5) ? (
                                <Image source={{ uri: member.avatar }} className="w-full h-full" />
                            ) : (
                                <Text className="text-lg">{member.avatar || member.name.charAt(0).toUpperCase()}</Text>
                            )}
                        </View>

                        <View className="ml-3 flex-1 flex-row items-center">
                            {editingMemberId === member.id ? (
                                <View className="flex-row items-center flex-1">
                                    <TextInput
                                        value={aliasInput}
                                        onChangeText={setAliasInput}
                                        className="flex-1 px-2 py-1 bg-zinc-50 rounded border border-zinc-200 text-sm"
                                        autoFocus
                                    />
                                    <Pressable onPress={saveAlias} className="p-2 ml-1">
                                        <Text className="text-green-600 font-bold">✓</Text>
                                    </Pressable>
                                    <Pressable onPress={cancelEditing} className="p-2">
                                        <Text className="text-red-600">✕</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-sm font-bold text-zinc-700 dark:text-zinc-300" numberOfLines={1}>
                                        {member.name}
                                    </Text>
                                    {member.originalName && (
                                        <Text className="ml-2 text-[10px] text-zinc-400 italic">
                                            ({member.originalName})
                                        </Text>
                                    )}
                                    {onMemberEdit && (
                                        <Pressable onPress={() => startEditing(member)} className="p-1 ml-1">
                                            <Text className="text-zinc-300 text-[10px]">✎</Text>
                                        </Pressable>
                                    )}
                                </View>
                            )}
                        </View>
                        <Text className="text-zinc-300 ml-2">›</Text>
                    </Pressable>
                ))}

                {remainingCount > 0 && (
                    <Text className="text-xs font-bold text-zinc-400 mt-2 ml-11">
                        + {remainingCount} otros participantes
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

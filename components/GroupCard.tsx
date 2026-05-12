import React, { useState, memo } from 'react';
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
    /** Total de personas en el grupo (incluido el usuario actual). `members` solo lista a otros para la vista previa. */
    totalMemberCount?: number;
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

export const GroupCard = memo(function GroupCard({
    group,
    isAdmin,
    onShare,
    onRename,
    onDelete,
    onMemberEdit,
    onGroupAliasEdit
}: GroupCardProps) {
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

    const participantCount = group.totalMemberCount ?? group.members.length;
    const displayMembers = group.members.slice(0, 3);
    const remainingCount = group.members.length - 3;

    return (
        <Pressable
            onPress={handleCardClick}
            accessibilityRole="button"
            accessibilityLabel={`${group.name}, ${participantCount} participantes`}
            accessibilityHint="Abrir detalle del grupo"
            className="bg-surface-container-lowest rounded-lg p-6 shadow-ambient active:scale-[0.98] transition-all mb-4 flex-1"
        >
            {/* Header: ancho fijo para acciones → misma columna de título en web; min-w-0 evita desbordes en flex */}
            <View className="flex-row justify-between items-start mb-6 min-w-0">
                <View className="flex-row items-start flex-1 min-w-0 pr-2">
                    <View className="w-14 h-14 shrink-0 rounded-md bg-surface-container-low items-center justify-center shadow-inner">
                        <Text className="text-3xl">{group.icon}</Text>
                    </View>
                    <View className="ml-4 flex-1 min-w-0 min-h-[3.25rem] md:min-h-[3.5rem]">
                        {isEditingGroupName ? (
                            <View className="flex-row items-center min-w-0">
                                <TextInput
                                    value={groupNameInput}
                                    onChangeText={setGroupNameInput}
                                    className="font-sans-bold text-xl text-on-background bg-surface-container-highest rounded-md px-2 py-1 flex-1 min-w-0 ring-2 ring-primary/20"
                                    autoFocus
                                />
                                <Pressable onPress={saveGroupName} className="p-2 ml-2 bg-green-50 rounded-lg shrink-0">
                                    <Text className="text-green-600">✓</Text>
                                </Pressable>
                                <Pressable onPress={cancelEditingGroupName} className="p-2 ml-1 bg-red-50 rounded-lg shrink-0">
                                    <Text className="text-red-600">✕</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View className="flex-row items-center min-w-0">
                                <Text
                                    className="font-display text-xl text-on-background min-w-0 flex-1 shrink"
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {group.name}
                                </Text>
                                {onGroupAliasEdit && (
                                    <Pressable onPress={startEditingGroupName} className="p-1 ml-1 shrink-0">
                                        <Text className="text-on-surface/40 text-xs">✎</Text>
                                    </Pressable>
                                )}
                            </View>
                        )}
                        <Text
                            className="text-xs text-on-surface/50 mt-1 font-sans-bold uppercase tracking-wider leading-tight"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {participantCount} participantes
                        </Text>
                    </View>
                </View>

                <View className="w-[7.25rem] shrink-0 flex-row justify-end items-start">
                    <Pressable
                        onPress={handleShareClick}
                        accessibilityRole="button"
                        accessibilityLabel="Compartir grupo"
                        className="p-3 rounded-full bg-surface-container-low items-center justify-center mr-2"
                    >
                        <Text className="text-lg">↗</Text>
                    </Pressable>

                    {isAdmin ? (
                        <View className="relative">
                            <Pressable
                                onPress={handleMenuClick}
                                accessibilityRole="button"
                                accessibilityLabel="Opciones de grupo"
                                className="p-3 rounded-full bg-surface-container-low items-center justify-center"
                            >
                                <Text className="text-lg">⋮</Text>
                            </Pressable>

                            {menuOpen && (
                                <View className="absolute right-0 top-full mt-2 w-48 bg-surface-container-lowest rounded-2xl shadow-ambient-lg z-10 overflow-hidden gap-1 p-1">
                                    <Pressable
                                        onPress={handleRenameClick}
                                        className="w-full px-4 py-4 rounded-xl bg-surface-container-low flex-row items-center"
                                    >
                                        <Text className="text-sm font-sans-bold text-on-background ml-2">Cambiar nombre</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleDeleteClick}
                                        className="w-full px-4 py-4 rounded-xl flex-row items-center active:bg-surface-container-low"
                                    >
                                        <Text className="text-sm font-sans-bold text-primary ml-2">Eliminar grupo</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="w-12 h-12 shrink-0" pointerEvents="none" accessibilityElementsHidden />
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
                        className="flex-row items-center p-2 -m-2 rounded-xl active:bg-surface-container-low transition-colors"
                    >
                        <View className="w-9 h-9 rounded-full bg-surface-container-low overflow-hidden items-center justify-center ring-1 ring-outline-variant/15">
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
                                        className="flex-1 px-2 py-1 bg-surface-container-highest rounded-md text-sm text-on-background"
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
                                    <Text className="text-sm font-sans-bold text-on-background" numberOfLines={1}>
                                        {member.name}
                                    </Text>
                                    {member.originalName && (
                                        <Text className="ml-2 text-[10px] text-on-surface/45 italic">
                                            ({member.originalName})
                                        </Text>
                                    )}
                                    {onMemberEdit && (
                                        <Pressable onPress={() => startEditing(member)} className="p-1 ml-1">
                                            <Text className="text-on-surface/35 text-[10px]">✎</Text>
                                        </Pressable>
                                    )}
                                </View>
                            )}
                        </View>
                        <Text className="text-on-surface/30 ml-2">›</Text>
                    </Pressable>
                ))}

                {remainingCount > 0 && (
                    <Text className="text-xs font-sans-bold text-on-surface/50 mt-2 ml-11">
                        + {remainingCount} otros participantes
                    </Text>
                )}
            </View>
        </Pressable>
    );
});

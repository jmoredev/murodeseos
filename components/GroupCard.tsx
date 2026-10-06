import React, { useState, memo } from 'react';
import { View, Text, Pressable, TextInput, Image } from 'react-native';
import { useIsDesktop } from '@/lib/use-is-desktop';
// Tipo del evento de `onPress`: `GestureResponderEvent` extiende
// `React.BaseSyntheticEvent`, así que `stopPropagation()` existe tipado —
// sin casts.
import type { GestureResponderEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { emojiInCircle } from '@/lib/circle-glyph-styles';

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

    // Umbral de producto (decisión del propietario, móvil primero): el literal
    // `> 768` estricto vive hoy solo en `lib/use-is-desktop.ts`, del que aquí se
    // lee. El hook se suscribe por su cuenta a los cambios de viewport, así que
    // no inutiliza el `memo`: la memoización compara props y el re-render que
    // necesita la tarjeta llega por la suscripción, sin romper el bail-out de
    // props; un re-render del padre por estado ajeno (p. ej. aliases de
    // GroupsTab) sigue saltándose la tarjeta.
    const isDesktop = useIsDesktop();

    /**
     * `stopPropagation` antes de cada control interno: la tarjeta entera es
     * un `Pressable` (navega a `/groups/<id>`), y cada tap debe hacer exactamente una cosa. Sin esto, un tap en el menú del grupo burbujea al
     * `onPress` de la tarjeta o —peor— aterriza en la fila de miembro que el
     * menú desplegable pisa, navegando a la wishlist de otro (evidencia CI:
     * run 36934213771, tap en «Opciones de grupo» → «Cambiar nombre» terminó
     * en «Lista de Juan Perez»). El card-tap NO afectado: un tap sobre la
     * tarjeta misma (no sobre un control interno) no pasa por estos
     * handlers, burbujea intacto y sigue navegando al detalle del grupo.
     */
    const stopAnd = (fn: () => void) => (event: GestureResponderEvent) => {
        event.stopPropagation();
        fn();
    };

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

    // Recuperación de ancho C3 (medición CI run 36968601205, 360×640):
            // con text-xl el nombre del fixture necesita 3 líneas (scrollHeight=84
            // vs clientHeight=57, clamp de 2 líneas = 56px). La fila deja ~56–60px
            // por línea y 2 líneas exigen ≥ ~73px, así que se recupera ancho en
            // móvil SIN tocar clamp, escala tipográfica ni targets táctiles:
            //   - padding interior `p-6` → `p-4 md:p-6`  → +16px al contenido;
            //   - bloque de icono `w-14`/`ml-4` → `w-12`/`ml-3` en móvil → +12px.
            // Aritmética con clases Tailwind + medidas CI: contenido pasa de
            // ~280px (medido CI) a ~296px; columna del nombre pasa de ~104px
            // (~280 − pr-2 8 − icono 72 − columna compartir/menú ≥96, medida CI)
            // a ≥132px y el nombre tras el lápiz (44+4, target táctil intacto)
            // de ~56px a ≥84px por línea → 2 líneas ≥168 ≥ 145px del fixture.
            // Escritorio (≥768px): `md:p-6`, `md:w-14 h-14`, `md:ml-4` — las
            // clases puestas en móvil solo reemplazan las de siempre por debajo
            // de `md`; a ≥768px aplica exactamente las mismas reglas de antes.
    return (
        <Pressable
            onPress={handleCardClick}
            accessibilityRole="button"
            accessibilityLabel={`${group.name}, ${participantCount} participantes`}
            accessibilityHint="Abrir detalle del grupo"
            className="bg-surface-container-lowest rounded-lg p-4 md:p-6 shadow-ambient active:scale-[0.98] transition-all mb-4 flex-1"
        >
            {/* Header: la columna fija de acciones (compartir + menú) es solo de
                escritorio: alinea la columna de título entre tarjetas en el grid
                `md:`; en pantalla estrecha el ancho es el del contenido, para no
                dejar solo ~56px al nombre (defecto C3). min-w-0 evita desbordes. */}
            <View className="flex-row justify-between items-start mb-6 min-w-0">
                <View className="flex-row items-start flex-1 min-w-0 pr-2">
                    {/* C3: 56→48 en móvil (+8). El glifo del icono es 30px
                        (`emojiInCircle(30)`) y cabe en la caja de 48 con aire;
                        escritorio: md:w-14/md:h-14 de siempre. */}
                    <View className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-md bg-surface-container-low items-center justify-center shadow-inner">
                        <Text className="text-3xl" style={emojiInCircle(30)}>
                            {group.icon}
                        </Text>
                    </View>
                    {/* C3: 16→12 en móvil (+4): 44 del lápiz + 4 ya caben a
                        text-xs en la fila; escritorio: md:ml-4 de siempre. */}
                    <View className="ml-3 md:ml-4 flex-1 min-w-0 min-h-[3.25rem] md:min-h-[3.5rem]">
                        {isEditingGroupName ? (
                            <View className="flex-row items-center min-w-0">
                                <TextInput
                                    value={groupNameInput}
                                    onChangeText={setGroupNameInput}
                                    // 20px y no 16: este campo ya se renderizaba a
                                    // `text-xl` (20px). El check de CI es un mínimo
                                    // (≥16px), no una bajada de tamaño.
                                    style={{ fontSize: 20 }}
                                    className="font-sans-bold text-xl text-on-background bg-surface-container-highest rounded-md px-2 py-1 flex-1 min-w-0 ring-2 ring-primary/20"
                                    autoFocus
                                />
                                <Pressable onPress={stopAnd(saveGroupName)} className="p-2 ml-2 bg-green-50 rounded-lg shrink-0">
                                    <Text className="text-green-600">✓</Text>
                                </Pressable>
                                <Pressable onPress={stopAnd(cancelEditingGroupName)} className="p-2 ml-1 bg-red-50 rounded-lg shrink-0">
                                    <Text className="text-red-600">✕</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View className="flex-row items-center min-w-0">
                                <Text
                                    className="font-display text-xl text-on-background min-w-0 flex-1 shrink"
                                    numberOfLines={isDesktop ? 1 : 2}
                                    // Un móvil: el nombre puede ocupar 2 líneas
                                    // (decisión del propietario). Desde run
                                    // 36968601205 el embotellamiento es de ANCHO:
                                    // clampado a 2 líneas el navegador reporta
                                    // scrollHeight=84 > clientHeight=57 (3 líneas
                                    // vs clamp de 2), así que el fix no relaja el
                                    // clamp sino que recupera ancho a la fila
                                    // (padding del marco p-4 md:p-6, icono
                                    // w-12 h-12 md:w-14 md:h-14, ml-3 md:ml-4):
                                    // la columna del nombre pasa de ~56–60px a
                                    // ≥84px por línea → 2 líneas ≥168px ≥145px
                                    // del fixture. Escritorio: 1 línea como
                                    // siempre. Defecto C3. `ellipsizeMode`
                                    // mantiene truncamiento seguro: si aun así no
                                    // cabe, elipsis y nunca un empujón de layout.
                                    ellipsizeMode="tail"
                                >
                                    {group.name}
                                </Text>
                                {onGroupAliasEdit && (
                                    <Pressable onPress={stopAnd(startEditingGroupName)} className="w-11 h-11 ml-1 shrink-0 items-center justify-center">
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

                <View className="md:w-[7.25rem] shrink-0 flex-row justify-end items-start">
                    <Pressable
                        onPress={stopAnd(handleShareClick)}
                        accessibilityRole="button"
                        accessibilityLabel="Compartir grupo"
                        className="p-3 rounded-full bg-surface-container-low items-center justify-center mr-2"
                    >
                        <Text className="text-lg">↗</Text>
                    </Pressable>

                    {isAdmin ? (
                        <View className="relative">
                            <Pressable
                                onPress={stopAnd(handleMenuClick)}
                                accessibilityRole="button"
                                accessibilityLabel="Opciones de grupo"
                                className="p-3 rounded-full bg-surface-container-low items-center justify-center"
                            >
                                <Text className="text-lg">⋮</Text>
                            </Pressable>

                            {menuOpen && (
                                <View className="absolute right-0 top-full mt-2 w-48 bg-surface-container-lowest rounded-2xl shadow-ambient-lg z-30 overflow-hidden gap-1 p-1">
                                    <Pressable
                                        onPress={stopAnd(handleRenameClick)}
                                        className="w-full px-4 py-4 rounded-xl bg-surface-container-low flex-row items-center"
                                    >
                                        <Text className="text-sm font-sans-bold text-on-background ml-2">Cambiar nombre</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={stopAnd(handleDeleteClick)}
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
                        onPress={stopAnd(() => {
                            if (editingMemberId) return;
                            router.push({
                                pathname: "/wishlist/[id]",
                                params: { id: member.id, name: member.name }
                            } as any);
                        })}
                        className="flex-row items-center p-2 -m-2 rounded-xl active:bg-surface-container-low transition-colors"
                    >
                        <View className="w-9 h-9 rounded-full bg-surface-container-low overflow-hidden items-center justify-center ring-1 ring-outline-variant/15">
                            {member.avatar && (member.avatar.startsWith('http') || member.avatar.length > 5) ? (
                                <Image source={{ uri: member.avatar }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Text className="font-sans-bold text-on-surface" style={emojiInCircle(18)}>
                                    {member.avatar || member.name.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>

                        <View className="ml-3 flex-1 flex-row items-center">
                            {editingMemberId === member.id ? (
                                <View className="flex-row items-center flex-1">
                                    <TextInput
                                        value={aliasInput}
                                        onChangeText={setAliasInput}
                                        style={{ fontSize: 16 }}
                                        className="flex-1 px-2 py-1 bg-surface-container-highest rounded-md text-sm text-on-background"
                                        autoFocus
                                    />
                                    <Pressable onPress={stopAnd(saveAlias)} className="p-2 ml-1">
                                        <Text className="text-green-600 font-bold">✓</Text>
                                    </Pressable>
                                    <Pressable onPress={stopAnd(cancelEditing)} className="p-2">
                                        <Text className="text-red-600">✕</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-sm font-sans-bold text-on-background min-w-0 shrink" numberOfLines={1}>
                                        {member.name}
                                    </Text>
                                    {member.originalName && (
                                        <Text className="ml-2 text-xs text-on-surface/45 italic">
                                            ({member.originalName})
                                        </Text>
                                    )}
                                    {onMemberEdit && (
                                        <Pressable onPress={stopAnd(() => startEditing(member))} className="w-11 h-11 ml-1 shrink-0 items-center justify-center">
                                            <Text className="text-on-surface/35 text-xs">✎</Text>
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

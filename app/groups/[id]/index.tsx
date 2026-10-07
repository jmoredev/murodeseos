import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image } from 'react-native';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';
import { shareGroup } from '@/lib/group-utils';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { GroupNotificationSettingsModal } from '@/components/GroupNotificationSettingsModal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { circleGlyphTextBase, emojiInCircle } from '@/lib/circle-glyph-styles';

function isHttpUrl(value: string | undefined | null): boolean {
    return !!value && /^https?:\/\//i.test(value);
}

export default function GroupDetailsPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const groupId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    // Identidad estable: el modal la usa como dependencia de su efecto de foco y
    // de Escape, y una función en línea la haría reejecutar en cada render.
    const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
    const isDesktop = useIsDesktop();

    useEffect(() => {
        const loadGroupData = async () => {
            if (!groupId) {
                setError("ID de grupo no válido");
                setLoading(false);
                return;
            }

            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                setUser(currentUser);

                // Cargar grupo
                const { data: groupData, error: groupError } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('id', groupId)
                    .maybeSingle();

                if (groupError) throw groupError;
                if (!groupData) {
                    setError("No se encontró el grupo solicitado.");
                    return;
                }
                setGroup(groupData);

                // Cargar miembros
                const { data: membersRaw, error: membersError } = await supabase
                    .from('group_members')
                    .select('*')
                    .eq('group_id', groupId);

                if (membersError) throw membersError;

                if (membersRaw && membersRaw.length > 0) {
                    const userIds = membersRaw.map(m => m.user_id);
                    const { data: profilesRaw, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, display_name, avatar_url')
                        .in('id', userIds);

                    if (profilesError) throw profilesError;

                    const profilesMap = new Map(profilesRaw?.map(p => [p.id, p]));

                    const enrichedMembers = membersRaw.map(m => ({
                        ...m,
                        profiles: profilesMap.get(m.user_id)
                    }));

                    setMembers(enrichedMembers);
                } else {
                    setMembers([]);
                }

            } catch (err: any) {
                console.error('Error loading group:', err);
                setError(err.message || "Error al cargar los datos del grupo");
            } finally {
                setLoading(false);
            }
        };

        loadGroupData();
    }, [groupId]);

    const handleShare = async () => {
        if (!group) return;
        await shareGroup(group.name, group.id);
    };

    if (error) {
        return (
            <View className="flex-1 items-center justify-center bg-surface p-6">
                <Text style={{ fontSize: 64 }} className="mb-4">😕</Text>
                <Text className="text-2xl font-display text-on-background mb-2">¡Vaya!</Text>
                <Text className="text-on-surface/70 text-center font-sans-medium mb-8">{error}</Text>
                <PrimaryButton onPress={() => router.replace('/')} accessibilityLabel="Volver al inicio">
                    Volver al inicio
                </PrimaryButton>
            </View>
        );
    }

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-surface">
                <ActivityIndicator size="large" color="#aa2c32" />
            </View>
        );
    }

    return (
        <ResponsiveLayout
            userId={user?.id ?? ''}
            activeTab="groups"
            setActiveTab={(tab) => router.push(`/?tab=${tab}` as any)}
            onSignOut={signOut}
        >
            <View className="p-4">
                {/* Header Section */}
                <View className={`mb-8 ${isDesktop ? 'flex-row justify-between items-center px-0' : 'flex-col gap-4 px-2'}`}>
                    <View className="flex-row items-center flex-1 min-w-0">
                        <Pressable
                            onPress={() => router.back()}
                            className="w-11 h-11 rounded-full bg-surface-container-low items-center justify-center mr-4"
                        >
                            <Text className="text-on-surface font-sans-bold" style={circleGlyphTextBase}>
                                ←
                            </Text>
                        </Pressable>
                        <View className="flex-1">
                            <Text className="text-3xl font-display text-on-background tracking-tight" numberOfLines={1}>
                                {group?.name}
                            </Text>
                            <Text className="text-on-surface/70 font-sans-bold uppercase text-xs tracking-widest mt-2">
                                Detalles del grupo
                            </Text>
                        </View>
                    </View>
                    <View className={`flex-row items-center gap-2 ${isDesktop ? '' : 'justify-end flex-wrap'}`}>
                        <Pressable
                            onPress={() => setNotificationsOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel={`Preferencias de notificaciones del grupo ${group?.name ?? ''}`}
                            className="px-4 py-3.5 rounded-full border border-primary/30 items-center active:opacity-80"
                        >
                            <Text
                                className="text-primary font-sans-bold text-xs uppercase tracking-widest"
                                numberOfLines={1}
                            >
                                Notificaciones
                            </Text>
                        </Pressable>
                        <PrimaryButton
                            onPress={handleShare}
                            accessibilityLabel="Compartir grupo"
                            textClassName="text-on-primary font-sans-bold"
                        >
                            Compartir
                        </PrimaryButton>
                    </View>
                </View>

                {/* Group Info Card */}
                <View className="bg-surface-container-lowest rounded-3xl p-8 shadow-ambient mb-8 flex-row items-center min-w-0">
                    <View className="w-20 h-20 shrink-0 bg-surface-container-low rounded-3xl items-center justify-center shadow-inner mr-6">
                        <Text className="text-4xl" style={emojiInCircle(36)}>
                            {group?.icon || '🎁'}
                        </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                        <Text className="text-2xl font-display text-on-background" numberOfLines={2}>
                            {group?.name}
                        </Text>
                        <View className="mt-3 gap-2">
                            <View className="self-start max-w-full px-3 py-1 bg-surface-container-low rounded-full">
                                <Text
                                    className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest"
                                    numberOfLines={1}
                                    ellipsizeMode="middle"
                                >
                                    Código: {group?.id}
                                </Text>
                            </View>
                            <Text className="text-xs text-on-surface/70 font-sans-bold">
                                {members.length} participantes
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Members Grid */}
                <View>
                    <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-6 ml-2">
                        Participantes
                    </Text>

                    <View className="flex-row flex-wrap -m-2">
                        {members.map((member) => (
                            <View key={member.user_id} className={`${isDesktop ? 'w-1/3' : 'w-1/2'} p-2`}>
                                <Pressable
                                    onPress={() => router.push({
                                        pathname: "/wishlist/[id]",
                                        params: { id: member.user_id, name: member.profiles?.display_name || 'Usuario' }
                                    } as any)}
                                    className="bg-surface-container-lowest rounded-lg p-4 shadow-ambient active:scale-[0.98] transition-all relative"
                                >
                                    <View className="items-center mb-4">
                                        <View className="w-20 h-20 bg-surface-container-low rounded-full items-center justify-center relative overflow-hidden ring-1 ring-outline-variant/15">
                                            {isHttpUrl(member.profiles?.avatar_url) ? (
                                                <Image
                                                    source={{ uri: member.profiles.avatar_url }}
                                                    className="w-full h-full"
                                                    resizeMode="cover"
                                                    accessibilityIgnoresInvertColors
                                                />
                                            ) : member.profiles?.avatar_url ? (
                                                <Text style={emojiInCircle(36)}>{member.profiles.avatar_url}</Text>
                                            ) : (
                                                <Text
                                                    className="font-sans-bold text-on-surface/70"
                                                    style={emojiInCircle(22)}
                                                >
                                                    {member.profiles?.display_name?.charAt(0) || '?'}
                                                </Text>
                                            )}
                                        </View>
                                        {member.role === 'admin' && (
                                            <View className="absolute top-0 right-0 bg-secondary rounded-full px-2 py-0.5 ring-2 ring-surface-container-lowest">
                                                <Text className="text-xs font-sans-bold text-surface-container-lowest uppercase">Admin</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-center font-sans-bold text-on-background mb-1" numberOfLines={1}>
                                        {member.profiles?.display_name || 'Usuario'}
                                        {member.user_id === user?.id && <Text className="text-primary"> (Tú)</Text>}
                                    </Text>
                                    <Text className="text-center text-xs text-on-surface/70 font-sans-bold uppercase tracking-tighter">
                                        Ver deseos ›
                                    </Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

            </View>

            <GroupNotificationSettingsModal
                key={groupId}
                visible={notificationsOpen}
                onClose={closeNotifications}
                userId={user?.id ?? ''}
                groupId={groupId}
                groupName={group?.name ?? ''}
            />
        </ResponsiveLayout>
    );
}

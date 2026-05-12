import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { shareGroup } from '@/lib/group-utils';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default function GroupDetailsPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const groupId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

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

                    // Verificar si es admin
                    const userMember = enrichedMembers.find(m => m.user_id === currentUser?.id);
                    setIsAdmin(userMember?.role === 'admin');
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
                <Text className="text-on-surface/65 text-center font-sans-medium mb-8">{error}</Text>
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
            onSignOut={() => supabase.auth.signOut()}
        >
            <View className="p-4">
                {/* Header Section */}
                <View className={`flex-row justify-between items-center mb-8 ${isDesktop ? 'px-0' : 'px-2'}`}>
                    <View className="flex-row items-center flex-1">
                        <Pressable
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center mr-4"
                        >
                            <Text className="text-on-surface font-sans-bold">←</Text>
                        </Pressable>
                        <View className="flex-1">
                            <Text className="text-3xl font-display text-on-background tracking-tight" numberOfLines={1}>
                                {group?.name}
                            </Text>
                            <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">
                                Detalles del grupo
                            </Text>
                        </View>
                    </View>
                    <PrimaryButton
                        onPress={handleShare}
                        accessibilityLabel="Compartir grupo"
                        textClassName="text-on-primary font-sans-bold"
                    >
                        Compartir
                    </PrimaryButton>
                </View>

                {/* Group Info Card */}
                <View className="bg-surface-container-lowest rounded-3xl p-8 shadow-ambient mb-8 flex-row items-center">
                    <View className="w-20 h-20 bg-surface-container-low rounded-3xl items-center justify-center shadow-inner mr-6">
                        <Text className="text-4xl">{group?.icon || '🎁'}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-2xl font-display text-on-background">{group?.name}</Text>
                        <View className="flex-row items-center mt-3 gap-2">
                            <View className="px-3 py-1 bg-surface-container-low rounded-full">
                                <Text className="text-[10px] font-sans-bold text-on-surface/55 uppercase tracking-widest">
                                    Código: {group?.id}
                                </Text>
                            </View>
                            <Text className="text-xs text-on-surface/45 font-sans-bold">
                                {members.length} participantes
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Members Grid */}
                <View>
                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-6 ml-2">
                        Participantes
                    </Text>

                    <View className="flex-row flex-wrap -m-2">
                        {members.map((member) => (
                            <View key={member.user_id} className="w-1/2 md:w-1/3 lg:w-1/4 p-2">
                                <Pressable
                                    onPress={() => router.push({
                                        pathname: "/wishlist/[id]",
                                        params: { id: member.user_id, name: member.profiles?.display_name || 'Usuario' }
                                    } as any)}
                                    className="bg-surface-container-lowest rounded-lg p-4 shadow-ambient active:scale-[0.98] transition-all relative"
                                >
                                    <View className="items-center mb-4">
                                        <View className="w-20 h-20 bg-surface-container-low rounded-full items-center justify-center relative overflow-hidden ring-1 ring-outline-variant/15">
                                            {member.profiles?.avatar_url ? (
                                                <Text style={{ fontSize: 36 }}>{member.profiles.avatar_url}</Text>
                                            ) : (
                                                <Text className="text-2xl font-sans-bold text-on-surface/30">
                                                    {member.profiles?.display_name?.charAt(0)}
                                                </Text>
                                            )}
                                        </View>
                                        {member.role === 'admin' && (
                                            <View className="absolute top-0 right-0 bg-secondary rounded-full px-2 py-0.5 ring-2 ring-surface-container-lowest">
                                                <Text className="text-[8px] font-sans-bold text-surface-container-lowest uppercase">Admin</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-center font-sans-bold text-on-background mb-1" numberOfLines={1}>
                                        {member.profiles?.display_name || 'Usuario'}
                                        {member.user_id === user?.id && <Text className="text-primary"> (Tú)</Text>}
                                    </Text>
                                    <Text className="text-center text-[10px] text-on-surface/45 font-sans-bold uppercase tracking-tighter">
                                        Ver deseos ›
                                    </Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Admin Actions */}
                {isAdmin && (
                    <View className="mt-12 p-6 bg-surface-container-low rounded-3xl shadow-ambient">
                        <Text className="text-xs font-sans-bold text-primary uppercase tracking-widest mb-4 text-center">
                            Zona de administrador
                        </Text>
                        <PrimaryButton
                            onPress={() => {
                                Alert.alert('Próximamente', 'La función de Amigo Invisible estará disponible pronto.');
                            }}
                            textClassName="text-on-primary font-sans-bold text-lg"
                            accessibilityLabel="Sortear amigo invisible"
                        >
                            Sortear Amigo Invisible
                        </PrimaryButton>
                    </View>
                )}
            </View>
        </ResponsiveLayout>
    );
}

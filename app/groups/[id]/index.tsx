import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { shareGroup } from '@/lib/group-utils';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';

export default function GroupDetailsPage() {
    const router = useRouter();
    const { id: groupId } = useLocalSearchParams();
    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    useEffect(() => {
        const loadGroupData = async () => {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                setUser(currentUser);

                // Cargar grupo
                const { data: groupData, error: groupError } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('id', groupId)
                    .single();

                if (groupError) throw groupError;
                setGroup(groupData);

                // Cargar miembros
                const { data: membersData, error: membersError } = await supabase
                    .from('group_members')
                    .select(`
                        *,
                        profiles:user_id (
                            id,
                            display_name,
                            avatar_url
                        )
                    `)
                    .eq('group_id', groupId);

                if (membersError) throw membersError;
                setMembers(membersData);

                // Verificar si es admin
                const userMember = membersData.find(m => m.user_id === currentUser?.id);
                setIsAdmin(userMember?.role === 'admin');

            } catch (error) {
                console.error('Error loading group:', error);
                router.replace('/');
            } finally {
                setLoading(false);
            }
        };

        if (groupId) loadGroupData();
    }, [groupId]);

    const handleShare = async () => {
        if (!group) return;
        await shareGroup(group.name, group.id);
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <ResponsiveLayout
            userId={user?.id}
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
                            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center mr-4"
                        >
                            <Text className="text-zinc-600 dark:text-zinc-400 font-bold">←</Text>
                        </Pressable>
                        <View className="flex-1">
                            <Text className="text-3xl font-black text-zinc-900 dark:text-white" numberOfLines={1}>
                                {group?.name}
                            </Text>
                            <Text className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                                Detalles del Grupo
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={handleShare}
                        className="px-6 py-3 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-600/30"
                    >
                        <Text className="text-white font-bold">Compartir</Text>
                    </Pressable>
                </View>

                {/* Group Info Card */}
                <View className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-100 dark:border-zinc-800 shadow-sm mb-8 flex-row items-center">
                    <View className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl items-center justify-center shadow-inner mr-6">
                        <Text className="text-4xl">{group?.icon || '🎁'}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-2xl font-black text-zinc-900 dark:text-white">{group?.name}</Text>
                        <View className="flex-row items-center mt-2">
                            <View className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mr-3">
                                <Text className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                    Código: {group?.id}
                                </Text>
                            </View>
                            <Text className="text-xs text-zinc-400 font-bold">
                                {members.length} participantes
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Members Grid */}
                <View>
                    <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 ml-2">
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
                                    className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm active:scale-[0.98] transition-all"
                                >
                                    <View className="items-center mb-4">
                                        <View className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full items-center justify-center border-4 border-zinc-100 dark:border-zinc-800 relative overflow-hidden">
                                            {member.profiles?.avatar_url ? (
                                                <Text style={{ fontSize: 36 }}>{member.profiles.avatar_url}</Text>
                                            ) : (
                                                <Text className="text-2xl font-black text-zinc-300">
                                                    {member.profiles?.display_name?.charAt(0)}
                                                </Text>
                                            )}
                                        </View>
                                        {member.role === 'admin' && (
                                            <View className="absolute top-0 right-0 bg-amber-500 rounded-full px-2 py-0.5 border-2 border-white dark:border-zinc-900">
                                                <Text className="text-[8px] font-black text-white uppercase">Admin</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-center font-bold text-zinc-900 dark:text-white mb-1" numberOfLines={1}>
                                        {member.profiles?.display_name || 'Usuario'}
                                        {member.user_id === user?.id && <Text className="text-indigo-500"> (Tú)</Text>}
                                    </Text>
                                    <Text className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                                        Ver Deseos ›
                                    </Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Admin Actions */}
                {isAdmin && (
                    <View className="mt-12 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20">
                        <Text className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4 text-center">
                            Zona de Administrador
                        </Text>
                        <Pressable
                            className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                            onPress={() => {
                                Alert.alert('Próximamente', 'La función de Amigo Invisible estará disponible pronto.');
                            }}
                        >
                            <Text className="text-white text-center font-bold text-lg">Sortear Amigo Invisible</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        </ResponsiveLayout>
    );
}

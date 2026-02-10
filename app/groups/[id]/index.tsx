import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { shareGroup, removeMemberFromGroup } from '@/lib/group-utils';

export default function GroupDetailsPage() {
    const router = useRouter();
    const { id: groupId } = useLocalSearchParams();
    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

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
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 flex-row items-center border-b border-gray-100">
                <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                    <Text className="text-blue-600 font-bold">← Volver</Text>
                </Pressable>
                <Text className="text-lg font-bold flex-1 text-center" numberOfLines={1}>
                    {group?.name}
                </Text>
                <Pressable onPress={handleShare} className="p-2">
                    <Text className="text-blue-600 font-bold">Compartir</Text>
                </Pressable>
            </View>

            <ScrollView className="flex-1 bg-gray-50">
                <View className="bg-white p-6 items-center border-b border-gray-100">
                    <View className="w-20 h-20 bg-indigo-50 rounded-3xl items-center justify-center mb-4">
                        <Text className="text-4xl">{group?.icon || '🎁'}</Text>
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{group?.name}</Text>
                    <Text className="text-gray-500 mt-1">Código: <Text className="font-bold text-gray-900">{group?.id}</Text></Text>
                </View>

                <View className="p-6">
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                        Participantes ({members.length})
                    </Text>

                    <View className="bg-white rounded-3xl overflow-hidden border border-gray-100">
                        {members.map((member, index) => (
                            <Pressable
                                key={member.user_id}
                                onPress={() => router.push({
                                    pathname: "/wishlist/[id]",
                                    params: { id: member.user_id, name: member.profiles?.display_name || 'Usuario' }
                                } as any)}
                                className={`flex-row items-center p-4 ${index !== members.length - 1 ? 'border-b border-gray-50' : ''}`}
                            >
                                <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center overflow-hidden border border-gray-100">
                                    {member.profiles?.avatar_url ? (
                                        <Text className="text-xl">{member.profiles.avatar_url}</Text>
                                    ) : (
                                        <Text className="text-gray-400 font-bold">{member.profiles?.display_name?.charAt(0)}</Text>
                                    )}
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-bold text-gray-900">
                                        {member.profiles?.display_name || 'Usuario sin nombre'}
                                        {member.user_id === user?.id && <Text className="text-blue-500 text-xs"> (Tú)</Text>}
                                    </Text>
                                    <View className="flex-row items-center">
                                        <Text className="text-[10px] text-gray-400 uppercase font-black">
                                            {member.role === 'admin' ? 'Organizador' : 'Participante'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-gray-400 text-lg">›</Text>
                            </Pressable>
                        ))}
                    </View>

                    {isAdmin && (
                        <View className="mt-8 space-y-4">
                            <Pressable
                                className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/20"
                                onPress={() => {
                                    // Abrir modal de Amigo Invisible (Próximamente integración)
                                    Alert.alert('Próximamente', 'La función de Amigo Invisible estará disponible pronto en la versión PWA.');
                                }}
                            >
                                <Text className="text-white text-center font-bold">Sortear Amigo Invisible</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

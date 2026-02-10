import React, { useState, useEffect } from 'react'
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { getCssColor } from '@/lib/color-utils'

export interface ProfileTabProps {
    userId: string;
}

export function ProfileTab({ userId }: ProfileTabProps) {
    const [displayName, setDisplayName] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState('👤')
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    // Style Information State
    const [shirtSize, setShirtSize] = useState('')
    const [pantsSize, setPantsSize] = useState('')
    const [shoeSize, setShoeSize] = useState('')
    const [favoriteBrands, setFavoriteBrands] = useState('')
    const [favoriteColor, setFavoriteColor] = useState('')

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('display_name, avatar_url, shirt_size, pants_size, shoe_size, favorite_brands, favorite_color')
                    .eq('id', userId)
                    .single()

                if (error) throw error

                if (data) {
                    setDisplayName(data.display_name || '')
                    setSelectedAvatar(data.avatar_url || '👤')
                    setShirtSize(data.shirt_size || '')
                    setPantsSize(data.pants_size || '')
                    setShoeSize(data.shoe_size || '')
                    setFavoriteBrands(data.favorite_brands || '')
                    setFavoriteColor(data.favorite_color || '')
                }
            } catch (err: any) {
                console.error('Error fetching profile:', err)
                setError('Error al cargar el perfil')
            } finally {
                setLoading(false)
            }
        }

        if (userId) {
            fetchProfile()
        }
    }, [userId])

    const handleProfileSubmit = async () => {
        setSaving(true)
        setError('')
        setSuccess(false)

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    display_name: displayName,
                    avatar_url: selectedAvatar,
                    shirt_size: shirtSize,
                    pants_size: pantsSize,
                    shoe_size: shoeSize,
                    favorite_brands: favoriteBrands,
                    favorite_color: favoriteColor,
                    updated_at: new Date().toISOString(),
                })

            if (updateError) throw updateError

            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
            console.error('Error actualizando perfil:', err)
            setError(err.message || 'Error al guardar el perfil')
        } finally {
            setSaving(false)
        }
    }

    const isFormValid = displayName.trim().length >= 3

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center p-20">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <View className="flex-1 p-4 pb-20">
            <View className="flex-row justify-between items-end mb-8 px-2">
                <View>
                    <Text className="text-3xl font-black text-zinc-900 dark:text-white">Mi Perfil</Text>
                    <Text className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">Personaliza cómo te ven los demás</Text>
                </View>
            </View>

            <View className="w-full max-w-2xl mx-auto bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                {error && (
                    <View className="mb-6 rounded-2xl bg-red-50 dark:bg-red-900/10 p-4 border border-red-100 dark:border-red-900/20">
                        <Text className="text-sm text-red-600 dark:text-red-400 font-bold text-center">{error}</Text>
                    </View>
                )}

                {success && (
                    <View className="mb-6 rounded-2xl bg-green-50 dark:bg-green-900/10 p-4 border border-green-100 dark:border-green-900/20">
                        <Text className="text-sm text-green-600 dark:text-green-400 font-bold text-center">¡Perfil actualizado!</Text>
                    </View>
                )}

                <View className="items-center mb-10">
                    <Pressable
                        onPress={() => setShowAvatarModal(true)}
                        className="w-24 h-24 rounded-full bg-zinc-50 dark:bg-zinc-800 items-center justify-center border-4 border-zinc-100 dark:border-zinc-800 shadow-sm"
                    >
                        <Text style={{ fontSize: 44 }}>{selectedAvatar}</Text>
                        <View className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full items-center justify-center border-2 border-white dark:border-zinc-900">
                            <Text style={{ color: 'white', fontSize: 12 }}>🖋️</Text>
                        </View>
                    </Pressable>
                    <Text className="mt-4 text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Avatar Personal</Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Nombre Público</Text>
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            className="w-full px-6 py-4 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                            placeholder="Tu nombre"
                        />
                    </View>

                    <View className="pt-6 border-t border-zinc-50 dark:border-zinc-800">
                        <Text className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-6">Tallas y Estilo</Text>

                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Camiseta</Text>
                                <TextInput
                                    value={shirtSize}
                                    onChangeText={setShirtSize}
                                    placeholder="M, L, XL..."
                                    className="w-full px-5 py-3.5 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Pantalón</Text>
                                <TextInput
                                    value={pantsSize}
                                    onChangeText={setPantsSize}
                                    placeholder="42, 32..."
                                    className="w-full px-5 py-3.5 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Zapatos</Text>
                                <TextInput
                                    value={shoeSize}
                                    onChangeText={setShoeSize}
                                    placeholder="Ej: 43..."
                                    className="w-full px-5 py-3.5 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Color Fav.</Text>
                                <View className="relative">
                                    <TextInput
                                        value={favoriteColor}
                                        onChangeText={setFavoriteColor}
                                        placeholder="Azul, Rojo..."
                                        className="w-full px-5 py-3.5 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                                    />
                                    <View
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border border-black/10 shadow-sm"
                                        style={{ backgroundColor: getCssColor(favoriteColor) }}
                                    />
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Marcas Favoritas</Text>
                            <TextInput
                                value={favoriteBrands}
                                onChangeText={setFavoriteBrands}
                                placeholder="Ej: Nike, Apple, Levi's..."
                                multiline
                                numberOfLines={2}
                                className="w-full px-5 py-3.5 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                            />
                        </View>
                    </View>

                    <Pressable
                        onPress={handleProfileSubmit}
                        disabled={saving || !isFormValid}
                        className={`w-full py-5 rounded-[1.5rem] items-center justify-center shadow-xl transition-all ${saving || !isFormValid ? 'bg-zinc-200' : 'bg-indigo-600 shadow-indigo-600/30 active:scale-[0.98]'}`}
                    >
                        <Text className="text-white font-black text-lg">
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            {showAvatarModal && (
                <View className="absolute inset-0 z-[100] items-center justify-center px-4 bg-black/60" style={Platform.OS === 'web' ? { position: 'fixed' as any } : {}}>
                    <Pressable className="absolute inset-0" onPress={() => setShowAvatarModal(false)} />
                    <View className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl">
                        <Text className="text-xl font-black text-zinc-900 dark:text-white mb-8 text-center uppercase tracking-widest">
                            Elige tu avatar
                        </Text>
                        <View className="flex-row flex-wrap justify-center gap-3 mb-8">
                            {['👤', '😊', '😎', '🤓', '🥳', '😇', '🤩', '🦸', '🧙', '👨‍💻', '👩‍💻', '🎨', '🎭', '🎪', '⭐'].map((emoji) => (
                                <Pressable
                                    key={emoji}
                                    onPress={() => {
                                        setSelectedAvatar(emoji)
                                        setShowAvatarModal(false)
                                    }}
                                    className={`w-14 h-14 items-center justify-center rounded-2xl border-2 transition-all ${selectedAvatar === emoji ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-50 dark:border-zinc-800'}`}
                                >
                                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <Pressable
                            onPress={() => setShowAvatarModal(false)}
                            className="w-full py-4 items-center"
                        >
                            <Text className="text-zinc-400 font-bold">Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    )
}

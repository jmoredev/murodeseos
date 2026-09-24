import React, { useState, useEffect } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { getCssColor } from '@/lib/color-utils'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

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
                <ActivityIndicator size="large" color="#aa2c32" />
            </View>
        );
    }

    return (
        <View className="flex-1 p-4 pb-20">
            <View className="flex-row justify-between items-end mb-8 px-2">
                <View>
                    <Text className="text-3xl font-display text-on-background tracking-tight">Mi perfil</Text>
                    <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">Personaliza cómo te ven los demás</Text>
                </View>
            </View>

            <View className="w-full max-w-2xl mx-auto bg-surface-container-lowest p-8 rounded-3xl shadow-ambient">
                {error && (
                    <View className="mb-6 rounded-2xl bg-primary/8 p-4">
                        <Text className="text-sm text-primary font-sans-bold text-center">{error}</Text>
                    </View>
                )}

                {success && (
                    <View className="mb-6 rounded-2xl bg-tertiary/12 p-4">
                        <Text className="text-sm text-tertiary font-sans-bold text-center">¡Perfil actualizado!</Text>
                    </View>
                )}

                <View className="items-center mb-10">
                    <Pressable
                        onPress={() => setShowAvatarModal(true)}
                        className="w-24 h-24 rounded-full bg-surface-container-low items-center justify-center shadow-ambient"
                    >
                        <Text style={{ fontSize: 44 }}>{selectedAvatar}</Text>
                        <View className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full items-center justify-center ring-2 ring-surface-container-lowest">
                            <Text style={{ color: 'white', fontSize: 12 }}>🖋️</Text>
                        </View>
                    </Pressable>
                    <Text className="mt-4 text-[10px] text-on-surface/45 font-sans-bold uppercase tracking-[0.2em]">Avatar personal</Text>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-3 ml-1">Nombre público</Text>
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            className="w-full px-6 py-4 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                            placeholder="Tu nombre"
                        />
                    </View>

                    <View className="pt-8 mt-2 bg-surface-container-low -mx-2 px-2 py-6 rounded-2xl">
                        <Text className="text-[10px] font-sans-bold text-primary uppercase tracking-[0.3em] mb-6">Tallas y estilo</Text>

                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2 ml-1">Camiseta</Text>
                                <TextInput
                                    value={shirtSize}
                                    onChangeText={setShirtSize}
                                    placeholder="M, L, XL..."
                                    className="w-full px-5 py-3.5 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2 ml-1">Pantalón</Text>
                                <TextInput
                                    value={pantsSize}
                                    onChangeText={setPantsSize}
                                    placeholder="42, 32..."
                                    className="w-full px-5 py-3.5 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2 ml-1">Zapatos</Text>
                                <TextInput
                                    value={shoeSize}
                                    onChangeText={setShoeSize}
                                    placeholder="Ej: 43..."
                                    className="w-full px-5 py-3.5 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2 ml-1">Color favorito</Text>
                                <View className="relative">
                                    <TextInput
                                        value={favoriteColor}
                                        onChangeText={setFavoriteColor}
                                        placeholder="Azul, Rojo..."
                                        className="w-full px-5 py-3.5 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                                    />
                                    <View
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border border-black/10 shadow-sm"
                                        style={{ backgroundColor: getCssColor(favoriteColor) }}
                                    />
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2 ml-1">Marcas favoritas</Text>
                            <TextInput
                                value={favoriteBrands}
                                onChangeText={setFavoriteBrands}
                                placeholder="Ej: Nike, Apple, Levi's..."
                                multiline
                                numberOfLines={2}
                                className="w-full px-5 py-3.5 rounded-2xl bg-surface-container-highest text-on-background font-sans-semibold"
                            />
                        </View>
                    </View>

                    <PrimaryButton
                        onPress={handleProfileSubmit}
                        disabled={saving || !isFormValid}
                        textClassName="text-on-primary font-sans-bold text-base"
                        accessibilityLabel={saving ? 'Guardando perfil' : 'Guardar cambios del perfil'}
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </PrimaryButton>
                </View>
            </View>

            {showAvatarModal && (
                <View className="absolute inset-0 z-[100] items-center justify-center px-4 bg-black/60" style={Platform.OS === 'web' ? { position: 'fixed' as any } : {}}>
                    <Pressable className="absolute inset-0" onPress={() => setShowAvatarModal(false)} />
                    <View className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-8 shadow-ambient-lg">
                        <Text className="text-xl font-display text-on-background mb-8 text-center uppercase tracking-widest">
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
                                    className={`w-14 h-14 items-center justify-center rounded-2xl transition-all ${selectedAvatar === emoji ? 'bg-primary/12 ring-2 ring-primary/30' : 'bg-surface-container-low'}`}
                                >
                                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <Pressable
                            onPress={() => setShowAvatarModal(false)}
                            className="w-full py-4 items-center"
                        >
                            <Text className="text-primary font-sans-bold">Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    )
}

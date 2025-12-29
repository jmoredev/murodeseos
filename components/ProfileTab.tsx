'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCssColor } from '@/lib/color-utils'

interface ProfileTabProps {
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

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
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
            // Ocultar mensaje de éxito después de 3 segundos
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
            <div className="flex items-center justify-center p-20">
                <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mi Perfil</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Personaliza cómo te ven los demás</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium text-center">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4 border border-green-100 dark:border-green-800">
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium text-center">¡Perfil actualizado correctamente!</p>
                    </div>
                )}

                {/* Avatar Selection */}
                <div className="flex flex-col items-center">
                    <button
                        type="button"
                        onClick={() => setShowAvatarModal(true)}
                        className="relative group"
                    >
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-5xl border-2 border-transparent group-hover:border-indigo-500 transition-all duration-200 shadow-sm group-hover:shadow-md">
                            {selectedAvatar}
                        </div>
                        <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </div>
                    </button>
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500 font-medium">
                        Toca para cambiar tu avatar
                    </p>
                </div>

                <div>
                    <label htmlFor="displayName" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Nombre para mostrar
                    </label>
                    <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        required
                        placeholder="Tu nombre"
                        minLength={3}
                    />
                    <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">
                        Mínimo 3 caracteres
                    </p>
                </div>

                {/* Extended Profile Fields */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.07 1.66L2 13.08a7 7 0 0 0 4.74 6.6l5.26 2.32 5.26-2.32A7 7 0 0 0 22 13.08l-.55-7.96a2 2 0 0 0-1.07-1.66z"></path></svg>
                        Tallas y Estilo
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase">Camiseta</label>
                            <input
                                type="text"
                                value={shirtSize}
                                onChange={(e) => setShirtSize(e.target.value)}
                                placeholder="M, L, XL..."
                                className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase">Pantalón</label>
                            <input
                                type="text"
                                value={pantsSize}
                                onChange={(e) => setPantsSize(e.target.value)}
                                placeholder="42, 32..."
                                className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase">Zapatos</label>
                            <input
                                type="text"
                                value={shoeSize}
                                onChange={(e) => setShoeSize(e.target.value)}
                                placeholder="Ej: 43..."
                                className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase">Color Fav.</label>
                            <div className="relative group/color">
                                <input
                                    type="text"
                                    value={favoriteColor}
                                    onChange={(e) => setFavoriteColor(e.target.value)}
                                    placeholder="Azul, Rojo..."
                                    className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 pl-4 pr-12 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                                <div
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border border-black/10 shadow-sm transition-transform group-focus-within/color:scale-110"
                                    style={{ backgroundColor: getCssColor(favoriteColor) }}
                                    title="Previsualización del color"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1 uppercase">Marcas Favoritas</label>
                        <textarea
                            value={favoriteBrands}
                            onChange={(e) => setFavoriteBrands(e.target.value)}
                            placeholder="Ej: Nike, Apple, Levi's..."
                            rows={2}
                            className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving || !isFormValid}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Guardando...
                        </>
                    ) : 'Guardar cambios'}
                </button>
            </form>

            {/* Avatar Modal Card */}
            {showAvatarModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAvatarModal(false)}></div>
                    <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden"></div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 text-center">
                            Elige tu avatar
                        </h3>
                        <div className="grid grid-cols-5 gap-3 mb-8">
                            {['👤', '😊', '😎', '🤓', '🥳', '😇', '🤩', '🦸', '🧙', '👨‍💻', '👩‍💻', '🎨', '🎭', '🎪', '⭐'].map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        setSelectedAvatar(emoji)
                                        setShowAvatarModal(false)
                                    }}
                                    className={`p-3 text-3xl rounded-xl border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center ${selectedAvatar === emoji
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 scale-110 shadow-sm'
                                        : 'border-zinc-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                        }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAvatarModal(false)}
                            className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

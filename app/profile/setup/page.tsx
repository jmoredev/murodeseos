'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfileSetupPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [displayName, setDisplayName] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState('👤')
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                console.log('No se encontró usuario, redirigiendo a login...')
                router.replace('/login')
                return
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: displayName,
                    avatar_url: selectedAvatar,
                    updated_at: new Date().toISOString(),
                })

            if (updateError) throw updateError

            // Avanzar al paso 2
            setStep(2)
        } catch (err: any) {
            console.error('Error actualizando perfil:', err)
            setError(err.message || 'Error al guardar el perfil')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateGroup = () => {
        router.push('/groups/create')
    }

    const handleJoinGroup = () => {
        router.push('/groups/join')
    }

    const isFormValid = displayName.trim().length >= 3

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-2xl transition-all border border-gray-100 dark:border-gray-700 m-4">

                {step === 1 ? (
                    // PASO 1: Configuración de Perfil
                    <>
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-extrabold text-muro-principal dark:text-white">
                                ¡Casi terminamos!
                            </h1>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Necesitamos un nombre para mostrar en tu perfil antes de continuar.
                            </p>
                        </div>

                        <form onSubmit={handleProfileSubmit} className="space-y-6">
                            {error && (
                                <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20 animate-pulse">
                                    <p className="text-sm text-urgencia-coral font-medium text-center">{error}</p>
                                </div>
                            )}

                            {/* Avatar clickeable */}
                            <div className="flex flex-col items-center">
                                <button
                                    type="button"
                                    onClick={() => setShowAvatarModal(true)}
                                    className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-deseo-acento/20 text-4xl hover:bg-deseo-acento/30 transition-all duration-200 hover:scale-110 cursor-pointer border-2 border-transparent hover:border-deseo-acento"
                                    title="Cambiar avatar"
                                >
                                    {selectedAvatar}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                    Toca para cambiar tu avatar
                                </p>
                            </div>

                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Nombre para mostrar <span className="text-urgencia-coral">*</span>
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3.5 shadow-sm focus:border-deseo-acento focus:ring-deseo-acento sm:text-sm bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-200 ease-in-out hover:bg-white dark:hover:bg-gray-900"
                                    required
                                    placeholder="Ej: Soñador Experto"
                                    minLength={3}
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                    Mínimo 3 caracteres.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className="w-full flex justify-center rounded-xl bg-deseo-acento px-4 py-3.5 text-sm font-bold text-muro-principal shadow-lg shadow-deseo-acento/20 hover:shadow-deseo-acento/40 focus:outline-none focus:ring-2 focus:ring-deseo-acento focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-muro-principal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Guardando...
                                    </span>
                                ) : 'Continuar'}
                            </button>
                        </form>

                        {/* Modal de Selección de Avatar */}
                        {showAvatarModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAvatarModal(false)}>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full m-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
                                    <h3 className="text-xl font-bold text-muro-principal dark:text-white mb-4 text-center">
                                        Elige tu Avatar
                                    </h3>
                                    <div className="grid grid-cols-5 gap-3 mb-6">
                                        {['👤', '😊', '😎', '🤓', '🥳', '😇', '🤩', '🦸', '🧙', '👨‍💻', '👩‍💻', '🎨', '🎭', '🎪', '⭐'].map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedAvatar(emoji)
                                                    setShowAvatarModal(false)
                                                }}
                                                className={`p-3 text-3xl rounded-xl border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center ${selectedAvatar === emoji
                                                        ? 'border-deseo-acento bg-deseo-acento/20 scale-110'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-deseo-acento/50'
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAvatarModal(false)}
                                        className="w-full rounded-lg bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    // PASO 2: Selección de Grupo
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deseo-acento/20 mb-4">
                                <svg className="h-6 w-6 text-muro-principal dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-extrabold text-muro-principal dark:text-white">
                                ¿Cómo quieres empezar?
                            </h1>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Puedes crear tu propio grupo para compartir deseos o unirte a uno ya existente.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <button
                                onClick={handleCreateGroup}
                                className="group relative flex items-center p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-deseo-acento dark:hover:border-deseo-acento bg-white dark:bg-gray-800 transition-all duration-200 hover:shadow-lg text-left w-full"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-deseo-acento group-hover:text-muro-principal transition-colors">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Crear nuevo grupo</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Empieza una nueva lista compartida</p>
                                </div>
                            </button>

                            <button
                                onClick={handleJoinGroup}
                                className="group relative flex items-center p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-deseo-acento dark:hover:border-deseo-acento bg-white dark:bg-gray-800 transition-all duration-200 hover:shadow-lg text-left w-full"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-deseo-acento group-hover:text-muro-principal transition-colors">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Unirme a un grupo</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Usa un código de invitación</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

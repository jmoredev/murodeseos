'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createGroup, shareGroup } from '@/lib/group-utils'

// Lista de emojis predefinidos para iconos de grupo
const EMOJI_OPTIONS = ['🎁', '🎉', '🎄', '🎂', '💝', '🎈', '⭐', '🌟', '💫', '🎊', '🏆', '👨‍👩‍👧‍👦', '❤️', '🎀', '🌈']

export default function CreateGroupPage() {
    const router = useRouter()
    const [groupName, setGroupName] = useState('')
    const [selectedIcon, setSelectedIcon] = useState('🎁')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.replace('/login')
                return
            }

            // Crear el grupo
            const group = await createGroup({
                name: groupName,
                icon: selectedIcon,
                creatorId: user.id,
            })

            setCreatedGroup({ id: group.id, name: group.name })

            // Invalidate groups cache
            sessionStorage.removeItem(`groups_${user.id}`)


            // Intentar compartir inmediatamente
            const shared = await shareGroup(group.name, group.id)

            if (!shared && !navigator.share) {
                // Si no se pudo compartir y no hay Web Share API, mostrar el código
                alert(`Grupo creado con éxito!\n\nCódigo: ${group.id}\n\nComparte este código con tus amigos.`)
            }

        } catch (err: any) {
            console.error('Error creando grupo:', err)
            setError(err.message || 'Error al crear el grupo')
        } finally {
            setLoading(false)
        }
    }

    const handleShareAgain = async () => {
        if (createdGroup) {
            await shareGroup(createdGroup.name, createdGroup.id)
        }
    }

    const handleContinue = () => {
        router.push('/')
    }

    const isFormValid = groupName.trim().length >= 3

    return (
        <div className="min-h-screen flex items-center justify-center bg-fondo-base dark:bg-gray-900 p-4 transition-colors duration-300">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">

                {!createdGroup ? (
                    // Formulario de creación
                    <>
                        <div className="text-center mb-8">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deseo-acento/20 mb-4">
                                <svg className="h-6 w-6 text-muro-principal dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-extrabold text-muro-principal dark:text-white">
                                Crear nuevo grupo
                            </h1>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Configura tu grupo de regalos y compártelo con tus amigos
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20">
                                    <p className="text-sm text-urgencia-coral font-medium text-center">{error}</p>
                                </div>
                            )}

                            {/* Nombre del Grupo */}
                            <div>
                                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Nombre del grupo <span className="text-urgencia-coral">*</span>
                                </label>
                                <input
                                    id="groupName"
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3.5 shadow-sm focus:border-deseo-acento focus:ring-deseo-acento sm:text-sm bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-200"
                                    required
                                    placeholder="Ej: Familia García, Amigos 2024..."
                                    minLength={3}
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                    Mínimo 3 caracteres.
                                </p>
                            </div>

                            {/* Selector de Icono */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Icono del grupo
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {EMOJI_OPTIONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setSelectedIcon(emoji)}
                                            className={`p-3 text-2xl rounded-lg border-2 transition-all duration-200 hover:scale-110 ${selectedIcon === emoji
                                                ? 'border-deseo-acento bg-deseo-acento/10 scale-110'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-deseo-acento/50'
                                                }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
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
                                        Creando...
                                    </span>
                                ) : 'Crear y compartir'}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => router.push('/?tab=groups')}
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-muro-principal dark:hover:text-white transition-colors"
                                >
                                    ← Volver
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    // Pantalla de éxito
                    <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-muro-principal dark:text-white">
                                ¡Grupo creado!
                            </h2>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Tu código de grupo es:
                            </p>
                            <div className="mt-4 p-4 bg-deseo-acento/10 rounded-xl border-2 border-deseo-acento/20">
                                <p className="text-3xl font-bold text-muro-principal dark:text-white tracking-wider">
                                    {createdGroup.id}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleShareAgain}
                            className="w-full flex justify-center items-center gap-2 rounded-xl bg-muro-principal text-white px-4 py-3 text-sm font-bold shadow-lg hover:opacity-90 transition-all duration-200"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Compartir de nuevo
                        </button>

                        <button
                            onClick={handleContinue}
                            className="w-full flex justify-center rounded-xl bg-deseo-acento px-4 py-3 text-sm font-bold text-muro-principal shadow-lg shadow-deseo-acento/20 hover:shadow-deseo-acento/40 transition-all duration-200 transform hover:-translate-y-0.5"
                        >
                            Continuar al inicio
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

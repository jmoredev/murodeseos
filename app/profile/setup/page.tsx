'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfileSetupPage() {
    const router = useRouter()
    const [displayName, setDisplayName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error('No se encontró usuario autenticado')

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: displayName,
                    updated_at: new Date().toISOString(),
                })

            if (updateError) throw updateError

            // Redirigir al home una vez completado
            router.push('/')
            router.refresh()
        } catch (err: any) {
            console.error('Error actualizando perfil:', err)
            setError(err.message || 'Error al guardar el perfil')
        } finally {
            setLoading(false)
        }
    }

    const isFormValid = displayName.trim().length >= 3

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-2xl transition-all border border-gray-100 dark:border-gray-700 m-4">
                <div className="text-center mb-8">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deseo-acento/20 mb-4">
                        <svg className="h-6 w-6 text-muro-principal dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold text-muro-principal dark:text-white">
                        ¡Casi terminamos!
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Necesitamos un nombre para mostrar en tu perfil antes de continuar.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20 animate-pulse">
                            <p className="text-sm text-urgencia-coral font-medium text-center">{error}</p>
                        </div>
                    )}

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
            </div>
        </div>
    )
}

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

    return (
        <div className="min-h-screen flex items-center justify-center bg-fondo-base dark:bg-gray-900 p-4 transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-muro-principal dark:text-white">
                        Completa tu perfil
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Elige un nombre para que los demás te reconozcan
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20">
                            <p className="text-sm text-urgencia-coral">{error}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nombre para mostrar
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 shadow-sm focus:border-deseo-acento focus:ring-deseo-acento sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
                            required
                            placeholder="Ej: Soñador Experto"
                            minLength={3}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center rounded-lg bg-deseo-acento px-4 py-3 text-sm font-bold text-muro-principal shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-deseo-acento focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                    >
                        {loading ? 'Guardando...' : 'Completar perfil'}
                    </button>
                </form>
            </div>
        </div>
    )
}

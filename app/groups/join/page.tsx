'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { joinGroup } from '@/lib/group-utils'

function JoinGroupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [groupCode, setGroupCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')

    // Si viene un código en la URL (deep link), pre-llenarlo
    useEffect(() => {
        const codeFromUrl = searchParams.get('code')
        if (codeFromUrl) {
            setGroupCode(codeFromUrl.toUpperCase())
        }
    }, [searchParams])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Convertir automáticamente a mayúsculas
        const value = e.target.value.toUpperCase()
        setGroupCode(value)
        setError('') // Limpiar error al escribir
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.replace('/login')
                return
            }

            // Intentar unirse al grupo
            const result = await joinGroup({
                groupCode,
                userId: user.id,
            })

            if (result.alreadyMember) {
                setSuccessMessage(`Ya eres miembro de "${result.group.name}"`)
                // Redirigir después de un breve delay
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            } else {
                setSuccessMessage(`¡Te has unido a "${result.group.name}" exitosamente!`)

                // Invalidate groups cache
                sessionStorage.removeItem(`groups_${user.id}`)

                // Redirigir después de un breve delay
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            }

        } catch (err: any) {
            console.error('Error al unirse al grupo:', err)
            setError(err.message || 'Error al unirse al grupo')
        } finally {
            setLoading(false)
        }
    }

    const isFormValid = groupCode.trim().length >= 6

    return (
        <div className="min-h-screen flex items-center justify-center bg-fondo-base dark:bg-gray-900 p-4 transition-colors duration-300">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">

                <div className="text-center mb-8">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deseo-acento/20 mb-4">
                        <svg className="h-6 w-6 text-muro-principal dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold text-muro-principal dark:text-white">
                        Unirse a un grupo
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Introduce el código que te compartieron
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20 animate-pulse">
                            <p className="text-sm text-urgencia-coral font-medium text-center">{error}</p>
                        </div>
                    )}

                    {successMessage && (
                        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
                            <p className="text-sm text-green-800 dark:text-green-300 font-medium text-center">{successMessage}</p>
                        </div>
                    )}

                    {/* Campo de Código */}
                    <div>
                        <label htmlFor="groupCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Código del grupo <span className="text-urgencia-coral">*</span>
                        </label>
                        <input
                            id="groupCode"
                            type="text"
                            value={groupCode}
                            onChange={handleInputChange}
                            className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3.5 shadow-sm focus:border-deseo-acento focus:ring-deseo-acento text-center text-2xl font-bold tracking-widest bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-200 uppercase"
                            required
                            placeholder="X7K9P2"
                            minLength={6}
                            maxLength={8}
                            autoFocus
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 text-center">
                            Introduce el código de 6-8 caracteres
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
                                Uniéndome...
                            </span>
                        ) : 'Unirme'}
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
            </div>
        </div>
    )
}

export default function JoinGroupPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
            <JoinGroupContent />
        </Suspense>
    )
}


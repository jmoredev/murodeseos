'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [emailError, setEmailError] = useState('')

    // Función para validar formato de email
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    // Verificar si viene desde registro exitoso
    useEffect(() => {
        if (searchParams.get('registered') === 'true') {
            setSuccessMessage('¡Cuenta creada exitosamente! Por favor, inicia sesión.')
        }
    }, [searchParams])

    // Validar email cuando cambia
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value
        setEmail(newEmail)

        if (newEmail && !validateEmail(newEmail)) {
            setEmailError('Por favor, introduce un correo electrónico válido')
        } else {
            setEmailError('')
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccessMessage('')

        // Validar formato de email antes de enviar
        if (!validateEmail(email)) {
            setEmailError('Por favor, introduce un correo electrónico válido')
            return
        }

        setLoading(true)

        try {
            // Intentar iniciar sesión
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (loginError) {
                // Manejar diferentes tipos de errores
                if (loginError.message.includes('Invalid login credentials') ||
                    loginError.message.includes('Invalid') ||
                    loginError.message.includes('credentials')) {
                    setError('Correo electrónico o contraseña incorrectos')
                } else if (loginError.message.includes('Email not confirmed')) {
                    setError('Por favor, confirma tu correo electrónico antes de iniciar sesión')
                } else {
                    setError(loginError.message)
                }
                setLoading(false)
                return
            }

            // Login exitoso
            console.log('Usuario autenticado exitosamente:', data)

            if (data.user) {
                // Verificar si el perfil está completo
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', data.user.id)
                    .single()

                // Si no hay perfil o no tiene display_name, redirigir a configuración
                if (!profile || !profile.display_name) {
                    router.push('/profile/setup')
                } else {
                    router.push('/')
                }
            }

        } catch (err) {
            console.error('Error durante el inicio de sesión:', err)
            setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.')
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-fondo-base dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-muro-principal dark:text-white">
                        Bienvenido de nuevo
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Inicia sesión para acceder a tu lista de deseos
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {successMessage && (
                        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                                        ¡Éxito!
                                    </h3>
                                    <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                                        <p>{successMessage}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-urgencia-coral">
                                        Error de inicio de sesión
                                    </h3>
                                    <div className="mt-2 text-sm text-urgencia-coral/90">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Correo electrónico
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className={`block w-full rounded-lg border ${emailError
                                        ? 'border-urgencia-coral focus:border-urgencia-coral focus:ring-urgencia-coral'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                                        } px-3 py-2 shadow-sm focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors`}
                                    placeholder="tu@ejemplo.com"
                                    value={email}
                                    onChange={handleEmailChange}
                                />
                                {emailError && (
                                    <p className="mt-1 text-sm text-urgencia-coral">{emailError}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Contraseña
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full justify-center rounded-lg bg-deseo-acento px-4 py-2.5 text-sm font-bold text-muro-principal shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deseo-acento disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                        >
                            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                        </button>
                    </div>
                </form>

                <div className="text-center text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                        ¿No tienes una cuenta?{' '}
                        <Link href="/signup" className="font-medium text-muro-principal hover:text-deseo-acento dark:text-gray-300 dark:hover:text-deseo-acento transition-colors">
                            Regístrate
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

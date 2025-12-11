'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [confirmPasswordError, setConfirmPasswordError] = useState('')

    // Función para validar formato de email
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    // Validar email principal cuando cambia
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value
        setEmail(newEmail)

        if (newEmail && !validateEmail(newEmail)) {
            setEmailError('Por favor, introduce un correo electrónico válido')
        } else {
            setEmailError('')
        }
    }

    // Validar contraseña de confirmación cuando cambia
    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newConfirmPassword = e.target.value
        setConfirmPassword(newConfirmPassword)

        if (newConfirmPassword && password && newConfirmPassword !== password) {
            setConfirmPasswordError('Las contraseñas no coinciden')
        } else {
            setConfirmPasswordError('')
        }
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validar formato de email
        if (!validateEmail(email)) {
            setEmailError('Por favor, introduce un correo electrónico válido')
            return
        }

        // Validar que las contraseñas coincidan
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }

        setLoading(true)

        try {
            // Intentar registrar al usuario
            const { data, error: signupError } = await supabase.auth.signUp({
                email,
                password,
            })

            if (signupError) {
                // Verificar si el error es porque el usuario ya existe
                if (signupError.message.includes('already registered') ||
                    signupError.message.includes('User already registered')) {
                    setError('Este correo electrónico ya está registrado en el sistema')
                } else if (signupError.message.includes('Password')) {
                    setError('La contraseña debe tener al menos 6 caracteres')
                } else {
                    setError(signupError.message)
                }
                setLoading(false)
                return
            }

            // Registro exitoso


            // Redirigir al login con mensaje de éxito
            router.push('/login?registered=true')

        } catch (err) {
            console.error('Error durante el registro:', err)
            setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.')
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-fondo-base dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-300">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-muro-principal dark:text-white">
                        Crear una cuenta
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Únete a Muro de deseos hoy
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSignup}>
                    {error && (
                        <div className="rounded-md bg-urgencia-coral/10 p-4 border border-urgencia-coral/20">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-urgencia-coral">
                                        Error de registro
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
                                    autoComplete="new-password"
                                    required
                                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Confirmar contraseña
                            </label>
                            <div className="mt-1">
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    className={`block w-full rounded-lg border ${confirmPasswordError
                                        ? 'border-urgencia-coral focus:border-urgencia-coral focus:ring-urgencia-coral'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
                                        } px-3 py-2 shadow-sm focus:outline-none sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors`}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={handleConfirmPasswordChange}
                                />
                                {confirmPasswordError && (
                                    <p className="mt-1 text-sm text-urgencia-coral">{confirmPasswordError}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full justify-center rounded-lg bg-deseo-acento px-4 py-2.5 text-sm font-bold text-muro-principal shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deseo-acento disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                        >
                            {loading ? 'Creando cuenta...' : 'Registrarse'}
                        </button>
                    </div>
                </form>

                <div className="text-center text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                        ¿Ya tienes una cuenta?{' '}
                        <Link href="/login" className="font-medium text-muro-principal hover:text-deseo-acento dark:text-gray-300 dark:hover:text-deseo-acento transition-colors">
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

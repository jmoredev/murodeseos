'use client'

import { useEffect, useState } from 'react'
import Link from "next/link";
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setUser(session.user)

          // Verificar perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .single()

          if (!profile || !profile.display_name) {
            router.push('/profile/setup')
            return
          }
        }
      } catch (error) {
        console.error('Error checking user:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Suscribirse a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo-base dark:bg-gray-900">
        <div className="text-muro-principal dark:text-white">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fondo-base dark:bg-gray-900 text-center px-4">
      <main className="max-w-4xl space-y-8">
        <h1 className="text-5xl font-extrabold tracking-tight text-muro-principal dark:text-white sm:text-6xl">
          Muro de <span className="text-deseo-acento">Deseos</span>
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-300">
          Comparte tus sueños, organiza tus regalos y haz realidad los deseos de tus amigos.
          La forma más sencilla de gestionar tus listas de regalos.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          {user ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg text-muro-principal dark:text-white font-medium">
                ¡Hola de nuevo!
              </p>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-full bg-urgencia-coral/10 px-8 py-3.5 text-sm font-bold text-urgencia-coral shadow-sm hover:bg-urgencia-coral/20 transition-all"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full bg-deseo-acento px-8 py-3.5 text-sm font-bold text-muro-principal shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deseo-acento transition-all"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-white dark:bg-gray-800 px-8 py-3.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

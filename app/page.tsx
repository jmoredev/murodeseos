'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { WishListTab } from '@/components/WishListTab'
import { GroupsTab } from '@/components/GroupsTab'
import WhatsNewModal from '@/components/WhatsNewModal'

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-fondo-base dark:bg-gray-900">
        <div className="text-muro-principal dark:text-white">Cargando...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'wishlist' | 'groups'>('wishlist')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'groups') {
      setActiveTab('groups')
    } else if (tab === 'wishlist') {
      setActiveTab('wishlist')
    }
  }, [searchParams])
  const [isDesktop, setIsDesktop] = useState(false)

  // Función para verificar sesión
  const verifySession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {

        setUser(null)
        router.push('/login')
        return false
      }

      // Verificar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single()

      if (!profile || !profile.display_name) {
        router.push('/profile/setup')
        return false
      }

      setUser(session.user)
      return true
    } catch (error) {
      console.error('Error verifying session:', error)
      setUser(null)
      router.push('/login')
      return false
    }
  }

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
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Error checking user:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        // Sesión perdida - redirigir a login
        setUser(null)
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // Verificar sesión al cambiar de pestaña
  const handleTabChange = async (tab: 'wishlist' | 'groups') => {
    if (user) {
      const isValid = await verifySession()
      if (isValid) {
        setActiveTab(tab)
      }
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mediaQuery.matches)

    const handleResize = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
    }

    mediaQuery.addEventListener('change', handleResize)
    return () => mediaQuery.removeEventListener('change', handleResize)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo-base dark:bg-gray-900">
        <div className="text-muro-principal dark:text-white">Cargando...</div>
      </div>
    )
  }

  // Render Landing Page if not logged in
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-fondo-base dark:bg-gray-900 text-center px-4">
        <main className="max-w-4xl space-y-8">
          <h1 className="text-5xl font-extrabold tracking-tight text-muro-principal dark:text-white sm:text-6xl">
            Muro de <span className="text-deseo-acento">deseos</span>
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-300">
            Comparte tus sueños, organiza tus regalos y haz realidad los deseos de tus amigos.
            La forma más sencilla de gestionar tus listas de regalos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
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
          </div>
        </main>
      </div>
    );
  }

  // Render Main Screen with Tabs if logged in
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <WhatsNewModal />
      {/* Desktop Top Navbar */}
      {isDesktop ? (
        <header className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                Muro de deseos
              </h1>

              {/* Desktop Tab Navigation */}
              <nav className="flex gap-1">
                <button
                  onClick={() => handleTabChange('wishlist')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'wishlist'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                >
                  Mi lista
                </button>
                <button
                  onClick={() => handleTabChange('groups')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'groups'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                >
                  Mis grupos
                </button>
              </nav>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* Mobile Top Bar */
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              Muro de deseos
            </h1>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
              title="Cerrar sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </header>
      )}

      {/* Tab Content */}
      <div className={isDesktop ? 'pb-0' : 'pb-20'}>
        {activeTab === 'wishlist' ? (
          <WishListTab userId={user.id} />
        ) : (
          <GroupsTab userId={user.id} />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-20">
          <div className="max-w-5xl mx-auto px-4 flex justify-around">
            <button
              onClick={() => handleTabChange('wishlist')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${activeTab === 'wishlist'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span className="text-xs font-medium">Mi lista</span>
            </button>
            <button
              onClick={() => handleTabChange('groups')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${activeTab === 'groups'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span className="text-xs font-medium">Grupos</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

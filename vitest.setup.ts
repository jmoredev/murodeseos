import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: vi.fn(),
    hideAsync: vi.fn(),
}));

// Mock de react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// Mock de next/navigation para tests
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return {
      get: vi.fn(),
    }
  },
  usePathname() {
    return '/'
  },
}))

// Mock de Supabase para tests
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        then(resolve: any) {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return chain;
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test.png' }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://example.com/test.png' } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}))

// Mock de Web Share API
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'share', {
    writable: true,
    value: vi.fn(),
  })

  // Mock de Clipboard API
  Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      writable: true,
      configurable: true
  })
}

// Mock de next/link
vi.mock('next/link', () => {
    return ({ children }: { children: React.ReactNode }) => {
        return children
    }
})

// Mock de sessionStorage
const sessionStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString() },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} }
    }
})()
Object.defineProperty(global, 'sessionStorage', { 
    value: sessionStorageMock,
    writable: true 
})

// Mock de lib/aliases
vi.mock('@/lib/aliases', () => ({
    getUserAliases: vi.fn(),
    setUserAlias: vi.fn()
}))

// Mock de lib/group-utils
vi.mock('@/lib/group-utils', () => ({
    generateUniqueGroupCode: vi.fn(),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
    updateGroupName: vi.fn(),
    deleteGroup: vi.fn(),
    removeMemberFromGroup: vi.fn(),
    generateShareMessage: vi.fn(),
    shareGroup: vi.fn()
}))

// Mock de expo-router
vi.mock('expo-router', () => {
    return {
        Link: ({ children, href, asChild, ...props }: any) => {
            return children;
        },
        useRouter: () => ({
            push: vi.fn(),
            replace: vi.fn(),
            back: vi.fn(),
            setParams: vi.fn(),
        }),
        useFocusEffect: vi.fn(),
        useSegments: () => [],
        usePathname: () => '/',
        useLocalSearchParams: () => ({}),
        useGlobalSearchParams: () => ({}),
    };
});

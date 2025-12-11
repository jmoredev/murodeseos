// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock de next/navigation para tests
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return {
      get: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
}))

// Mock de Supabase para tests
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}))

// Mock de Web Share API
Object.defineProperty(global.navigator, 'share', {
  writable: true,
  value: jest.fn(),
})

// Mock de Clipboard API (configurable para userEvent)
Object.defineProperty(global.navigator, 'clipboard', {
    value: { writeText: jest.fn() },
    writable: true,
    configurable: true
})

// Mock de next/link
jest.mock('next/link', () => {
    return ({ children, href }) => {
        return children
    }
})

// Mock de sessionStorage
const sessionStorageMock = (() => {
    let store = {}
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString() },
        removeItem: (key) => { delete store[key] },
        clear: () => { store = {} }
    }
})()
Object.defineProperty(global, 'sessionStorage', { 
    value: sessionStorageMock,
    writable: true 
})

// Mock de lib/aliases
jest.mock('@/lib/aliases', () => ({
    getUserAliases: jest.fn(),
    setUserAlias: jest.fn()
}))

// Mock de lib/group-utils
jest.mock('@/lib/group-utils', () => ({
    generateUniqueGroupCode: jest.fn(),
    createGroup: jest.fn(),
    joinGroup: jest.fn(),
    updateGroupName: jest.fn(),
    deleteGroup: jest.fn(),
    removeMemberFromGroup: jest.fn(),
    generateShareMessage: jest.fn(),
    shareGroup: jest.fn()
}))

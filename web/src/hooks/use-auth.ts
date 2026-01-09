import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect } from 'react'
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  firebaseSignOut,
  getIdToken,
} from '@/lib/firebase'
import * as authApi from '@/api/auth'
import type { User, Tenant } from '@/api/types'

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null

  // Actions
  setAuth: (user: User | null, tenant: Tenant | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,

      setAuth: (user, tenant) =>
        set({
          user,
          tenant,
          isAuthenticated: !!user,
          isLoading: false,
          error: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error, isLoading: false }),

      clearAuth: () =>
        set({
          user: null,
          tenant: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'otto-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export function useAuth() {
  const store = useAuthStore()

  // Check session on mount - this is a valid use of useEffect for initialization
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await authApi.getMe()
        store.setAuth(response.user, response.tenant)
      } catch {
        store.clearAuth()
      }
    }

    // Only check if we think we're authenticated
    if (store.isAuthenticated) {
      checkSession()
    } else {
      store.setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const registerWithEmail = async (
    email: string,
    password: string,
    workspaceName: string
  ) => {
    store.setLoading(true)
    store.setError(null)

    try {
      // Create Firebase user
      await signUpWithEmail(email, password)

      // Get Firebase ID token
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get Firebase token')
      }

      // Register with our backend
      const response = await authApi.register(idToken, workspaceName)
      store.setAuth(response.user, response.tenant)

      return response
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registration failed'
      store.setError(message)
      throw error
    }
  }

  const loginWithEmail = async (email: string, password: string) => {
    store.setLoading(true)
    store.setError(null)

    try {
      // Sign in with Firebase
      await signInWithEmail(email, password)

      // Get Firebase ID token
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get Firebase token')
      }

      // Login with our backend
      const response = await authApi.login(idToken)
      store.setAuth(response.user, response.tenant)

      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      store.setError(message)
      throw error
    }
  }

  const loginWithGoogle = async () => {
    store.setLoading(true)
    store.setError(null)

    try {
      // Sign in with Google via Firebase
      await signInWithGoogle()

      // Get Firebase ID token
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get Firebase token')
      }

      // Try login first (for existing users)
      try {
        const response = await authApi.login(idToken)
        store.setAuth(response.user, response.tenant)
        return { response, isNewUser: false }
      } catch {
        // User doesn't exist - they need to register with a workspace name
        return { response: null, isNewUser: true }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google sign-in failed'
      store.setError(message)
      throw error
    }
  }

  const registerGoogleUser = async (workspaceName: string) => {
    store.setLoading(true)
    store.setError(null)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get Firebase token')
      }

      const response = await authApi.register(idToken, workspaceName)
      store.setAuth(response.user, response.tenant)
      return response
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registration failed'
      store.setError(message)
      throw error
    }
  }

  const logout = async () => {
    store.setLoading(true)

    try {
      // Logout from our backend
      await authApi.logout()
      // Sign out from Firebase
      await firebaseSignOut()
    } finally {
      store.clearAuth()
    }
  }

  const refreshTenant = async () => {
    try {
      const response = await authApi.getMe()
      store.setAuth(response.user, response.tenant)
    } catch {
      // Ignore errors - tenant might not be available
    }
  }

  return {
    ...store,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    registerGoogleUser,
    logout,
    refreshTenant,
  }
}

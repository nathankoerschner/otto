import { useAuth } from '@/hooks'
import { Landing, Setup } from '@/pages'
import { Dashboard } from '@/components/dashboard'
import { Header, Footer } from '@/components/layout'
import { Loader2 } from 'lucide-react'

type Route = '/' | '/setup' | '/dashboard'

function getInitialRoute(): Route {
  const path = window.location.pathname
  if (path === '/setup') {
    return '/setup'
  }
  if (path === '/dashboard') {
    return '/dashboard'
  }
  return '/'
}

export default function App() {
  const { isAuthenticated, isLoading, tenant } = useAuth()
  const requestedRoute = getInitialRoute()

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Not authenticated - show landing or redirect to setup for registration
  if (!isAuthenticated) {
    if (requestedRoute === '/setup') {
      return <Setup />
    }
    return <Landing />
  }

  // Authenticated but setup not complete - show setup
  if (!tenant?.setupCompleted) {
    return <Setup />
  }

  // Authenticated and setup complete - show dashboard
  if (requestedRoute === '/dashboard' || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-12">
          <div className="container mx-auto max-w-4xl px-4">
            <Dashboard />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return <Landing />
}

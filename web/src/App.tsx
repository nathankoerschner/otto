import { useState } from 'react'
import { Landing, Setup } from '@/pages'

type Route = '/' | '/setup'

function getInitialRoute(): Route {
  const path = window.location.pathname
  if (path === '/setup') {
    return '/setup'
  }
  return '/'
}

export default function App() {
  const [route] = useState<Route>(getInitialRoute)

  // Simple client-side routing
  if (route === '/setup') {
    return <Setup />
  }

  return <Landing />
}

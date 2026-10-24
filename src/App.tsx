import { useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import { EmptySection } from './components/EmptySection'
import { getRoute, getSection, type WorkspaceRoute } from './features/workspace'

function App() {
  const [route, setRoute] = useState<WorkspaceRoute>(getRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const section = getSection(route)

  useEffect(() => {
    document.title = `${section.label} · ${route.mode === 'user' ? 'User' : 'Organizer'} · Gather`
  }, [section.label, route.mode])

  return (
    <AppShell route={route}>
      <EmptySection key={`${route.mode}-${route.section}`} section={section} />
    </AppShell>
  )
}

export default App

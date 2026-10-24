import type { ReactNode } from 'react'
import { navigation, routeHref, type WorkspaceRoute } from '../features/workspace'

export function AppShell({ route, children }: { route: WorkspaceRoute; children: ReactNode }) {
  const pageNumber = navigation.findIndex((item) => item.id === route.section) + 1

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('workspace-content')?.focus()
      }}>Skip to content</a>
      <aside className="sidebar" aria-label="Gather navigation">
        <a className="wordmark" href={routeHref({ mode: route.mode, section: 'happening-events' })} aria-label="Gather home">gather</a>
        <nav className="section-navigation" aria-label="Sections">
          {navigation.map(({ id, label, icon: Icon }) => (
            <a className={`navigation-link ${route.section === id ? 'is-active' : ''}`} key={id}
              href={routeHref({ mode: route.mode, section: id })} aria-current={route.section === id ? 'page' : undefined}>
              <Icon aria-hidden="true" size={24} strokeWidth={1.7} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <p className="sidebar-note">Made for getting together.</p>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <nav className="mode-switch" aria-label="Switch between user and organizer">
            {(['user', 'organizer'] as const).map((mode) => (
              <a key={mode} className={`mode-link ${route.mode === mode ? 'is-selected' : ''}`}
                href={routeHref({ ...route, mode })} aria-current={route.mode === mode ? 'true' : undefined}>
                {mode === 'user' ? 'User' : 'Organizer'}
              </a>
            ))}
          </nav>
        </header>
        <main id="workspace-content" className="workspace-content" tabIndex={-1}>{children}</main>
        <footer className="workspace-footer" aria-label={`Section ${pageNumber} of ${navigation.length}`}>
          <span aria-hidden="true">0{pageNumber}<span className="page-divider">/</span>0{navigation.length}</span>
        </footer>
      </div>
    </div>
  )
}

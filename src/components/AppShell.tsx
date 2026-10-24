import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRightLeft, LogOut, MapPin, Moon, Settings, Sun } from 'lucide-react'
import { navigation, routeHref, type WorkspaceRoute } from '../features/workspace'

export function AppShell({ route, children, userName, userEmail, userAvatar, userRole, onSignOut }: { route: WorkspaceRoute; children: ReactNode; userName: string | null; userEmail: string | null; userAvatar: string | null; userRole: 'attendee' | 'organizer'; onSignOut: () => void }) {
  const pageNumber = navigation.findIndex((item) => item.id === route.section) + 1
  const nextMode = route.mode === 'user' ? 'organizer' : 'user'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('gather-theme') === 'dark' ? 'dark' : 'light')
  useEffect(() => { localStorage.setItem('gather-theme', theme) }, [theme])

  return (
    <div className={`app-shell theme-${theme}`}>
      <a className="skip-link" href="#workspace-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('workspace-content')?.focus()
      }}>Skip to content</a>
      <header className="club-header">
        <a className="wordmark" href={routeHref({ mode: route.mode, section: 'happening-events' })} aria-label="Gather Club home">
          gather<span>club</span>
        </a>
        <nav className="section-navigation" aria-label="Sections">
          {navigation.map(({ id, label }) => (
            <a className={`navigation-link ${route.section === id ? 'is-active' : ''}`} key={id}
              href={routeHref({ mode: route.mode, section: id })} aria-current={route.section === id ? 'page' : undefined}>
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <span className="city-label"><MapPin size={15} aria-hidden="true" /> Mumbai</span>
          {route.mode === 'organizer' ? <a className="host-action" href="#/organizer/create">Create gathering <span aria-hidden="true">↗</span></a> : null}
          <details className="settings-menu">
            <summary aria-label="Settings" title="Settings"><Settings size={19} strokeWidth={1.7} /></summary>
            <div className="settings-popover">
              <p>Gather Club settings</p>
              <div className="settings-profile">{userAvatar ? <img src={userAvatar} alt="" /> : <span>{(userName ?? 'G').slice(0, 1).toUpperCase()}</span>}<div><strong>{userName ?? 'Gather member'}</strong><small>{userRole === 'organizer' ? 'Organizer' : 'Attendee'}</small><small>{userEmail}</small></div></div>
              <a href={routeHref({ ...route, mode: nextMode })}>
                <ArrowRightLeft size={16} aria-hidden="true" />
                Switch to {nextMode === 'organizer' ? 'organizer' : 'attendee'}
              </a>
              <small>Change how you use the club.</small>
              <button type="button" className="theme-toggle" aria-pressed={theme === 'dark'} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>
                {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                Use {theme === 'dark' ? 'light' : 'dark'} theme
              </button>
              <button type="button" onClick={onSignOut}><LogOut size={15} aria-hidden="true" />Sign out</button>
            </div>
          </details>
        </div>
      </header>
      <main id="workspace-content" className="workspace-content" tabIndex={-1}>{children}</main>
      <footer className="workspace-footer" aria-label={`Section ${pageNumber} of ${navigation.length}`}>
        <span>Gather Club <i aria-hidden="true">·</i> Made for getting together</span>
        <span aria-hidden="true">0{pageNumber}<span className="page-divider">/</span>0{navigation.length}</span>
      </footer>
    </div>
  )
}

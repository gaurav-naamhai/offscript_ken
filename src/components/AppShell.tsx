import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, Moon, Sun } from 'lucide-react'
import { navigation, routeHref, type WorkspaceRoute } from '../features/workspace'
import { useEvents } from '../features/events'

export function AppShell({ route, children }: { route: WorkspaceRoute; children: ReactNode }) {
  const isOrganizer = route.mode === 'organizer'
  const { signOut } = useEvents()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('gather-theme') === 'light' ? 'light' : 'dark')
  const handleSignOut = () => { void signOut() }
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('gather-theme', theme) }, [theme])
  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark')
  const themeControl = <button type="button" className="theme-control" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>

  return (
    <div className={`app-shell ${isOrganizer ? 'organizer-shell' : 'attendee-shell'}`}>
      <a
        className="skip-link"
        href="#workspace-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('workspace-content')?.focus()
        }}
      >
        Skip to content
      </a>

      {isOrganizer ? (
        /* Dedicated Organizer Sidebar Navigation */
        <aside className="sidebar organizer-sidebar" aria-label="Organizer navigation">
          <div className="organizer-sidebar-header">
            <a
              className="wordmark"
              href={routeHref({ mode: 'organizer', section: 'my-events' })}
              aria-label="Gather Club home"
            >
              Gather Club
            </a>
            <span className="organizer-badge">Organizer</span>
          </div>

          <nav className="organizer-nav" aria-label="Organizer sections">
            {navigation.map(({ id, label, icon: Icon }) => (
              <a
                className={`organizer-nav-link ${route.section === id && !route.create && !route.editId && !route.eventId ? 'is-active' : ''}`}
                key={id}
                href={routeHref({ mode: 'organizer', section: id })}
                aria-current={route.section === id ? 'page' : undefined}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </a>
            ))}
          </nav>

          <div className="organizer-sidebar-footer">
            <nav className="mode-switch in-sidebar" aria-label="Switch between attendee and organizer">
              {(['user', 'organizer'] as const).map((mode) => (
                <a
                  key={mode}
                  className={`mode-link ${route.mode === mode ? 'is-selected' : ''}`}
                  href={routeHref({ ...route, mode })}
                  aria-current={route.mode === mode ? 'true' : undefined}
                >
                  {mode === 'user' ? 'Attendee' : 'Organizer'}
                </a>
              ))}
            </nav>
            <p className="sidebar-note">Made for getting together.</p>
            {themeControl}
            <button type="button" className="session-control" onClick={handleSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
          </div>
        </aside>
      ) : (
        /* Compact Attendee Top Navigation Bar */
        <header className="attendee-top-nav" aria-label="Gather Club navigation">
          <div className="attendee-nav-inner">
            <div className="attendee-nav-left">
              <a
                className="wordmark"
                href={routeHref({ mode: 'user', section: 'happening-events' })}
                aria-label="Gather Club home"
              >
                Gather Club
              </a>
              <span className="brand-tagline">City Guide</span>
            </div>

            <nav className="attendee-nav-links" aria-label="Attendee sections">
              {navigation.map(({ id, label, icon: Icon }) => (
                <a
                  className={`attendee-nav-link ${route.section === id && !route.eventId ? 'is-active' : ''}`}
                  key={id}
                  href={routeHref({ mode: 'user', section: id })}
                  aria-current={route.section === id && !route.eventId ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                </a>
              ))}
            </nav>

            <div className="attendee-nav-right">
              <nav className="mode-switch" aria-label="Switch between attendee and organizer">
                {(['user', 'organizer'] as const).map((mode) => (
                  <a
                    key={mode}
                    className={`mode-link ${route.mode === mode ? 'is-selected' : ''}`}
                    href={routeHref({ ...route, mode })}
                    aria-current={route.mode === mode ? 'true' : undefined}
                  >
                    {mode === 'user' ? 'Attendee' : 'Organizer'}
                  </a>
                ))}
              </nav>
              {themeControl}
              <button type="button" className="session-control" onClick={handleSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
            </div>
          </div>
        </header>
      )}

      <div className={`workspace ${isOrganizer ? 'organizer-workspace' : 'attendee-workspace'}`}>
        <main id="workspace-content" className={isOrganizer ? 'workspace-content' : 'attendee-workspace-content'} tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-footer">
          <div className="footer-content">
            <span className="footer-brand">Gather Club</span>
            <span className="footer-dot">&middot;</span>
            <span>A curated city guide &amp; event workspace</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

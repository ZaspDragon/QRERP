import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getNavigationLabel, mobilePrimaryPaths, navigationItems } from '../../app/navigation';

interface AppShellProps {
  children: ReactNode;
  currentUserName: string;
  siteName: string;
  activeScanLabel?: string;
}

export default function AppShell({ children, currentUserName, siteName, activeScanLabel }: AppShellProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLabel = getNavigationLabel(location.pathname);
  const primaryItems = navigationItems.filter((item) => mobilePrimaryPaths.includes(item.path));

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">QL</div>
          <div>
            <strong>QR Legends ERP</strong>
            <p>{siteName}</p>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" type="button" onClick={() => setMenuOpen(true)}>
              Menu
            </button>
            <div>
              <p className="eyebrow">Warehouse Operations</p>
              <h2>{currentLabel}</h2>
            </div>
          </div>
          <div className="topbar-meta">
            <div>
              <span className="meta-label">User</span>
              <strong>{currentUserName}</strong>
            </div>
            <div>
              <span className="meta-label">Active Scan</span>
              <strong>{activeScanLabel ?? 'Waiting for scan'}</strong>
            </div>
          </div>
        </header>

        {menuOpen ? (
          <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}>
            <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
              <div className="mobile-menu-header">
                <strong>QR Legends ERP</strong>
                <button type="button" className="ghost-button" onClick={() => setMenuOpen(false)}>
                  Close
                </button>
              </div>
              <nav className="mobile-menu-nav" aria-label="Mobile navigation">
                {navigationItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  >
                    <span>{item.label}</span>
                    <small>{item.description}</small>
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        <main className="content-area">{children}</main>

        <nav className="bottom-nav" aria-label="Bottom navigation">
          {primaryItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'bottom-link active' : 'bottom-link')}
            >
              {item.shortLabel}
            </NavLink>
          ))}
          <button type="button" className="bottom-link" onClick={() => setMenuOpen(true)}>
            More
          </button>
        </nav>
      </div>
    </div>
  );
}

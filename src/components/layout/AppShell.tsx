import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ActivityIcon,
  AlertTriangleIcon,
  BellIcon,
  BotIcon,
  FileTextIcon,
  GitCompareIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  NetworkIcon,
  RadarIcon,
  RouteIcon,
  ScanLineIcon,
  ServerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  UsersIcon,
  XIcon } from
'lucide-react';
import { useNexus } from '../../store/NexusContext';
import { Badge, Button, cn } from '../ui/primitives';
import { ScanModal } from '../ScanModal';

const NAV: {section: string;items: {to: string;label: string;icon: React.ReactNode;}[];}[] = [
{
  section: 'Overview',
  items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboardIcon className="h-4 w-4" /> }]
},
{
  section: 'Infrastructure',
  items: [
  { to: '/devices', label: 'Devices', icon: <ServerIcon className="h-4 w-4" /> },
  { to: '/configurations', label: 'Configurations', icon: <FileTextIcon className="h-4 w-4" /> },
  { to: '/topology', label: 'Topology', icon: <NetworkIcon className="h-4 w-4" /> }]

},
{
  section: 'Security',
  items: [
  { to: '/compliance', label: 'Compliance', icon: <ShieldCheckIcon className="h-4 w-4" /> },
  { to: '/network-intent', label: 'Network Intent', icon: <TargetIcon className="h-4 w-4" /> },
  { to: '/reachability', label: 'Reachability', icon: <RouteIcon className="h-4 w-4" /> },
  { to: '/findings', label: 'Findings', icon: <AlertTriangleIcon className="h-4 w-4" /> },
  { to: '/drift', label: 'Drift', icon: <GitCompareIcon className="h-4 w-4" /> }]

},
{
  section: 'Third-Party',
  items: [
  { to: '/vendors', label: 'Vendors', icon: <UsersIcon className="h-4 w-4" /> },
  { to: '/dependencies', label: 'Dependencies', icon: <RadarIcon className="h-4 w-4" /> }]

},
{
  section: 'Intelligence',
  items: [
  { to: '/risk-analysis', label: 'Risk Analysis', icon: <ActivityIcon className="h-4 w-4" /> },
  { to: '/ai-assistant', label: 'AI Assistant', icon: <BotIcon className="h-4 w-4" /> }]

},
{
  section: 'Reporting',
  items: [{ to: '/reports', label: 'Reports', icon: <SlidersHorizontalIcon className="h-4 w-4" /> }]
},
{
  section: 'System',
  items: [{ to: '/settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> }]
}];


export function AppShell({ children }: {children: React.ReactNode;}) {
  const { user, orgName, logout, findings, analysis, db, orgId, simulateDrift, hasData } = useNexus();
  const [scanOpen, setScanOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const criticals = findings.filter((f) => f.severity === 'CRITICAL' && f.status !== 'Resolved').length;
  const alerts = db.alerts.filter((a) => a.orgId === orgId);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-hairline bg-surface transition-transform duration-200 ease-out lg:static lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
        
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5 text-accent" />
            <span className="text-base font-semibold tracking-[0.18em] text-ink">NEXUS</span>
          </Link>
          <button
            className="rounded p-1 text-faint hover:text-ink lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation">
            
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {NAV.map((group) =>
          <div key={group.section} className="mb-4">
              <p className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) =>
              <li key={item.to}>
                    <NavLink
                  to={item.to}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out',
                    isActive ?
                    'bg-accentSoft text-ink' :
                    'text-muted hover:bg-white/[0.04] hover:text-ink'
                  )
                  }>
                  
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                      {item.to === '/findings' && criticals > 0 &&
                  <Badge tone="CRITICAL">{criticals}</Badge>
                  }
                    </NavLink>
                  </li>
              )}
              </ul>
            </div>
          )}
        </nav>

        <div className="border-t border-hairline px-4 py-3">
          <p className="text-xs font-medium text-ink">{user?.name}</p>
          <p className="text-2xs text-faint">{user?.role}</p>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="mt-2 flex items-center gap-1.5 text-xs text-muted transition-colors duration-150 ease-out hover:text-ink">
            
            <LogOutIcon className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {navOpen &&
      <div
        className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        onClick={() => setNavOpen(false)}
        aria-hidden="true" />

      }

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-hairline bg-canvas/95 px-4 py-3 backdrop-blur">
          <button
            className="rounded p-1.5 text-muted hover:text-ink lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation">
            
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-faint">{orgName}</p>
            <p className="truncate text-sm font-medium text-ink">Security Console</p>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <div className="text-right">
              <p className="text-2xs uppercase tracking-wider text-faint">Score</p>
              <p className="text-sm font-semibold tabular-nums text-ink">{analysis.risk.overall}/100</p>
            </div>
            <div className="text-right">
              <p className="text-2xs uppercase tracking-wider text-faint">Critical</p>
              <p className="text-sm font-semibold tabular-nums text-critical">{criticals}</p>
            </div>
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              icon={<BellIcon className="h-4 w-4" />}
              onClick={() => navigate('/findings')}
              aria-label={`${alerts.length} alerts`}>
              
              <span className="tabular-nums">{alerts.length}</span>
            </Button>
          </div>

          {hasData &&
          <Button
            size="sm"
            variant="danger"
            icon={<AlertTriangleIcon className="h-4 w-4" />}
            onClick={() => simulateDrift()}
            className="hidden sm:inline-flex">
            
              Simulate Drift
            </Button>
          }
          <Button
            size="sm"
            variant="primary"
            icon={<ScanLineIcon className="h-4 w-4" />}
            onClick={() => setScanOpen(true)}>
            
            Scan Network
          </Button>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>);

}
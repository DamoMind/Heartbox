import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, ScanLine, History, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/inventory', icon: Package, labelKey: 'nav.inventory' },
  { path: '/scan', icon: ScanLine, labelKey: 'nav.scan' },
  { path: '/history', icon: History, labelKey: 'nav.history' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export function Navigation() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 pb-safe z-40">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const isActive = location.pathname === path;

          return (
            <NavLink
              key={path}
              to={path}
              className={clsx(
                'flex flex-col items-center py-2 px-3 min-w-[64px] transition-colors',
                isActive
                  ? 'text-primary-600'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <div
                className={clsx(
                  'p-2 rounded-xl transition-all',
                  isActive && 'bg-primary-50'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium mt-0.5">
                {t(labelKey)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

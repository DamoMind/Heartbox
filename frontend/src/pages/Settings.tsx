import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Bell,
  RefreshCw,
  Cloud,
  Info,
  ChevronRight,
  Check,
  LogOut,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getSettings, saveSettings, clearAllData } from '@/services/db';
import { AppSettings } from '@/types';
import { format } from 'date-fns';
import { clsx } from 'clsx';

export function Settings() {
  const { t, i18n } = useTranslation();
  const { isOnline, isSyncing, pendingCount, lastSyncAt, sync } = useOnlineStatus();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await clearAllData();
      // Reload the page to reset all state
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleLanguageChange = async (lang: 'en' | 'es') => {
    await i18n.changeLanguage(lang);
    await saveSettings({ language: lang });
    setSettings(prev => prev ? { ...prev, language: lang } : null);
  };

  const handleNotificationToggle = async () => {
    if (!settings) return;
    const newValue = !settings.lowStockAlertEnabled;
    await saveSettings({ lowStockAlertEnabled: newValue });
    setSettings(prev => prev ? { ...prev, lowStockAlertEnabled: newValue } : null);
  };

  const handleAutoSyncToggle = async () => {
    if (!settings) return;
    const newValue = !settings.autoSync;
    await saveSettings({ autoSync: newValue });
    setSettings(prev => prev ? { ...prev, autoSync: newValue } : null);
  };

  if (!settings) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-slate-800">{t('settings.title')}</h1>
      </div>

      {/* Language */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary-500" />
          </div>
          <div>
            <h3 className="font-medium text-slate-800">{t('settings.language')}</h3>
          </div>
        </div>
        <div className="flex gap-2">
          {(['en', 'es'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={clsx(
                'flex-1 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2',
                settings.language === lang
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {settings.language === lang && <Check className="h-4 w-4" />}
              {lang === 'en' ? 'English' : 'Espanol'}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <button
          onClick={handleNotificationToggle}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-50 rounded-xl flex items-center justify-center">
              <Bell className="h-5 w-5 text-warning-500" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-slate-800">{t('settings.notifications')}</h3>
              <p className="text-sm text-slate-500">{t('dashboard.lowStock')}</p>
            </div>
          </div>
          <div
            className={clsx(
              'w-12 h-7 rounded-full transition-colors p-0.5',
              settings.lowStockAlertEnabled ? 'bg-primary-500' : 'bg-slate-200'
            )}
          >
            <div
              className={clsx(
                'w-6 h-6 bg-white rounded-full shadow transition-transform',
                settings.lowStockAlertEnabled && 'translate-x-5'
              )}
            />
          </div>
        </button>
      </Card>

      {/* Sync Settings */}
      <Card>
        <div className="space-y-4">
          {/* Auto Sync Toggle */}
          <button
            onClick={handleAutoSyncToggle}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-50 rounded-xl flex items-center justify-center">
                <Cloud className="h-5 w-5 text-success-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-slate-800">{t('settings.autoSync')}</h3>
                <p className="text-sm text-slate-500">
                  {isOnline ? (
                    <span className="text-success-500">Online</span>
                  ) : (
                    <span className="text-slate-400">Offline</span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-warning-500"> • {pendingCount} pending</span>
                  )}
                </p>
              </div>
            </div>
            <div
              className={clsx(
                'w-12 h-7 rounded-full transition-colors p-0.5',
                settings.autoSync ? 'bg-primary-500' : 'bg-slate-200'
              )}
            >
              <div
                className={clsx(
                  'w-6 h-6 bg-white rounded-full shadow transition-transform',
                  settings.autoSync && 'translate-x-5'
                )}
              />
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Sync Now Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">{t('settings.lastSync')}</p>
              <p className="text-sm text-slate-500">
                {lastSyncAt ? format(new Date(lastSyncAt), 'MMM d, HH:mm') : t('settings.never')}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={sync}
              disabled={!isOnline || isSyncing}
              loading={isSyncing}
            >
              <RefreshCw className={clsx('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
              {t('settings.syncNow')}
            </Button>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Info className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-800">{t('settings.about')}</h3>
            <p className="text-sm text-slate-500">{t('app.title')}</p>
          </div>
          <Badge variant="default">{t('settings.version')} 1.0.0</Badge>
        </div>
      </Card>

      {/* Clear Data */}
      <Card>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full flex items-center gap-3 text-warning-600"
        >
          <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="text-left flex-1">
            <span className="font-medium">{t('settings.clearData') || 'Clear Local Data'}</span>
            <p className="text-sm text-slate-500">{t('settings.clearDataDesc') || 'Remove all items and sync fresh from server'}</p>
          </div>
          <ChevronRight className="h-5 w-5" />
        </button>
      </Card>

      {/* Logout */}
      <Card className="bg-danger-50 border-danger-100">
        <button className="w-full flex items-center gap-3 text-danger-600">
          <div className="w-10 h-10 bg-danger-100 rounded-xl flex items-center justify-center">
            <LogOut className="h-5 w-5" />
          </div>
          <span className="font-medium">{t('settings.logout')}</span>
          <ChevronRight className="h-5 w-5 ml-auto" />
        </button>
      </Card>

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {t('settings.clearDataConfirm') || 'Clear All Data?'}
                </h3>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              {t('settings.clearDataWarning') || 'This will remove all local data. The app will sync fresh data from the server on next load.'}
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleClearData}
                loading={isClearing}
                className="flex-1"
              >
                {t('settings.clearDataButton') || 'Clear Data'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

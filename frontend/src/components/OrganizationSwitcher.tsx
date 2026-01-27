import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Check, Heart, Apple, Home, Building, GraduationCap, Package, ShoppingBag, Boxes, Store, LucideIcon } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Organization } from '@/types';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

const ICON_MAP: Record<string, LucideIcon> = {
  Heart, Apple, Home, Building, GraduationCap, Package, ShoppingBag, Boxes, Store,
};

export function OrganizationSwitcher() {
  const { t } = useTranslation();
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = (iconName: string): LucideIcon => {
    return ICON_MAP[iconName] || Heart;
  };

  const handleSelect = async (org: Organization) => {
    await setCurrentOrganization(org);
    setIsOpen(false);
  };

  if (!currentOrganization) {
    return null;
  }

  const CurrentIcon = getIcon(currentOrganization.icon);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-sm"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${currentOrganization.color}20` }}
        >
          <CurrentIcon
            className="h-4 w-4"
            color={currentOrganization.color}
          />
        </div>
        <span className="font-medium text-slate-700 max-w-[120px] truncate">
          {currentOrganization.name}
        </span>
        <ChevronDown className={clsx(
          "h-4 w-4 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                {t('organizations.switchTo')}
              </p>
              
              {organizations.map((org) => {
                const OrgIcon = getIcon(org.icon);
                const isSelected = org.id === currentOrganization.id;
                
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org)}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition",
                      isSelected
                        ? "bg-primary-50 text-primary-700"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${org.color}20` }}
                    >
                      <OrgIcon
                        className="h-4 w-4"
                        color={org.color}
                      />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{org.name}</p>
                      {org.description && (
                        <p className="text-xs text-slate-500 truncate">{org.description}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="border-t border-slate-100 p-2">
              <Link
                to="/organizations/new"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-slate-500" />
                </div>
                <span className="font-medium">{t('organizations.createNew')}</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

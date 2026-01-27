import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Trash2, Heart, Apple, Home, Building, GraduationCap, Package, ShoppingBag, Store, Boxes, LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationType, ORGANIZATION_TYPE_INFO } from '@/types';
import { clsx } from 'clsx';

const ICON_MAP: Record<string, LucideIcon> = {
  Heart, Apple, Home, Building, GraduationCap, Package, ShoppingBag, Store, Boxes,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#64748b'
];

export function OrganizationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { organizations, createOrganization, updateOrganization, deleteOrganization, setCurrentOrganization } = useOrganization();
  
  const isEditing = Boolean(id);
  const existingOrg = isEditing ? organizations.find(o => o.id === id) : null;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'charity' as OrganizationType,
    icon: 'Heart',
    color: '#6366f1',
    contactEmail: '',
    contactPhone: '',
    address: '',
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (existingOrg) {
      setFormData({
        name: existingOrg.name,
        description: existingOrg.description || '',
        type: existingOrg.type,
        icon: existingOrg.icon,
        color: existingOrg.color,
        contactEmail: existingOrg.contactEmail || '',
        contactPhone: existingOrg.contactPhone || '',
        address: existingOrg.address || '',
        isDefault: existingOrg.isDefault,
      });
    }
  }, [existingOrg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (isEditing && id) {
        await updateOrganization(id, formData);
        navigate('/settings');
      } else {
        const newOrg = await createOrganization(formData);
        await setCurrentOrganization(newOrg);
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to save organization:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !existingOrg) return;
    
    if (existingOrg.isDefault) {
      alert(t('organizations.cannotDeleteDefault'));
      return;
    }

    if (!confirm(t('organizations.confirmDelete'))) return;

    setDeleting(true);
    try {
      await deleteOrganization(id);
      navigate('/settings');
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert(t('organizations.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const getIcon = (iconName: string): LucideIcon => {
    return ICON_MAP[iconName] || Heart;
  };

  const PreviewIcon = getIcon(formData.icon);

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="pt-2 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">
          {isEditing ? t('organizations.edit') : t('organizations.createNew')}
        </h1>
      </div>

      {/* Preview */}
      <Card>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${formData.color}20` }}
          >
            <PreviewIcon
              className="h-8 w-8"
              color={formData.color}
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {formData.name || t('organizations.newInventory')}
            </h2>
            {formData.description && (
              <p className="text-sm text-slate-500">{formData.description}</p>
            )}
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('organizations.basicInfo')}</CardTitle>
          </CardHeader>
          
          <div className="space-y-4">
            <Input
              label={t('organizations.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('organizations.namePlaceholder')}
              required
            />

            <Input
              label={t('organizations.description')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('organizations.descriptionPlaceholder')}
            />

            <Select
              label={t('organizations.type')}
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as OrganizationType }))}
            >
              {Object.entries(ORGANIZATION_TYPE_INFO).map(([type, info]) => (
                <option key={type} value={type}>
                  {t(info.labelKey)}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>{t('organizations.appearance')}</CardTitle>
          </CardHeader>
          
          <div className="space-y-4">
            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('organizations.icon')}
              </label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((iconName) => {
                  const Icon = getIcon(iconName);
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: iconName }))}
                      className={clsx(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition",
                        formData.icon === iconName
                          ? "bg-primary-100 ring-2 ring-primary-500"
                          : "bg-slate-100 hover:bg-slate-200"
                      )}
                    >
                      <Icon className="h-5 w-5 text-slate-700" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('organizations.color')}
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={clsx(
                      "w-10 h-10 rounded-lg transition",
                      formData.color === color && "ring-2 ring-offset-2 ring-slate-400"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Contact Info (optional) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('organizations.contactInfo')}</CardTitle>
          </CardHeader>
          
          <div className="space-y-4">
            <Input
              label={t('organizations.email')}
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="contact@example.org"
            />

            <Input
              label={t('organizations.phone')}
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
            />

            <Input
              label={t('organizations.address')}
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder={t('organizations.addressPlaceholder')}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {isEditing && !existingOrg?.isDefault && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? t('common.deleting') : t('common.delete')}
            </Button>
          )}
          
          <Button
            type="submit"
            disabled={saving || !formData.name.trim()}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('common.saving') : isEditing ? t('common.save') : t('organizations.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}

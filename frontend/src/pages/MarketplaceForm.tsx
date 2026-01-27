import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Heart, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useInventory } from '@/hooks/useInventory';
import { ListingType, ItemCategory, ItemCondition, CATEGORY_INFO, CONDITION_INFO } from '@/types';
import { clsx } from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || '';

export function MarketplaceForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { items } = useInventory();

  const [formData, setFormData] = useState({
    type: 'offer' as ListingType,
    itemCategory: 'food' as ItemCategory,
    itemName: '',
    quantity: 1,
    unit: 'pieces',
    condition: 'good' as ItemCondition,
    description: '',
    expiryDate: '',
    pickupAddress: currentOrganization?.address || '',
    pickupNotes: '',
    expiresAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // When selecting from existing inventory
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (item) {
      setFormData(prev => ({
        ...prev,
        itemCategory: item.category,
        itemName: item.name,
        unit: item.unit,
        condition: item.condition,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName.trim() || !currentOrganization) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/marketplace/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          type: formData.type,
          item_category: formData.itemCategory,
          item_name: formData.itemName,
          quantity: formData.quantity,
          unit: formData.unit,
          condition: formData.condition,
          description: formData.description || null,
          expiry_date: formData.expiryDate || null,
          pickup_address: formData.pickupAddress || null,
          pickup_notes: formData.pickupNotes || null,
          expires_at: formData.expiresAt || null,
        }),
      });

      if (response.ok) {
        navigate('/marketplace');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      alert('Failed to create listing');
    } finally {
      setSaving(false);
    }
  };

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
          {t('marketplace.createListing')}
        </h1>
      </div>

      {/* Listing Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t('marketplace.listingType')}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'offer' }))}
            className={clsx(
              'p-4 rounded-xl border-2 transition flex flex-col items-center gap-2',
              formData.type === 'offer'
                ? 'border-success-500 bg-success-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <Heart className={clsx(
              'h-8 w-8',
              formData.type === 'offer' ? 'text-success-600' : 'text-slate-400'
            )} />
            <span className={clsx(
              'font-medium',
              formData.type === 'offer' ? 'text-success-700' : 'text-slate-600'
            )}>
              {t('marketplace.offerItems')}
            </span>
            <span className="text-xs text-slate-500">{t('marketplace.offerDesc')}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'need' }))}
            className={clsx(
              'p-4 rounded-xl border-2 transition flex flex-col items-center gap-2',
              formData.type === 'need'
                ? 'border-warning-500 bg-warning-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <Package className={clsx(
              'h-8 w-8',
              formData.type === 'need' ? 'text-warning-600' : 'text-slate-400'
            )} />
            <span className={clsx(
              'font-medium',
              formData.type === 'need' ? 'text-warning-700' : 'text-slate-600'
            )}>
              {t('marketplace.requestItems')}
            </span>
            <span className="text-xs text-slate-500">{t('marketplace.requestDesc')}</span>
          </button>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select from Inventory (for offers) */}
        {formData.type === 'offer' && items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('marketplace.selectFromInventory')}</CardTitle>
            </CardHeader>
            <Select
              value={selectedItemId}
              onChange={(e) => handleItemSelect(e.target.value)}
            >
              <option value="">{t('marketplace.selectOrEnterManually')}</option>
              {items.filter(i => i.quantity > 0).map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantity} {item.unit} available)
                </option>
              ))}
            </Select>
          </Card>
        )}

        {/* Item Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('marketplace.itemDetails')}</CardTitle>
          </CardHeader>
          
          <div className="space-y-4">
            <Input
              label={t('item.name')}
              value={formData.itemName}
              onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
              placeholder={t('marketplace.itemNamePlaceholder')}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label={t('item.category')}
                value={formData.itemCategory}
                onChange={(e) => setFormData(prev => ({ ...prev, itemCategory: e.target.value as ItemCategory }))}
              >
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <option key={key} value={key}>{t(info.labelKey)}</option>
                ))}
              </Select>

              <Select
                label={t('item.condition')}
                value={formData.condition}
                onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value as ItemCondition }))}
              >
                {Object.entries(CONDITION_INFO).map(([key, info]) => (
                  <option key={key} value={key}>{t(info.labelKey)}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('item.quantity')}
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                required
              />

              <Select
                label={t('item.unit')}
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
              >
                <option value="pieces">{t('units.pieces')}</option>
                <option value="packs">{t('units.packs')}</option>
                <option value="boxes">{t('units.boxes')}</option>
                <option value="bags">{t('units.bags')}</option>
                <option value="bottles">{t('units.bottles')}</option>
                <option value="sets">{t('units.sets')}</option>
              </Select>
            </div>

            <Input
              label={t('marketplace.description')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('marketplace.descriptionPlaceholder')}
            />

            {formData.itemCategory === 'food' && (
              <Input
                label={t('item.expiryDate')}
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
              />
            )}
          </div>
        </Card>

        {/* Pickup Info (for offers) */}
        {formData.type === 'offer' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('marketplace.pickupInfo')}</CardTitle>
            </CardHeader>
            
            <div className="space-y-4">
              <Input
                label={t('marketplace.pickupAddress')}
                value={formData.pickupAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, pickupAddress: e.target.value }))}
                placeholder={t('marketplace.pickupAddressPlaceholder')}
              />

              <Input
                label={t('marketplace.pickupNotes')}
                value={formData.pickupNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, pickupNotes: e.target.value }))}
                placeholder={t('marketplace.pickupNotesPlaceholder')}
              />
            </div>
          </Card>
        )}

        {/* Listing Expiry */}
        <Card>
          <CardHeader>
            <CardTitle>{t('marketplace.listingExpiry')}</CardTitle>
          </CardHeader>
          <Input
            label={t('marketplace.expiresAt')}
            type="date"
            value={formData.expiresAt}
            onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-slate-500 mt-1">{t('marketplace.expiryNote')}</p>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          disabled={saving || !formData.itemName.trim()}
          fullWidth
          className="h-12"
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? t('common.saving') : t('marketplace.postListing')}
        </Button>
      </form>
    </div>
  );
}

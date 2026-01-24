import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, Save, Trash2, Search, Loader2 } from 'lucide-react';
import { Card, Button, Input, Select, Badge } from '@/components/ui';
import { useInventory } from '@/hooks/useInventory';
import { ItemCategory, ItemCondition, CATEGORY_INFO, CONDITION_INFO } from '@/types';
import { lookupBarcode } from '@/services/sync';
import { v4 as uuidv4 } from 'uuid';

export function ItemForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';

  const { items, addItem, updateItem, deleteItem } = useInventory();
  const existingItem = !isNew ? items.find(i => i.id === id) : null;

  // Form state
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<ItemCategory>('other');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('pieces');
  const [condition, setCondition] = useState<ItemCondition>('new');
  const [minStock, setMinStock] = useState(10);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [aiSource, setAiSource] = useState<string | null>(null);

  // AI lookup function
  const doAiLookup = useCallback(async (barcodeValue: string) => {
    if (!barcodeValue || barcodeValue.length < 8) return;

    setLookingUp(true);
    try {
      const result = await lookupBarcode(barcodeValue);
      if (result && result.source !== 'unknown') {
        if (result.name && !name) setName(result.name);
        if (result.category && CATEGORY_INFO[result.category as ItemCategory]) {
          setCategory(result.category as ItemCategory);
        }
        if (result.unit) setUnit(result.unit);
        setAiSource(result.source);
      }
    } catch (e) {
      console.error('AI lookup failed:', e);
    } finally {
      setLookingUp(false);
    }
  }, [name]);

  // Load existing item or URL params
  useEffect(() => {
    if (existingItem) {
      setName(existingItem.name);
      setBarcode(existingItem.barcode);
      setCategory(existingItem.category);
      setQuantity(existingItem.quantity);
      setUnit(existingItem.unit);
      setCondition(existingItem.condition);
      setMinStock(existingItem.minStock);
      setLocation(existingItem.location || '');
      setNotes(existingItem.notes || '');
    } else if (isNew) {
      // Read AI suggestions from URL params
      const urlBarcode = searchParams.get('barcode');
      const urlName = searchParams.get('name');
      const urlCategory = searchParams.get('category') as ItemCategory | null;
      const urlUnit = searchParams.get('unit');
      const urlSource = searchParams.get('source');

      if (urlBarcode) setBarcode(urlBarcode);
      if (urlName) setName(urlName);
      if (urlCategory && CATEGORY_INFO[urlCategory]) setCategory(urlCategory);
      if (urlUnit) setUnit(urlUnit);
      if (urlSource) setAiSource(urlSource);
    }
  }, [existingItem, isNew, searchParams]);

  const categoryOptions = Object.entries(CATEGORY_INFO).map(([value, info]) => ({
    value,
    label: t(info.labelKey),
  }));

  const conditionOptions = Object.entries(CONDITION_INFO).map(([value, info]) => ({
    value,
    label: t(info.labelKey),
  }));

  const unitOptions = [
    { value: 'pieces', label: t('units.pieces') },
    { value: 'packs', label: t('units.packs') },
    { value: 'boxes', label: t('units.boxes') },
    { value: 'bags', label: t('units.bags') },
    { value: 'bottles', label: t('units.bottles') },
    { value: 'sets', label: t('units.sets') },
  ];

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'openfoodfacts': return 'Open Food Facts';
      case 'upcitemdb': return 'UPC Database';
      case 'ai': return 'AI';
      default: return source;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !barcode.trim()) return;

    setLoading(true);
    try {
      const itemData = {
        id: existingItem?.id || uuidv4(),
        barcode,
        name,
        category,
        quantity,
        unit,
        condition,
        minStock,
        location: location || 'Unassigned',
        notes: notes || undefined,
        expiryDate: undefined,
        imageUrl: undefined,
        createdAt: existingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const,
      };

      if (existingItem) {
        await updateItem(itemData);
      } else {
        await addItem(itemData);
      }

      navigate('/inventory');
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingItem) return;
    if (!confirm(t('inventory.confirmDelete'))) return;

    setLoading(true);
    try {
      await deleteItem(existingItem.id);
      navigate('/inventory');
    } catch (error) {
      console.error('Failed to delete item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100 transition"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">
          {isNew ? t('inventory.addItem') : t('inventory.editItem')}
        </h1>
      </div>

      {/* AI Suggestion Banner */}
      {aiSource && isNew && (
        <Card className="border-2 border-primary-200 bg-primary-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <span className="text-sm text-primary-800">
              {t('scan.autoFilled') || 'Auto-filled from'} <Badge variant="info">{getSourceLabel(aiSource)}</Badge>
            </span>
          </div>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('item.barcode')}
              </label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="1234567890123"
                  required
                  disabled={!!existingItem}
                  className="flex-1"
                />
                {isNew && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => doAiLookup(barcode)}
                    disabled={lookingUp || barcode.length < 8}
                    className="px-3"
                  >
                    {lookingUp ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>
              {isNew && (
                <p className="text-xs text-slate-400 mt-1">
                  {t('scan.tapToLookup') || 'Enter barcode and tap search to auto-fill'}
                </p>
              )}
            </div>

            <Input
              label={t('item.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('item.name')}
              required
            />

            <Select
              label={t('item.category')}
              options={categoryOptions}
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('item.quantity')}
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              />

              <Select
                label={t('item.unit')}
                options={unitOptions}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label={t('item.condition')}
                options={conditionOptions}
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
              />

              <Input
                label={t('item.minStock')}
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(parseInt(e.target.value) || 0)}
              />
            </div>

            <Input
              label={t('item.location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Shelf A-1"
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('item.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('item.notes')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {existingItem && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('common.delete')}
            </Button>
          )}

          <Button
            type="submit"
            className="flex-1"
            loading={loading}
            disabled={!name.trim() || !barcode.trim()}
          >
            <Save className="h-4 w-4 mr-1" />
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

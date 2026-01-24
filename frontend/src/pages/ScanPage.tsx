import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Package,
  Plus,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Scanner, ScanResult } from '@/components/Scanner';
import { Card, Button, Input, Select, Badge } from '@/components/ui';
import { useInventory, useTransactions } from '@/hooks/useInventory';
import { DonationItem, TransactionType, CATEGORY_INFO } from '@/types';
import { lookupBarcode, BarcodeLookupResult, AIRecognitionResult } from '@/services/sync';
import { clsx } from 'clsx';

type ScanStep = 'scan' | 'found' | 'notFound' | 'lookingUp' | 'aiRecognized' | 'transaction' | 'success';

export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultMode = (searchParams.get('mode') as TransactionType) || 'in';

  const { findByBarcode, refresh: refreshInventory } = useInventory();
  const { addTransaction } = useTransactions();

  const [step, setStep] = useState<ScanStep>('scan');
  const [mode, setMode] = useState<TransactionType>(defaultMode);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [foundItem, setFoundItem] = useState<DonationItem | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<BarcodeLookupResult | null>(null);
  const [aiRecognition, setAiRecognition] = useState<AIRecognitionResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [recipientInfo, setRecipientInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const reasonOptions = mode === 'in'
    ? [
        { value: 'donation', label: t('reasons.donation') },
        { value: 'purchase', label: t('reasons.purchase') },
        { value: 'transfer', label: t('reasons.transfer') },
      ]
    : [
        { value: 'distribution', label: t('reasons.distribution') },
        { value: 'event', label: t('reasons.event') },
        { value: 'damaged', label: t('reasons.damaged') },
        { value: 'adjustment', label: t('reasons.adjustment') },
      ];

  const handleScan = useCallback(async (result: string | ScanResult) => {
    // Handle both string (barcode) and ScanResult (AI recognition)
    let barcode: string;

    if (typeof result === 'string') {
      // Traditional barcode scan
      barcode = result;
      setAiRecognition(null);
      setCapturedImage(null);
    } else {
      // AI recognition result
      barcode = result.barcode;
      if (result.aiResult) {
        setAiRecognition(result.aiResult);
      }
      if (result.capturedImage) {
        setCapturedImage(result.capturedImage);
      }
    }

    setScannedBarcode(barcode);
    setAiSuggestion(null);

    // Check if item already exists
    const item = await findByBarcode(barcode);

    if (item) {
      setFoundItem(item);
      setStep('found');
    } else if (typeof result !== 'string' && result.aiResult) {
      // AI recognized a new item
      setStep('aiRecognized');
    } else {
      // Item not found - try database lookup
      setStep('lookingUp');
      try {
        const suggestion = await lookupBarcode(barcode);
        setAiSuggestion(suggestion);
      } catch (e) {
        console.error('Database lookup failed:', e);
      }
      setStep('notFound');
    }
  }, [findByBarcode]);

  const handleProceedToTransaction = () => {
    setReason(reasonOptions[0].value);
    setStep('transaction');
  };

  const handleCreateNew = () => {
    // Pass AI suggestion or AI recognition as URL params
    const params = new URLSearchParams({ barcode: scannedBarcode });

    // Prioritize AI recognition over database suggestion
    if (aiRecognition) {
      if (aiRecognition.name) params.set('name', aiRecognition.name);
      if (aiRecognition.category) params.set('category', aiRecognition.category);
      if (aiRecognition.unit) params.set('unit', aiRecognition.unit);
      if (capturedImage) params.set('imageUrl', capturedImage);
      params.set('source', 'ai-vision');
    } else if (aiSuggestion) {
      if (aiSuggestion.name) params.set('name', aiSuggestion.name);
      if (aiSuggestion.category) params.set('category', aiSuggestion.category);
      if (aiSuggestion.unit) params.set('unit', aiSuggestion.unit);
      if (aiSuggestion.imageUrl) params.set('imageUrl', aiSuggestion.imageUrl);
      params.set('source', aiSuggestion.source);
    }
    navigate(`/inventory/new?${params.toString()}`);
  };

  const handleConfirmTransaction = async () => {
    if (!foundItem) return;

    setLoading(true);

    // Optimistic update: immediately update local state
    const newQuantity = mode === 'in'
      ? foundItem.quantity + quantity
      : Math.max(0, foundItem.quantity - quantity);

    setFoundItem({
      ...foundItem,
      quantity: newQuantity,
    });

    // Show success immediately for better UX
    setStep('success');

    try {
      await addTransaction(
        foundItem.id,
        mode,
        quantity,
        reason,
        'current-user', // TODO: Get from auth context
        mode === 'out' ? recipientInfo : undefined
      );

      // Refresh inventory in background (non-blocking)
      refreshInventory();

      // Auto-reset after success
      setTimeout(() => {
        setStep('scan');
        setFoundItem(null);
        setQuantity(1);
        setReason('');
        setRecipientInfo('');
      }, 2000);
    } catch (error) {
      console.error('Transaction failed:', error);
      // Revert optimistic update on error
      setFoundItem(foundItem);
      setStep('transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('scan');
    setFoundItem(null);
    setAiSuggestion(null);
    setAiRecognition(null);
    setCapturedImage(null);
    setScannedBarcode('');
    setQuantity(1);
    setReason('');
    setRecipientInfo('');
  };

  // Source label helper
  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'openfoodfacts': return 'Open Food Facts';
      case 'upcitemdb': return 'UPC Database';
      case 'ai': return 'AI';
      default: return '';
    }
  };

  // Scanner screen
  if (step === 'scan') {
    return <Scanner onScan={handleScan} onClose={() => navigate(-1)} />;
  }

  // Looking up barcode screen
  if (step === 'lookingUp') {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="text-center text-white animate-slide-up">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('scan.lookingUp') || 'Looking up product...'}</h2>
          <p className="text-slate-400">{t('scan.aiSearching') || 'Searching product databases'}</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-success-500 flex items-center justify-center z-50">
        <div className="text-center text-white animate-slide-up">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold">{t('scan.success')}</h2>
          <p className="mt-2 text-success-100">
            {mode === 'in' ? '+' : '-'}{quantity} {foundItem?.unit}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      {/* Mode Toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setMode('in')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition',
            mode === 'in'
              ? 'bg-white text-success-600 shadow-sm'
              : 'text-slate-500'
          )}
        >
          <ArrowDownToLine className="h-5 w-5" />
          {t('scan.inbound')}
        </button>
        <button
          onClick={() => setMode('out')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition',
            mode === 'out'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-slate-500'
          )}
        >
          <ArrowUpFromLine className="h-5 w-5" />
          {t('scan.outbound')}
        </button>
      </div>

      {/* Item Found */}
      {step === 'found' && foundItem && (
        <div className="space-y-4 animate-slide-up">
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${CATEGORY_INFO[foundItem.category].color}15` }}
              >
                <Package
                  className="h-8 w-8"
                  style={{ color: CATEGORY_INFO[foundItem.category].color }}
                />
              </div>
              <div>
                <Badge variant="success" className="mb-1">{t('scan.itemFound')}</Badge>
                <h2 className="text-xl font-bold text-slate-800">{foundItem.name}</h2>
                <p className="text-slate-500">
                  {t('inventory.inStock')}: {foundItem.quantity} {foundItem.unit}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleProceedToTransaction} className="flex-1">
              {mode === 'in' ? t('scan.inbound') : t('scan.outbound')}
            </Button>
          </div>
        </div>
      )}

      {/* AI Recognized New Item */}
      {step === 'aiRecognized' && aiRecognition && (
        <div className="space-y-4 animate-slide-up">
          <Card className="border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
            {/* Captured Image */}
            {capturedImage && (
              <div className="flex justify-center mb-4">
                <img
                  src={capturedImage}
                  alt="Captured item"
                  className="w-32 h-32 object-cover rounded-xl border-4 border-primary-200 shadow-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-6 w-6 text-primary-500" />
              <Badge variant="success" className="text-sm">
                {t('scan.aiRecognized') || 'AI Recognized'}
              </Badge>
            </div>

            {aiRecognition.name && (
              <h2 className="text-xl font-bold text-slate-800 text-center mb-2">
                {aiRecognition.name}
              </h2>
            )}

            <div className="bg-white rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('item.category')}:</span>
                <span className="font-medium text-slate-700">
                  {t(`categories.${aiRecognition.category}`) || aiRecognition.category}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('item.barcode')}:</span>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                  {aiRecognition.barcode || aiRecognition.generatedBarcode}
                  {!aiRecognition.barcode && (
                    <span className="ml-1 text-primary-500">({t('scan.generated') || 'Generated'})</span>
                  )}
                </code>
              </div>
              {aiRecognition.confidence > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('scan.confidence') || 'Confidence'}:</span>
                  <span className="font-medium text-slate-700">
                    {Math.round(aiRecognition.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateNew} className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              {t('scan.createNew')}
            </Button>
          </div>
        </div>
      )}

      {/* Item Not Found */}
      {step === 'notFound' && (
        <div className="space-y-4 animate-slide-up">
          <Card className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-warning-500 mx-auto mb-4" />
            <Badge variant="warning" className="mb-2">{t('scan.itemNotFound')}</Badge>
            <p className="text-slate-600 mb-2">
              {t('scan.barcode')}: <code className="bg-slate-100 px-2 py-1 rounded">{scannedBarcode}</code>
            </p>
          </Card>

          {/* AI Suggestion Card */}
          {aiSuggestion && (
            <Card className="border-2 border-primary-200 bg-primary-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-primary-900">
                      {t('scan.aiSuggestion') || 'AI Suggestion'}
                    </h3>
                    <Badge variant="info" className="text-xs">
                      {getSourceLabel(aiSuggestion.source)}
                    </Badge>
                  </div>
                  {aiSuggestion.name && (
                    <p className="text-slate-700 font-medium">{aiSuggestion.name}</p>
                  )}
                  <p className="text-sm text-slate-500">
                    {t('scan.suggestedCategory') || 'Category'}: {' '}
                    <span className="font-medium text-slate-700">
                      {t(`categories.${aiSuggestion.category}`) || aiSuggestion.category}
                    </span>
                  </p>
                  {aiSuggestion.imageUrl && (
                    <img
                      src={aiSuggestion.imageUrl}
                      alt={aiSuggestion.name}
                      className="mt-2 w-20 h-20 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateNew} className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              {t('scan.createNew')}
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Form */}
      {step === 'transaction' && foundItem && (
        <div className="space-y-4 animate-slide-up">
          <Card>
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <Package className="h-6 w-6 text-slate-400" />
              <div>
                <h3 className="font-medium text-slate-800">{foundItem.name}</h3>
                <p className="text-sm text-slate-500">
                  {t('inventory.inStock')}: {foundItem.quantity} {foundItem.unit}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label={t('scan.quantity')}
                type="number"
                min={1}
                max={mode === 'out' ? foundItem.quantity : undefined}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />

              <Select
                label={t('scan.reason')}
                options={reasonOptions}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              {mode === 'out' && (
                <Input
                  label={t('scan.recipient')}
                  placeholder="Family ID or description"
                  value={recipientInfo}
                  onChange={(e) => setRecipientInfo(e.target.value)}
                />
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmTransaction}
              loading={loading}
              className="flex-1"
            >
              {t('scan.confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

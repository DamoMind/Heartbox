import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { Camera, X, FlashlightOff, Flashlight, Keyboard, Sparkles, AlertTriangle, Cloud } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { clsx } from 'clsx';
import { AIRecognitionResult, AIQuotaStatus, captureImageFromVideo, recognizeImage, getAIQuotaStatus } from '@/services/sync';

export interface ScanResult {
  barcode: string;
  aiResult?: AIRecognitionResult;
  capturedImage?: string;
}

interface ScannerProps {
  onScan: (result: string | ScanResult) => void;
  onClose?: () => void;
  enableAI?: boolean; // Enable AI recognition mode
}

export function Scanner({ onScan, onClose, enableAI = true }: ScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<AIQuotaStatus | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  // Fetch AI quota status on mount
  useEffect(() => {
    if (enableAI) {
      getAIQuotaStatus().then(status => {
        if (mountedRef.current && status) {
          setQuotaStatus(status);
        }
      });
    }
  }, [enableAI]);

  useEffect(() => {
    mountedRef.current = true;
    let scanner: Html5Qrcode | null = null;

    const startScanning = async () => {
      // Wait for DOM element to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!mountedRef.current) return;

      const element = document.getElementById('scanner-container');
      if (!element) {
        console.error('Scanner container not found');
        setError(t('scan.cameraError'));
        setIsInitializing(false);
        return;
      }

      try {
        scanner = new Html5Qrcode('scanner-container');
        scannerRef.current = scanner;

        // Get available cameras first
        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length === 0) {
          throw new Error('No cameras found');
        }

        if (!mountedRef.current) return;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            if (mountedRef.current) {
              // Stop scanning before calling onScan
              if (scanner && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
                scanner.stop().then(() => {
                  onScan(decodedText);
                }).catch(console.error);
              }
            }
          },
          () => {
            // Ignore QR code not found errors
          }
        );

        if (mountedRef.current) {
          setIsScanning(true);
          setIsInitializing(false);
          setError(null);
        }
      } catch (err) {
        console.error('Scanner error:', err);
        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed')) {
            setError(t('scan.permissionDenied') || 'Camera permission denied. Please allow camera access.');
          } else if (errorMessage.includes('NotFound') || errorMessage.includes('No cameras')) {
            setError(t('scan.noCameraFound') || 'No camera found on this device.');
          } else {
            setError(t('scan.cameraError') || 'Failed to start camera.');
          }
          setIsScanning(false);
          setIsInitializing(false);
        }
      }
    };

    startScanning();

    return () => {
      mountedRef.current = false;
      if (scanner) {
        try {
          if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
            scanner.stop().catch(console.error);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      scannerRef.current = null;
    };
  }, [onScan, t]);

  const handleRetry = () => {
    window.location.reload();
  };

  // Check if iOS (Safari doesn't support torch API)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const toggleTorch = async () => {
    setTorchError(null);

    // iOS Safari doesn't support torch control
    if (isIOS) {
      setTorchError(t('scan.torchNotSupported') || 'iOS Safari does not support flashlight control');
      return;
    }

    try {
      // Get the video element created by html5-qrcode
      const videoElement = document.querySelector('#scanner-container video') as HTMLVideoElement;

      if (!videoElement || !videoElement.srcObject) {
        setTorchError(t('scan.cameraNotReady') || 'Camera not ready');
        return;
      }

      const stream = videoElement.srcObject as MediaStream;
      const tracks = stream.getVideoTracks();
      const track = tracks[0];

      if (!track) {
        setTorchError(t('scan.noVideoTrack') || 'No video track');
        return;
      }

      // Check if torch is supported (Android Chrome)
      const capabilities = track.getCapabilities?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasTorch = capabilities && (capabilities as any).torch;

      if (!hasTorch) {
        setTorchError(t('scan.torchNotSupported') || 'Flashlight not supported on this device');
        return;
      }

      // Toggle torch
      const newTorchState = !torchOn;

      await track.applyConstraints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ torch: newTorchState } as any]
      });

      setTorchOn(newTorchState);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
      setTorchError(t('scan.torchError') || 'Failed to toggle flashlight');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
    }
  };

  // AI Capture and Recognition
  const handleAICapture = async () => {
    if (!enableAI) return;

    // Check if quota is exhausted
    if (quotaStatus?.isExhausted) {
      setError(t('scan.quotaExhaustedDetail') || 'AI quota exhausted for today');
      return;
    }

    try {
      const videoElement = document.querySelector('#scanner-container video') as HTMLVideoElement;
      if (!videoElement) {
        setError(t('scan.cameraNotReady') || 'Camera not ready');
        return;
      }

      // Capture image
      const imageData = captureImageFromVideo(videoElement);
      if (!imageData) {
        setError(t('scan.captureError') || 'Failed to capture image');
        return;
      }

      setCapturedImage(imageData);
      setIsRecognizing(true);

      // Stop barcode scanner temporarily
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
      }

      // Send to AI for recognition
      const result = await recognizeImage(imageData);

      if (result && mountedRef.current) {
        // Refresh quota status after AI call
        getAIQuotaStatus().then(status => {
          if (mountedRef.current && status) {
            setQuotaStatus(status);
          }
        });

        // Check if quota was exhausted during this call
        if (result.quotaExhausted) {
          setIsRecognizing(false);
          setCapturedImage(null);
          setError(t('scan.quotaExhaustedDetail') || 'AI quota exhausted');
          setQuotaStatus(prev => prev ? { ...prev, isExhausted: true, remaining: 0 } : null);
          window.location.reload();
          return;
        }

        // Use detected barcode or generated one
        const finalBarcode = result.barcode || result.generatedBarcode;
        onScan({
          barcode: finalBarcode,
          aiResult: result,
          capturedImage: imageData,
        });
      } else {
        // Failed recognition - let user try again
        setIsRecognizing(false);
        setCapturedImage(null);
        setError(t('scan.recognitionFailed') || 'Could not recognize item. Please try again.');
        // Restart scanner
        window.location.reload();
      }
    } catch (err) {
      console.error('AI capture error:', err);
      setIsRecognizing(false);
      setCapturedImage(null);
      setError(t('scan.recognitionError') || 'Recognition failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        <h2 className="text-white font-semibold text-lg">{t('scan.title')}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* AI Quota Warning Banner */}
      {quotaStatus && (quotaStatus.isWarning || quotaStatus.isExhausted) && (
        <div className={clsx(
          "absolute top-16 left-4 right-4 rounded-lg px-4 py-3 z-20 flex items-center gap-3",
          quotaStatus.isExhausted ? "bg-red-500/90" : "bg-yellow-500/90"
        )}>
          <AlertTriangle className="h-5 w-5 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">
              {quotaStatus.isExhausted
                ? t('scan.quotaExhausted')
                : t('scan.quotaWarning')}
            </p>
            <p className="text-white/80 text-xs truncate">
              {quotaStatus.isExhausted
                ? t('scan.quotaExhaustedDetail')
                : t('scan.quotaWarningDetail', { remaining: quotaStatus.remaining, limit: quotaStatus.limit })}
            </p>
          </div>
          {quotaStatus.provider === 'azure' && !quotaStatus.isExhausted && (
            <div className="flex items-center gap-1 bg-white/20 rounded px-2 py-1">
              <Cloud className="h-3 w-3 text-white" />
              <span className="text-white text-xs">{t('scan.usingAzure')}</span>
            </div>
          )}
        </div>
      )}

      {/* Scanner Container */}
      <div className="h-full flex flex-col items-center justify-center">
        {/* AI Recognition in progress */}
        {isRecognizing && (
          <div className="text-center p-4">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-48 h-48 object-cover rounded-2xl mx-auto mb-4 border-4 border-primary-500"
              />
            )}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary-400 animate-pulse" />
              <p className="text-white font-medium">{t('scan.aiRecognizing') || 'AI Recognizing...'}</p>
            </div>
            <p className="text-white/60 text-sm">{t('scan.pleaseWait') || 'Please wait'}</p>
          </div>
        )}

        {!showManualEntry && !isRecognizing ? (
          <>
            {/* Loading State - Always visible until camera starts */}
            {isInitializing && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
                <div className="relative">
                  <Camera className="h-20 w-20 text-white/30 mx-auto" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                  </div>
                </div>
                <p className="text-white/80 mt-6 text-lg font-medium">{t('scan.initializing') || 'Starting camera...'}</p>
                <p className="text-white/50 mt-2 text-sm">{t('scan.pleaseAllow') || 'Please allow camera access'}</p>
              </div>
            )}

            {/* Scanner Video */}
            <div
              id="scanner-container"
              className={clsx(
                'w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden',
                (isInitializing || error) && 'opacity-0'
              )}
            />

            {error && (
              <div className="text-center p-4">
                <Camera className="h-16 w-16 text-white/50 mx-auto mb-4" />
                <p className="text-white/80 mb-4">{error}</p>
                <Button onClick={handleRetry} variant="secondary">
                  {t('scan.retry')}
                </Button>
              </div>
            )}

            {/* Scanner guide text */}
            {isScanning && (
              <p className="text-white/70 text-sm mt-4 text-center px-4">
                {enableAI
                  ? (t('scan.instructionAI') || 'Scan barcode or tap AI button to recognize item')
                  : t('scan.instruction')
                }
              </p>
            )}
          </>
        ) : !isRecognizing && (
          /* Manual Entry Form */
          <div className="w-full max-w-sm p-6">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Input
                label={t('scan.enterBarcode')}
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="1234567890123"
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button type="submit" fullWidth disabled={!manualBarcode.trim()}>
                {t('common.confirm')}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      {!isRecognizing && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
          {/* Torch error message */}
          {torchError && (
            <p className="text-red-400 text-xs text-center mb-2">{torchError}</p>
          )}

          <div className="flex items-center justify-center gap-4">
            {/* Torch button */}
            {isScanning && !showManualEntry && (
              <button
                onClick={toggleTorch}
                className={clsx(
                  'p-4 rounded-full transition',
                  torchOn
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-white/20 text-white hover:bg-white/30'
                )}
              >
                {torchOn ? (
                  <Flashlight className="h-6 w-6" />
                ) : (
                  <FlashlightOff className="h-6 w-6" />
                )}
              </button>
            )}

            {/* AI Capture Button - Main action */}
            {enableAI && isScanning && !showManualEntry && (
              <button
                onClick={handleAICapture}
                className="p-5 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition shadow-lg shadow-primary-500/30"
              >
                <Sparkles className="h-8 w-8" />
              </button>
            )}

            {/* Manual Entry Button */}
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className={clsx(
                'p-4 rounded-full transition',
                showManualEntry
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              )}
            >
              <Keyboard className="h-6 w-6" />
            </button>
          </div>

          <p className="text-white/60 text-xs text-center mt-4">
            {showManualEntry
              ? t('scan.manualEntry')
              : enableAI
                ? (t('scan.tapForAI') || 'Tap ✨ to identify with AI')
                : t('scan.tapForManual')
            }
          </p>
        </div>
      )}
    </div>
  );
}

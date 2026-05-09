import { useEffect, useRef, useState } from 'react';

interface CameraScannerProps {
  onScan: (value: string) => void;
}

interface ActiveScanner {
  stop: () => Promise<void>;
  clear: () => void | Promise<void>;
}

export default function CameraScanner({ onScan }: CameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<ActiveScanner | null>(null);
  const regionId = useRef(`scanner-region-${Math.random().toString(36).slice(2, 9)}`);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) {
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // Scanner may already be stopped.
    }

    try {
      await scanner.clear();
    } catch {
      // Scanner may already be cleared.
    }

    scannerRef.current = null;
    setIsScanning(false);
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available on this device. Use manual entry below.');
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(regionId.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText) => {
          onScan(decodedText);
          await stopScanner();
        },
        () => {
          // Ignore scan misses to keep the UI quiet.
        },
      );

      setIsScanning(true);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to start the camera scanner.');
      await stopScanner();
    } finally {
      setIsStarting(false);
    }
  }

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  return (
    <div className="scanner-widget">
      <div className="camera-stage" id={regionId.current} />
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => void startScanner()} disabled={isScanning || isStarting}>
          {isStarting ? 'Starting Camera...' : isScanning ? 'Camera Active' : 'Start Camera Scan'}
        </button>
        <button className="secondary-button" type="button" onClick={() => void stopScanner()} disabled={!isScanning}>
          Stop Camera
        </button>
      </div>
      <p className="hint-text">Browser camera scanning works best on HTTPS, including GitHub Pages.</p>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  CheckCircle2,
  Camera,
  X,
  Printer,
  AlertCircle,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { endpoints, fetchAllPages } from '@/lib/api';
import { Item, Outlet } from '@/types/inventory';
import { cn } from '@/lib/utils';

export const BarcodeManager = () => {
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [selectedOutletId, setSelectedOutletId] = useState<number | ''>('');
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'QRCode'>('CODE128');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedValue, setScannedValue] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRegionId = 'inventra-barcode-scanner';
  const scannerInstanceRef = useRef<any>(null);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId);

  const barcodeValue = selectedItem
    ? `${selectedItem.sku}${selectedOutletId ? `-${selectedOutletId}` : ''}`
    : 'INVENTRA-TAG';

  useEffect(() => {
    if (barcodeType === 'CODE128' && canvasRef.current && barcodeValue) {
      try {
        JsBarcode(canvasRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: 60,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          background: '#ffffff',
          lineColor: '#141414',
          margin: 10,
        });
      } catch (e) {
        console.error('JsBarcode error:', e);
      }
    }
  }, [barcodeValue, barcodeType]);

  // Scanner lifecycle
  useEffect(() => {
    let cancelled = false;
    if (!isScanning) return;

    (async () => {
      try {
        // Dynamic import — html5-qrcode only loads in the browser.
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const Html5Qrcode = (mod as any).Html5Qrcode;
        const instance = new Html5Qrcode(scannerRegionId);
        scannerInstanceRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            setScannedValue(decoded);
            // Find a matching item by SKU prefix.
            const sku = decoded.split('-')[0];
            const match = items.find((i) => i.sku.toUpperCase() === sku.toUpperCase());
            if (match) {
              setSelectedItemId(match.id);
            }
            instance.stop().catch(() => {});
            setIsScanning(false);
          },
          () => {
            /* per-frame errors are noisy — ignore */
          },
        );
      } catch (err: any) {
        setScannerError(err?.message || 'Camera unavailable.');
      }
    })();

    return () => {
      cancelled = true;
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop?.().catch(() => {});
        scannerInstanceRef.current = null;
      }
    };
  }, [isScanning, items]);

  const downloadBarcode = () => {
    let dataUrl = '';
    if (barcodeType === 'CODE128' && canvasRef.current) {
      dataUrl = canvasRef.current.toDataURL('image/png');
    } else {
      const qrCanvas = document.getElementById('qr-canvas-element') as HTMLCanvasElement;
      if (qrCanvas) dataUrl = qrCanvas.toDataURL('image/png');
    }
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `barcode-${barcodeValue}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const printBarcode = () => {
    const canvas =
      barcodeType === 'CODE128'
        ? canvasRef.current
        : (document.getElementById('qr-canvas-element') as HTMLCanvasElement | null);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${barcodeValue}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;padding:48px;}
      img{max-width:100%;height:auto;}p{margin-top:24px;font-weight:bold;letter-spacing:.2em;}</style></head>
      <body><img src="${dataUrl}" /><p>${barcodeValue}</p></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Label Designer</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Digital Identity Production</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setScannerError(null);
              setIsScanning(true);
            }}
            className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#1A1A1A] rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center gap-2"
          >
            <Camera className="w-3.5 h-3.5" /> Start Scanner
          </button>
          <button
            onClick={printBarcode}
            disabled={!selectedItem}
            className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#1A1A1A] rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={downloadBarcode}
            disabled={!selectedItem}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 flex items-center gap-2 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        {scannedValue && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-700">
              Last scan: <span className="font-mono font-bold">{scannedValue}</span>
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 space-y-8">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">
                Configuration Matrix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                      Target Reference
                    </label>
                    <select
                      className="w-full p-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl font-bold text-sm"
                      value={selectedItemId}
                      onChange={(e) =>
                        setSelectedItemId(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    >
                      <option value="">Choose item…</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.sku} — {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                      Assigned Facility
                    </label>
                    <select
                      className="w-full p-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl font-bold text-sm"
                      value={selectedOutletId}
                      onChange={(e) =>
                        setSelectedOutletId(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    >
                      <option value="">No specific outlet</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Symbology
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setBarcodeType('CODE128')}
                      className={cn(
                        'p-4 border rounded-2xl text-left flex justify-between items-center transition-all',
                        barcodeType === 'CODE128'
                          ? 'border-black bg-black text-white'
                          : 'border-[#E5E7EB] bg-white',
                      )}
                    >
                      <span className="font-bold text-xs uppercase">Standard 1D — CODE128</span>
                      {barcodeType === 'CODE128' && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setBarcodeType('QRCode')}
                      className={cn(
                        'p-4 border rounded-2xl text-left flex justify-between items-center transition-all',
                        barcodeType === 'QRCode'
                          ? 'border-black bg-black text-white'
                          : 'border-[#E5E7EB] bg-white',
                      )}
                    >
                      <span className="font-bold text-xs uppercase">Matrix 2D — QR Code</span>
                      {barcodeType === 'QRCode' && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-12 flex flex-col items-center justify-center space-y-8 min-h-[400px]">
              <div className="bg-white p-12 rounded-2xl border border-[#E5E7EB] shadow-sm">
                {barcodeType === 'CODE128' ? (
                  <canvas ref={canvasRef} />
                ) : (
                  <QRCodeCanvas
                    id="qr-canvas-element"
                    value={barcodeValue}
                    size={180}
                    level="H"
                    includeMargin
                  />
                )}
              </div>
              <div className="text-center">
                <p className="font-mono text-xs font-bold text-[#1A1A1A] tracking-widest uppercase">
                  {barcodeValue}
                </p>
                {selectedItem && (
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-2">
                    {selectedItem.name} {selectedOutlet && `• ${selectedOutlet.name}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-[#1A1A1A] rounded-3xl p-8 shadow-2xl text-white space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Identity Logic</h3>
              <p className="text-lg font-light tracking-tight leading-snug italic">
                Pair SKU + Facility ID for a unique, scannable asset reference.
              </p>
              <div className="p-4 bg-white/5 rounded-2xl space-y-2 border border-white/10">
                <p className="font-mono text-xs font-bold text-emerald-400 tracking-widest">{barcodeValue}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Scanner modal ---------- */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScanning(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Scanning…</h3>
                  <p className="text-sm text-[#6B7280]">Point your camera at a barcode or QR code.</p>
                </div>
                <button
                  onClick={() => setIsScanning(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>
              {scannerError ? (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-rose-700">{scannerError}</p>
                </div>
              ) : (
                <div className="bg-black rounded-2xl overflow-hidden aspect-square">
                  <div id={scannerRegionId} className="w-full h-full" />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

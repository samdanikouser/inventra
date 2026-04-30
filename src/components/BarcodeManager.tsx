import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode as QrIcon, 
  Download, 
  Printer, 
  Search,
  CheckCircle2,
  MoreVertical,
  Plus,
  Camera,
  X,
  ScanLine,
  AlertCircle
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../context/InventoryContext';
import { Item, OutletId } from '../types';
import { cn } from '../utils';
import * as Html5QrcodeLibrary from 'html5-qrcode';

const { Html5Qrcode } = Html5QrcodeLibrary;

export const BarcodeManager = () => {
  const { state } = useInventory();
  const [selectedItem, setSelectedItem] = useState<Item | null>(state.items[0] || null);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletId>(state.outlets[0].id);
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'QRCode'>('CODE128');
  const [isScanning, setIsScanning] = useState(false);
  const [labelHistory, setLabelHistory] = useState<Array<{label: string, date: string, user: string}>>([
    { label: 'KSP-GLS-001', date: '5m ago', user: 'Admin' },
    { label: 'KSP-BRW-002', date: '14m ago', user: 'Ahmed' }
  ]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Html5QrcodeLibrary.Html5Qrcode | null>(null);

  useEffect(() => {
    let scanner: Html5QrcodeLibrary.Html5Qrcode | null = null;

    if (isScanning) {
      const startScanner = async () => {
        try {
          // Ensure the element exists in the DOM before initializing
          const element = document.getElementById("barcode-reader");
          if (!element) {
            console.warn("Scanner element not found in DOM");
            return;
          }

          // Robust instantiation for Html5Qrcode
          const ScannerConstructor = (Html5Qrcode as any).Html5Qrcode || Html5Qrcode;
          
          if (typeof ScannerConstructor !== 'function') {
            throw new Error(`Invalid Html5Qrcode constructor: ${typeof ScannerConstructor}`);
          }

          try {
            scanner = new ScannerConstructor("barcode-reader");
          } catch (constructorErr) {
            console.error("Direct instantiation failed, attempting fallback:", constructorErr);
            // If the above failed (e.g. Illegal constructor), attempt direct named import if we can
            if (typeof Html5Qrcode === 'function') {
              scanner = new (Html5Qrcode as any)("barcode-reader");
            } else {
              throw constructorErr;
            }
          }
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              const skuPart = decodedText.split('-')[0].split('■')[0];
              const item = state.items.find(i => i.sku === skuPart || i.sku === decodedText);
              
              if (item) {
                setSelectedItem(item);
                const parts = decodedText.split('-');
                if (parts.length > 1) {
                   const outletShortId = parts[1];
                   const outlet = state.outlets.find(o => o.id.includes(outletShortId));
                   if (outlet) setSelectedOutlet(outlet.id);
                }
                stopScanner();
              }
            },
            (errorMessage) => {
              // Expected noise
            }
          );
        } catch (err) {
          console.error("Scanner start error:", err);
          setIsScanning(false);
        }
      };

      // Small delay to ensure the modal content is rendered
      const timeoutId = setTimeout(startScanner, 100);
      return () => clearTimeout(timeoutId);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanning, state.items, state.outlets]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        // scannerRef.current.clear(); // clear() can sometimes cause errors if already stopping
      } catch (err) {
        console.warn("Scanner cleanup warning:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const barcodeValue = selectedItem ? `${selectedItem.sku}-${selectedOutlet.split('-')[1]}` : '';

  useEffect(() => {
    if (barcodeType === 'CODE128' && canvasRef.current && barcodeValue) {
      JsBarcode(canvasRef.current, barcodeValue, {
        format: "CODE128",
        width: 1.5,
        height: 60,
        displayValue: true,
        font: "monospace",
        fontSize: 10,
        background: "#ffffff",
        lineColor: "#141414",
        margin: 10
      });
    }
  }, [barcodeValue, barcodeType, selectedItem, selectedOutlet]);

  const downloadBarcode = () => {
    if (!canvasRef.current && barcodeType === 'CODE128') return;
    
    let dataUrl = '';
    if (barcodeType === 'CODE128') {
      dataUrl = canvasRef.current!.toDataURL("image/png");
    } else {
      const qrCanvas = document.getElementById('qr-canvas-element') as HTMLCanvasElement;
      if (qrCanvas) dataUrl = qrCanvas.toDataURL("image/png");
    }

    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `barcode-${barcodeValue}.png`;
      link.href = dataUrl;
      link.click();

      // Add to history
      setLabelHistory(prev => [
        { 
          label: barcodeValue, 
          date: 'Just now', 
          user: state.currentUser.name 
        }, 
        ...prev.slice(0, 4)
      ]);
    }
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
            onClick={() => setIsScanning(true)}
            className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#1A1A1A] rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Camera className="w-3.5 h-3.5" /> Start Scanner
          </button>
          <button 
            onClick={downloadBarcode}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> Export Asset
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 space-y-8">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">Configuration Matrix</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Target Reference</label>
                     <div className="relative">
                        <select 
                          className="w-full pl-4 pr-10 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl font-sans text-sm font-medium text-[#1A1A1A] outline-none appearance-none cursor-pointer focus:border-black transition-all"
                          value={selectedItem?.id || ''}
                          onChange={(e) => setSelectedItem(state.items.find(i => i.id === e.target.value) || null)}
                        >
                          {state.items.map(item => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
                        </select>
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[#9CA3AF]" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Assigned Facility</label>
                     <select 
                        className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl font-sans text-sm font-medium text-[#1A1A1A] outline-none cursor-pointer focus:border-black transition-all"
                        value={selectedOutlet}
                        onChange={(e) => setSelectedOutlet(e.target.value as OutletId)}
                      >
                        {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Symbology</label>
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => setBarcodeType('CODE128')}
                      className={cn(
                        "p-4 border rounded-2xl text-left flex justify-between items-center transition-all group",
                        barcodeType === 'CODE128' ? "border-black bg-black text-white shadow-lg shadow-black/10" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-black"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">Standard 1D</span>
                        <span className="text-[10px] opacity-60">GS1 Code 128 Compliant</span>
                      </div>
                      {barcodeType === 'CODE128' && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => setBarcodeType('QRCode')}
                      className={cn(
                        "p-4 border rounded-2xl text-left flex justify-between items-center transition-all group",
                        barcodeType === 'QRCode' ? "border-black bg-black text-white shadow-lg shadow-black/10" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-black"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">Matrix 2D</span>
                        <span className="text-[10px] opacity-60">High-capacity Data Matrix</span>
                      </div>
                      {barcodeType === 'QRCode' && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-12 flex flex-col items-center justify-center space-y-12 min-h-[400px] relative">
               <div className="absolute top-6 left-8 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em]">Live Production Stream</span>
               </div>
               
               <div className="bg-white p-12 rounded-2xl border border-[#E5E7EB] shadow-sm transform hover:scale-105 transition-transform duration-500">
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

               <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Status</span>
                    <span className="text-xs font-bold text-emerald-600">PRODUCTION READY</span>
                  </div>
                  <div className="w-[1px] h-8 bg-[#E5E7EB]" />
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Encoded</span>
                    <span className="text-xs font-mono font-bold text-[#1A1A1A]">{barcodeValue}</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-8">
             <div className="bg-[#1A1A1A] rounded-3xl p-8 shadow-2xl text-white space-y-8 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-10 transform group-hover:scale-110 transition-transform duration-700">
                   <QrIcon className="w-32 h-32" />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Identity Logic</h3>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Payload Integrity</span>
                      <p className="text-lg font-light tracking-tight leading-snug">System generates a unique cryptographic pair linking SKU to Facility ID.</p>
                   </div>
                   <div className="p-4 bg-white/5 rounded-2xl space-y-2 border border-white/10">
                      <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Pattern Preview</span>
                      <p className="font-mono text-xs font-bold text-[#E5E7EB] tracking-widest bg-black/30 p-3 rounded-lg">
                        {selectedItem?.sku}■{selectedOutlet.split('-')[1]}
                      </p>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-8 space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">Batch History</h3>
                   <span className="text-[10px] font-bold text-[#6B7280]">LAST 5 SESSIONS</span>
                </div>
                <div className="space-y-1">
                   {labelHistory.map((h, i) => (
                     <div key={i} className="flex items-center justify-between py-4 border-b border-[#F3F4F6] last:border-0 group cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded-xl transition-colors">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-[#1A1A1A] group-hover:text-black">{h.label}</span>
                           <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{h.date} • {h.user}</span>
                        </div>
                        <Printer className="w-4 h-4 text-[#E5E7EB] group-hover:text-black transition-colors" />
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsScanning(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 10 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 10 }}
               className="relative w-full max-w-lg bg-white rounded-[40px] border border-white/20 shadow-2xl p-10 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                 <div className="space-y-1">
                    <h2 className="text-2xl font-bold italic tracking-tight flex items-center gap-3">
                       <ScanLine className="w-6 h-6 text-emerald-500" />
                       Intelligent Scanner
                    </h2>
                    <p className="text-sm text-[#6B7280]">Bring identity tag into field of view to synchronize.</p>
                 </div>
                 <button onClick={() => setIsScanning(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-[#6B7280]" />
                 </button>
              </div>

              <div id="barcode-reader" className="rounded-2xl overflow-hidden border-2 border-dashed border-gray-200" />

              <div className="mt-8 p-4 bg-gray-50 rounded-2xl flex items-center gap-4 border border-gray-100">
                 <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                 </div>
                 <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider leading-relaxed">
                   System identifies SKUs and Facility ID pairs instantly. Use matrix tags for higher reliability.
                 </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>

  );
};

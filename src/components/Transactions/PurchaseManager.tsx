import React, { useState, useRef } from 'react';
import { 
  PackagePlus, 
  Search, 
  Plus, 
  Warehouse, 
  Package,
  AlertCircle,
  CheckCircle2,
  X,
  History as HistoryIcon,
  Truck,
  ArrowRight,
  Printer,
  Download,
  FileText
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { OutletId, Item, Supplier, Transaction, Outlet } from '../../types';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { useReactToPrint } from 'react-to-print';

// Printable Component
const PrintablePO = React.forwardRef<HTMLDivElement, { 
  purchase: Partial<Transaction> & { 
    item?: Item, 
    supplier?: Supplier, 
    outlet?: Outlet,
    date?: string 
  } 
}>(({ purchase }, ref) => {
  return (
    <div ref={ref} className="p-16 text-black bg-white font-sans min-h-screen">
      <div className="flex justify-between items-start mb-12 border-b-2 border-black pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Purchase Order</h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Official Procurement Document</p>
        </div>
        <div className="text-right">
          <p className="font-black text-xl italic uppercase">Inventra Enterprise</p>
          <p className="text-xs font-bold text-gray-400">LOGISTICS & SUPPLY CHAIN SYSTEM</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-16 mb-12">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Vendor Information</h2>
          <div className="space-y-1">
            <p className="text-lg font-bold">{purchase.supplier?.name || 'N/A'}</p>
            <p className="text-sm text-gray-600">{purchase.supplier?.contact}</p>
            <p className="text-sm text-gray-600">{purchase.supplier?.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Order Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-bold text-gray-400 uppercase text-[9px]">PO Reference</p>
              <p className="font-mono font-bold text-lg">{purchase.ref || 'DRAFT'}</p>
            </div>
            <div>
              <p className="font-bold text-gray-400 uppercase text-[9px]">Date Issued</p>
              <p className="font-bold">{new Date(purchase.date || Date.now()).toLocaleDateString()}</p>
            </div>
            <div className="col-span-2">
              <p className="font-bold text-gray-400 uppercase text-[9px]">Destination</p>
              <p className="font-bold">{purchase.outlet?.name || 'Central Warehouse'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-4 text-[10px] font-black uppercase tracking-widest">SKU / Code</th>
              <th className="py-4 text-[10px] font-black uppercase tracking-widest">Description</th>
              <th className="py-4 text-[10px] font-black uppercase tracking-widest text-right">Qty</th>
              <th className="py-4 text-[10px] font-black uppercase tracking-widest text-right">Unit Price</th>
              <th className="py-4 text-[10px] font-black uppercase tracking-widest text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-6 font-mono text-sm font-bold">{purchase.item?.sku}</td>
              <td className="py-6">
                <p className="font-bold text-base">{purchase.item?.name}</p>
                <p className="text-xs text-gray-500 italic mt-1">{purchase.notes || 'Standard inventory restock'}</p>
              </td>
              <td className="py-6 text-right font-bold text-base">{purchase.quantityDelta}</td>
              <td className="py-6 text-right font-bold text-base">{formatKD(purchase.unitCost || 0)}</td>
              <td className="py-6 text-right font-black text-lg">{formatKD(purchase.value || 0)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-8 text-right font-bold uppercase tracking-widest text-xs text-gray-400">Total Contract Value</td>
              <td className="py-8 text-right font-black text-3xl italic">{formatKD(purchase.value || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-16 pt-16 border-t border-gray-100">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 underline decoration-gray-200 underline-offset-8">Authorization</p>
          <div className="h-20 border-b border-black mb-2"></div>
          <p className="text-[9px] font-bold uppercase tracking-tighter text-gray-400 italic text-center">Procurement Officer Signature</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">Terms & Conditions</p>
          <p className="text-[9px] leading-relaxed text-gray-500 font-medium"> This purchase order is subject to the general terms and conditions of Inventra Enterprise. All deliveries must match the SKU and quantity specified above. Payment terms are net 30 days from invoice date unless otherwise negotiated.</p>
        </div>
      </div>
    </div>
  );
});

PrintablePO.displayName = 'PrintablePO';

export const PurchaseManager = () => {
  const { state, dispatch } = useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [poToPrint, setPoToPrint] = useState<any>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Purchase_Order_${poToPrint?.ref || 'Draft'}`,
  });

  const triggerPrint = (po: any) => {
    setPoToPrint(po);
    // Use a small timeout to ensure the state is updated before triggering print
    setTimeout(() => {
      handlePrint();
    }, 100);
  };
  
  // Form State
  const [formData, setFormData] = useState({
    itemId: '',
    outletId: '' as OutletId | '',
    supplierId: '',
    quantity: 0,
    unitCost: 0,
    notes: ''
  });

  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = state.items.find(i => i.id === formData.itemId);
  const selectedSupplier = state.suppliers.find(s => s.id === formData.supplierId);
  const selectedOutlet = state.outlets.find(o => o.id === formData.outletId);

  const filteredItems = state.items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePurchase = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.itemId) newErrors.itemId = 'Item is required';
    if (!formData.outletId) newErrors.outletId = 'Destination is required';
    if (!formData.supplierId) newErrors.supplierId = 'Vendor is required';
    if (formData.quantity <= 0) newErrors.quantity = 'Quantity must be greater than 0';
    if (formData.unitCost < 0) newErrors.unitCost = 'Unit cost cannot be negative';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const ref = `PO-${new Date().getTime().toString().slice(-6)}`;
    
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Math.random().toString(36).substr(2, 9),
        ref,
        type: 'PURCHASE',
        itemId: formData.itemId,
        outletId: formData.outletId as OutletId,
        supplierId: formData.supplierId,
        quantityDelta: formData.quantity,
        value: formData.quantity * formData.unitCost,
        unitCost: formData.unitCost,
        date: new Date().toISOString(),
        staffId: state.currentUser.id,
        notes: formData.notes
      }
    });

    setIsModalOpen(false);
    setFormData({
      itemId: '',
      outletId: '',
      supplierId: '',
      quantity: 0,
      unitCost: 0,
      notes: ''
    });
    setErrors({});
  };

  const currentStockOverall = selectedItem ? Object.values(selectedItem.stocks).reduce((a, b) => (a as number) + (b as number), 0) as number : 0;
  const isOverstockWarning = selectedItem && (currentStockOverall + formData.quantity > selectedItem.parLevel);

  const purchases = state.transactions.filter(t => t.type === 'PURCHASE');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <PackagePlus className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Purchase Management</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Inbound Stock & Procurement</span>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
        >
          <Plus className="w-3.5 h-3.5" /> New Purchase Order
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Active POs</p>
             <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{purchases.length}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Stock Inbound (Monthly)</p>
             <p className="text-2xl font-light tracking-tight text-emerald-600">
               +{purchases.reduce((acc, t) => acc + t.quantityDelta, 0)} units
             </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Procurement Spend</p>
             <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">
               {formatKD(purchases.reduce((acc, t) => acc + t.value, 0))}
             </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Recent Purchase Ledger</h3>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Vendor & Target</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Total Value</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center opacity-30">
                      <PackagePlus className="w-10 h-10 mx-auto mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No purchase records found</p>
                    </td>
                  </tr>
                ) : (
                  purchases.map(tx => {
                    const item = state.items.find(i => i.id === tx.itemId);
                    const outlet = state.outlets.find(o => o.id === tx.outletId);
                    const supplier = state.suppliers.find(s => s.id === tx.supplierId);
                    return (
                      <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-[#1A1A1A] underline decoration-[#E5E7EB] underline-offset-4">{tx.ref}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1A1A1A]">{item?.name}</span>
                            <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{item?.sku}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                 <Truck className="w-3 h-3 text-[#6B7280]" />
                                 <span className="text-[10px] font-bold text-[#1A1A1A]">{supplier?.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                                 <Warehouse className="w-3 h-3" />
                                 <span className="text-[9px] font-bold uppercase">{outlet?.name}</span>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-emerald-600">+{tx.quantityDelta} units</td>
                        <td className="px-6 py-4 text-right font-bold text-[#1A1A1A]">{formatKD(tx.value)}</td>
                        <td className="px-6 py-4">
                           <p className="text-[10px] font-bold text-[#1A1A1A] uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                           <p className="text-[9px] text-[#9CA3AF] font-bold">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button 
                             onClick={() => triggerPrint({ ...tx, item, supplier, outlet })}
                             className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-black"
                             title="Print PO"
                           >
                             <Printer className="w-4 h-4" />
                           </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Hidden Printable PO */}
      <div className="hidden">
        <PrintablePO ref={contentRef} purchase={poToPrint || {}} />
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] border border-[#E5E7EB] shadow-2xl p-10 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <PackagePlus className="w-8 h-8 text-emerald-600" />
                    New Purchase Order
                  </h2>
                  <p className="text-sm text-[#6B7280]">Record inbound stock from verified strategic vendors.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-[#6B7280]" />
                </button>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Vendor / Supplier</label>
                      <select 
                        className={cn(
                          "w-full px-4 py-3.5 bg-[#F9FAFB] border rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none",
                          errors.supplierId ? "border-red-500" : "border-[#E5E7EB]"
                        )}
                        value={formData.supplierId}
                        onChange={(e) => {
                          setFormData({ ...formData, supplierId: e.target.value });
                          if (errors.supplierId) setErrors(prev => ({ ...prev, supplierId: '' }));
                        }}
                      >
                         <option value="">Select Vendor...</option>
                         {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {errors.supplierId && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{errors.supplierId}</p>}
                   </div>

                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Target Outlet</label>
                      <select 
                        className={cn(
                          "w-full px-4 py-3.5 bg-[#F9FAFB] border rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none",
                          errors.outletId ? "border-red-500" : "border-[#E5E7EB]"
                        )}
                        value={formData.outletId}
                        onChange={(e) => {
                          setFormData({ ...formData, outletId: e.target.value as OutletId });
                          if (errors.outletId) setErrors(prev => ({ ...prev, outletId: '' }));
                        }}
                      >
                         <option value="">Select Destination...</option>
                         {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      {errors.outletId && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{errors.outletId}</p>}
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Select Inventory Item</label>
                   <select 
                     className={cn(
                       "w-full px-4 py-3.5 bg-[#F9FAFB] border rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none",
                       errors.itemId ? "border-red-500" : "border-[#E5E7EB]"
                     )}
                     value={formData.itemId}
                     onChange={(e) => {
                       const item = state.items.find(i => i.id === e.target.value);
                       setFormData({ ...formData, itemId: e.target.value, unitCost: item?.unitCost || 0 });
                       if (errors.itemId) setErrors(prev => ({ ...prev, itemId: '' }));
                     }}
                   >
                      <option value="">Choose item to purchase...</option>
                      {state.items.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name}</option>)}
                   </select>
                   {errors.itemId && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{errors.itemId}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Quantity Inbound</label>
                      <input 
                        type="number" 
                        min={1}
                        className={cn(
                          "w-full px-4 py-3.5 bg-[#F9FAFB] border rounded-2xl font-sans text-sm outline-none focus:border-black transition-all",
                          errors.quantity ? "border-red-500" : "border-[#E5E7EB]"
                        )}
                        value={formData.quantity}
                        onChange={(e) => {
                          setFormData({ ...formData, quantity: Number(e.target.value) });
                          if (errors.quantity) setErrors(prev => ({ ...prev, quantity: '' }));
                        }}
                      />
                      {errors.quantity && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{errors.quantity}</p>}
                   </div>
                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Unit Cost (KD)</label>
                      <input 
                        type="number" 
                        step="0.001"
                        className={cn(
                          "w-full px-4 py-3.5 bg-[#F9FAFB] border rounded-2xl font-sans text-sm outline-none focus:border-black transition-all",
                          errors.unitCost ? "border-red-500" : "border-[#E5E7EB]"
                        )}
                        value={formData.unitCost}
                        onChange={(e) => {
                          setFormData({ ...formData, unitCost: Number(e.target.value) });
                          if (errors.unitCost) setErrors(prev => ({ ...prev, unitCost: '' }));
                        }}
                      />
                      {errors.unitCost && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">{errors.unitCost}</p>}
                   </div>
                </div>

                {isOverstockWarning && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-orange-800 uppercase tracking-tight">Potential Overstock Warning</p>
                      <p className="text-[11px] text-orange-700 font-medium">
                        This purchase of {formData.quantity} will bring total stock to {currentStockOverall + formData.quantity}, 
                        which exceeds the set Par Level of {selectedItem?.parLevel}.
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Internal Remarks</label>
                   <textarea 
                     className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none h-24 resize-none focus:border-black transition-all"
                     placeholder="Shipping notes, batch numbers..."
                     value={formData.notes}
                     onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                   />
                </div>

                <div className="pt-6 grid grid-cols-3 gap-4">
                   <button 
                    onClick={() => {
                        const previewPO = {
                          ref: 'DRAFT',
                          type: 'PURCHASE',
                          itemId: formData.itemId,
                          outletId: formData.outletId as OutletId,
                          supplierId: formData.supplierId,
                          quantityDelta: formData.quantity,
                          value: formData.quantity * formData.unitCost,
                          unitCost: formData.unitCost,
                          date: new Date().toISOString(),
                          notes: formData.notes,
                          item: selectedItem,
                          supplier: selectedSupplier,
                          outlet: selectedOutlet
                        };
                        triggerPrint(previewPO);
                    }}
                    disabled={!formData.itemId || !formData.outletId || !formData.supplierId || formData.quantity <= 0}
                    className="py-4 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                   >
                     <Printer className="w-4 h-4" /> PO Preview
                   </button>
                   <button 
                    onClick={() => setIsModalOpen(false)}
                    className="py-4 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                   >
                     Discard
                   </button>
                   <button 
                    onClick={handlePurchase}
                    disabled={!formData.itemId || !formData.outletId || !formData.supplierId || formData.quantity <= 0}
                    className="py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-30"
                   >
                     Confirm Order
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

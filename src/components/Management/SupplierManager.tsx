import React, { useState } from 'react';
import { 
  Users, 
  Mail, 
  Phone, 
  Clock, 
  MoreVertical,
  Plus,
  ExternalLink,
  Trash2,
  Edit2,
  X,
  History as HistoryIcon,
  Info
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier } from '../../types';

export const SupplierManager = () => {
  const { state, dispatch } = useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    leadTimeDays: 3
  });

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact: supplier.contact,
        email: supplier.email,
        leadTimeDays: supplier.leadTimeDays
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact: '',
        email: '',
        leadTimeDays: 3
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingSupplier) {
      dispatch({
        type: 'UPDATE_SUPPLIER',
        payload: { id: editingSupplier.id, ...formData }
      });
    } else {
      dispatch({
        type: 'ADD_SUPPLIER',
        payload: {
          id: `SUP-${Math.random().toString(36).substr(2, 9)}`,
          ...formData
        }
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this vendor? This might affect historical tracking.')) {
      dispatch({ type: 'DELETE_SUPPLIER', payload: id });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Vendor Directory</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{state.suppliers.length} Strategic Partners</span>
        </div>
        {state.currentUser.role === 'MANAGER' && (
          <button 
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Vendor Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Contact Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Lead Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Score</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 group/info">
                    Total Procurement
                    <Info className="w-3 h-3 cursor-help opacity-40 hover:opacity-100 transition-opacity" />
                    <div className="absolute top-0 right-0 mt-8 mr-6 bg-black text-white text-[9px] p-2 rounded hidden group-hover/info:block z-20 w-48 normal-case font-medium shadow-xl">
                      Calculated as the sum of all confirmed Purchase Transactions (PO) linked to this vendor.
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.suppliers.map(supplier => {
                const supplierPurchases = state.transactions.filter(t => t.type === 'PURCHASE' && t.supplierId === supplier.id);
                const totalSpend = supplierPurchases.reduce((acc, t) => acc + t.value, 0);

                return (
                  <tr key={supplier.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-6 py-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-sm">
                             {supplier.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                             <p className="font-bold text-[#1A1A1A]">{supplier.name}</p>
                             <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{supplier.id}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-6 font-medium text-xs text-[#1A1A1A]">
                       <div className="space-y-1.5 font-bold tracking-tight">
                          <div className="flex items-center gap-2 text-[#4B5563]">
                             <Mail className="w-3.5 h-3.5 opacity-60" />
                             <span>{supplier.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[#4B5563]">
                             <Phone className="w-3.5 h-3.5 opacity-60" />
                             <span>{supplier.contact}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold uppercase border border-amber-100">
                          <Clock className="w-3 h-3" />
                          {supplier.leadTimeDays} Days
                       </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-emerald-100">Optimal</span>
                    </td>
                    <td className="px-6 py-6 text-right">
                       <button 
                         onClick={() => { setSelectedSupplierForLedger(supplier); setIsLedgerOpen(true); }}
                         className="flex flex-col items-end group/btn"
                       >
                         <span className="font-light text-[#1A1A1A] text-base group-hover/btn:text-blue-600 transition-colors">{formatKD(totalSpend)}</span>
                         <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-tighter group-hover/btn:text-blue-500 transition-colors">View Ledger →</span>
                       </button>
                    </td>
                    <td className="px-6 py-6">
                       <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(supplier)}
                            className="p-2 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(supplier.id)}
                            className="p-2 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl p-8 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{editingSupplier ? 'Update Vendor' : 'New Vendor Entry'}</h2>
                  <p className="text-sm text-[#6B7280]">Establish a direct link to the supply chain.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Vendor Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Acme Supplies Ltd"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Direct Contact</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      placeholder="+965 XXXX XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Lead Time (Days)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                      value={formData.leadTimeDays}
                      onChange={(e) => setFormData({...formData, leadTimeDays: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Orders Inbound Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="logistics@vendor.com"
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all text-center"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={!formData.name}
                    className="flex-1 py-3 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-lg shadow-black/10 disabled:opacity-30"
                  >
                    {editingSupplier ? 'Save Update' : 'Initialize Vendor'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLedgerOpen && selectedSupplierForLedger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLedgerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-4xl bg-white rounded-[32px] border border-[#E5E7EB] shadow-2xl p-10 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <HistoryIcon className="w-6 h-6 text-blue-600" />
                    Procurement Ledger: {selectedSupplierForLedger.name}
                  </h2>
                  <p className="text-sm text-[#6B7280]">Historical purchase list with verified audit trail.</p>
                </div>
                <button 
                  onClick={() => setIsLedgerOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-[#6B7280]" />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto mb-6 border border-[#F3F4F6] rounded-2xl">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0">
                    <tr>
                      <th className="px-6 py-3 font-bold text-[#6B7280] uppercase tracking-wider">Ref</th>
                      <th className="px-6 py-3 font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                      <th className="px-6 py-3 font-bold text-[#6B7280] uppercase tracking-wider text-right">Value (KD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.transactions
                      .filter(t => t.type === 'PURCHASE' && t.supplierId === selectedSupplierForLedger.id)
                      .map(tx => {
                        const item = state.items.find(i => i.id === tx.itemId);
                        return (
                          <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold">{tx.ref}</td>
                            <td className="px-6 py-4 text-[#6B7280]">{new Date(tx.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                               <p className="font-bold">{item?.name}</p>
                               <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">{item?.sku}</p>
                            </td>
                            <td className="px-6 py-4 text-right font-medium">{tx.quantityDelta}</td>
                            <td className="px-6 py-4 text-right font-bold text-blue-600">{formatKD(tx.value)}</td>
                          </tr>
                        );
                      })}
                    {state.transactions.filter(t => t.type === 'PURCHASE' && t.supplierId === selectedSupplierForLedger.id).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-[#9CA3AF] italic">No confirmed procurement history for this vendor.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-6 border-t border-[#F3F4F6]">
                <button 
                  onClick={() => setIsLedgerOpen(false)}
                  className="px-8 py-3 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-xl shadow-black/10"
                >
                  Close Archive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

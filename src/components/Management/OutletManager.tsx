import React, { useState } from 'react';
import { 
  Warehouse, 
  MapPin, 
  MoreVertical,
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Outlet, OutletId } from '../../types';

export const OutletManager = () => {
  const { state, dispatch } = useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [formData, setFormData] = useState({
    name: ''
  });

  const handleOpenModal = (outlet?: Outlet) => {
    if (outlet) {
      setEditingOutlet(outlet);
      setFormData({ name: outlet.name });
    } else {
      setEditingOutlet(null);
      setFormData({ name: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingOutlet) {
      dispatch({
        type: 'UPDATE_OUTLET',
        payload: { id: editingOutlet.id, name: formData.name }
      });
    } else {
      const id = `OUT-${(state.outlets.length + 1).toString().padStart(3, '0')}` as OutletId;
      dispatch({
        type: 'ADD_OUTLET',
        payload: {
          id,
          name: formData.name
        }
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: OutletId) => {
    const hasInventory = state.items.some(i => (i.stocks[id] || 0) > 0);
    if (hasInventory) {
      alert("Cannot delete outlet with active inventory. Please transfer stock first.");
      return;
    }
    
    if (window.confirm('Confirm decommissioning of this location?')) {
      dispatch({ type: 'DELETE_OUTLET', payload: id });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Outlet Management</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{state.outlets.length} Active Locations</span>
        </div>
        {state.currentUser.role === 'MANAGER' && (
          <button 
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-4 h-4" /> Register New Outlet
          </button>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.outlets.map(outlet => {
            const outletItems = state.items.filter(i => i.stocks[outlet.id] !== undefined);
            const totalStock = outletItems.reduce((acc, i) => acc + (i.stocks[outlet.id] || 0), 0);
            const totalValue = outletItems.reduce((acc, i) => acc + ((i.stocks[outlet.id] || 0) * i.unitCost), 0);

            return (
              <div key={outlet.id} className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm flex flex-col hover:border-black transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-black group-hover:text-white transition-colors shadow-sm">
                    <Warehouse className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(outlet)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button 
                      onClick={() => handleDelete(outlet.id)}
                      className="p-2 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-bold text-[#1A1A1A]">{outlet.name}</h3>
                  <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{outlet.id}</span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4 border-t border-[#F3F4F6] pt-6 mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Stock Load</p>
                    <p className="text-sm font-bold text-[#1A1A1A]">{totalStock} units</p>
                  </div>
                  <div className="space-y-1 border-l border-[#F3F4F6] pl-4">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase text-emerald-600">Inventory Value</p>
                    <p className="text-sm font-bold text-emerald-600">{formatKD(totalValue)}</p>
                  </div>
                </div>

                <button className="w-full py-3 bg-[#F9FAFB] hover:bg-black hover:text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest text-[#6B7280] transition-all flex items-center justify-center gap-2">
                  View Detail Inventory <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
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
                  <h2 className="text-2xl font-bold">{editingOutlet ? 'Update Facility' : 'New Facility Registration'}</h2>
                  <p className="text-sm text-[#6B7280]">Define a new physical storage or service point.</p>
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
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Outlet / Facility Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    placeholder="e.g. Poolside Terrace"
                    autoFocus
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
                    {editingOutlet ? 'Save Changes' : 'Initialize Outlet'}
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

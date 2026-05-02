import React, { useState } from 'react';
import { 
  Tags, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  AlertCircle
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils';

export const CategoryManager = () => {
  const { state, dispatch } = useInventory();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newCategoryName.trim()) return;
    dispatch({ type: 'ADD_CATEGORY', payload: newCategoryName.trim() });
    setNewCategoryName('');
    setIsAddModalOpen(false);
  };

  const handleUpdate = (oldName: string) => {
    if (!editValue.trim() || editValue === oldName) {
      setEditingCategory(null);
      return;
    }
    dispatch({ type: 'UPDATE_CATEGORY', payload: { oldName, newName: editValue.trim() } });
    setEditingCategory(null);
  };

  const handleDelete = (name: string) => {
    dispatch({ type: 'DELETE_CATEGORY', payload: name });
    setDeleteConfirm(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Tags className="w-5 h-5 text-black" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Category Management</h2>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Define New Category
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Structural Impact Note</p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Updating an existing category name will automatically update all items currently assigned to it. 
                Deleting a category will not delete the items, but they will retain the old category name until updated manually.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.categories.map((category) => (
              <motion.div 
                layout
                key={category}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
              >
                {editingCategory === category ? (
                  <div className="space-y-3">
                    <input 
                      autoFocus
                      className="w-full px-3 py-2 bg-[#F9FAFB] border border-black rounded-lg text-sm font-bold outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(category)}
                    />
                    <div className="flex gap-2">
                       <button 
                         onClick={() => handleUpdate(category)}
                         className="flex-1 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
                       >
                         Save Changes
                       </button>
                       <button 
                         onClick={() => setEditingCategory(null)}
                         className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-gray-50"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-between gap-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A1A1A]">{category}</h3>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">
                          {state.items.filter(i => i.category === category).length} Items Assigned
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingCategory(category);
                            setEditValue(category);
                          }}
                          className="p-1.5 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(category)}
                          className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold">New Category</h3>
                <p className="text-xs text-[#6B7280] font-medium mt-1">Define a new structural category for inventory items.</p>
              </div>

              <input 
                autoFocus
                placeholder="e.g., Disposables, Stationery"
                className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm font-bold outline-none focus:border-black transition-all"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  disabled={!newCategoryName.trim()}
                  className="flex-1 py-3 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg shadow-black/10 disabled:opacity-30"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold">Remove Category?</h3>
              <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-black">"{deleteConfirm}"</span>? 
                This will remove it from the classification list.
              </p>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl text-xs font-bold uppercase tracking-widest text-[#6B7280]"
                >
                  Keep It
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

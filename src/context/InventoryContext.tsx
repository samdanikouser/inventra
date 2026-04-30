import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { InventoryState, Transaction, Item, OutletId, Category, StockTakeSession, StockTakeItem, Supplier, InventorySnapshot, Outlet } from '../types';
import { INITIAL_STATE } from '../data/mockData';
import { calculateNewWAC } from '../utils';

type Action =
  | { type: 'ADD_TRANSACTION'; payload: Transaction & { unitCost?: number } }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: Partial<Item> & { id: string } }
  | { type: 'SET_CURRENT_USER'; payload: string }
  | { type: 'CREATE_STOCK_TAKE'; payload: StockTakeSession }
  | { type: 'UPDATE_STOCK_TAKE'; payload: StockTakeSession }
  | { type: 'CLOSE_MONTH'; payload: InventorySnapshot }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Partial<Supplier> & { id: string } }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'ADD_OUTLET'; payload: Outlet }
  | { type: 'UPDATE_OUTLET'; payload: Partial<Outlet> & { id: string } }
  | { type: 'DELETE_OUTLET'; payload: OutletId };

const inventoryReducer = (state: InventoryState, action: Action): InventoryState => {
  switch (action.type) {
    case 'ADD_TRANSACTION': {
      const { payload } = action;
      
      const txMonth = new Date(payload.date).toISOString().slice(0, 7);
      const isLocked = state.snapshots.some(s => s.month === txMonth);
      if (isLocked) {
        console.warn('Attempted to add transaction to a locked month:', txMonth);
        return state;
      }

      const updatedItems = state.items.map(item => {
        if (item.id === payload.itemId) {
          const currentTotalStock = Object.values(item.stocks).reduce((a, b) => a + b, 0);
          
          let newUnitCost = item.unitCost;
          if (payload.type === 'PURCHASE' && payload.unitCost) {
            newUnitCost = calculateNewWAC(currentTotalStock, item.unitCost, payload.quantityDelta, payload.unitCost);
          }

          const newStocks = { ...item.stocks };
          // Check for negative stock risks
          if (payload.type !== 'PURCHASE') {
            const currentStock = newStocks[payload.outletId] || 0;
            if (currentStock + payload.quantityDelta < 0) {
              console.error(`State Integrity Error: Attempted to subtract ${Math.abs(payload.quantityDelta)} from stock of ${currentStock} for item ${item.sku}`);
              // We'll proceed with clamping to 0 in the reducer as a fallback safety, 
              // but the UI should have already blocked this.
              newStocks[payload.outletId] = 0;
            } else {
              newStocks[payload.outletId] += payload.quantityDelta;
            }
          } else {
            newStocks[payload.outletId] += payload.quantityDelta;
          }

          if (payload.type === 'TRANSFER' && payload.targetOutletId) {
             newStocks[payload.targetOutletId] -= payload.quantityDelta; // delta is negative for transfers
          }

          return { ...item, stocks: newStocks, unitCost: newUnitCost };
        }
        return item;
      });

      return {
        ...state,
        items: updatedItems,
        transactions: [payload, ...state.transactions],
      };
    }
    case 'ADD_ITEM':
      return {
        ...state,
        items: [action.payload, ...state.items]
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        )
      };
    case 'SET_CURRENT_USER': {
      const user = state.users.find(u => u.id === action.payload);
      return user ? { ...state, currentUser: user } : state;
    }
    case 'CREATE_STOCK_TAKE':
      return { ...state, stockTakeSessions: [action.payload, ...state.stockTakeSessions] };
    case 'UPDATE_STOCK_TAKE':
      return {
        ...state,
        stockTakeSessions: state.stockTakeSessions.map(s => s.id === action.payload.id ? action.payload : s)
      };
    case 'CLOSE_MONTH':
      return {
        ...state,
        snapshots: [action.payload, ...state.snapshots]
      };
    case 'ADD_SUPPLIER':
      return {
        ...state,
        suppliers: [action.payload, ...state.suppliers]
      };
    case 'UPDATE_SUPPLIER':
      return {
        ...state,
        suppliers: state.suppliers.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s)
      };
    case 'DELETE_SUPPLIER':
      return {
        ...state,
        suppliers: state.suppliers.filter(s => s.id !== action.payload)
      };
    case 'ADD_OUTLET':
      return {
        ...state,
        outlets: [...state.outlets, action.payload]
      };
    case 'UPDATE_OUTLET':
      return {
        ...state,
        outlets: state.outlets.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o)
      };
    case 'DELETE_OUTLET':
      return {
        ...state,
        outlets: state.outlets.filter(o => o.id !== action.payload)
      };
    default:
      return state;
  }
};

const InventoryContext = createContext<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(inventoryReducer, INITIAL_STATE);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('inventra_state');
    if (saved) {
      // For demo, we might want to skip loading if it breaks, but usually we'd parse
      // dispatch({ type: 'LOAD_STATE', payload: JSON.parse(saved) });
    }
  }, []);

  return (
    <InventoryContext.Provider value={{ state, dispatch }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within InventoryProvider');
  return context;
};

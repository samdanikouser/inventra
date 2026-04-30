import { InventoryState, Item, Transaction, Supplier, User, StockTakeSession, Outlet } from '../types';

export const INITIAL_OUTLETS: Outlet[] = [
  { id: 'OUT-001', name: 'Main Restaurant' },
  { id: 'OUT-002', name: 'Rooftop Lounge' },
  { id: 'OUT-003', name: 'Café & Bakery' },
  { id: 'OUT-004', name: 'Banquet Hall' },
];

export const INITIAL_USERS: User[] = [
  { id: 'USR-001', name: 'Ahmed Al-Saif', role: 'MANAGER' },
  { id: 'USR-002', name: 'Sarah Miller', role: 'SUPERVISOR' },
  { id: 'USR-003', name: 'John Doe', role: 'STAFF' },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'SUP-001', name: 'Al-Kout Catering Supplies', contact: '+965 2222 1111', email: 'sales@alkout.com', leadTimeDays: 3 },
  { id: 'SUP-002', name: 'Gulf Glassworks', contact: '+965 2222 2222', email: 'orders@gulfglass.com', leadTimeDays: 5 },
  { id: 'SUP-003', name: 'Kitchen Masters', contact: '+965 2222 3333', email: 'support@kitchenmasters.kw', leadTimeDays: 7 },
];

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'ITM-001',
    sku: 'KSP-GLS-001',
    name: 'Champagne Flute - Crystal',
    category: 'Glassware',
    unit: 'pc',
    minStock: 48,
    parLevel: 144,
    unitCost: 2.500,
    stocks: {
      'OUT-001': 86,
      'OUT-002': 24,
      'OUT-003': 12,
      'OUT-004': 200,
    }
  },
  {
    id: 'ITM-002',
    sku: 'KSP-BRW-001',
    name: 'Cocktail Shaker - Pro',
    category: 'Barware',
    unit: 'pc',
    minStock: 5,
    parLevel: 12,
    unitCost: 8.750,
    stocks: {
      'OUT-001': 4,
      'OUT-002': 6,
      'OUT-003': 0,
      'OUT-004': 2,
    }
  },
  {
    id: 'ITM-003',
    sku: 'KSP-CRO-001',
    name: 'Dinner Plate 12"',
    category: 'Crockery',
    unit: 'pc',
    minStock: 100,
    parLevel: 300,
    unitCost: 4.200,
    stocks: {
      'OUT-001': 150,
      'OUT-002': 0,
      'OUT-003': 40,
      'OUT-004': 250,
    }
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-001',
    ref: 'PO-20240401-01',
    type: 'PURCHASE',
    itemId: 'ITM-001',
    outletId: 'OUT-001',
    quantityDelta: 100,
    value: 250,
    date: '2024-04-01T10:00:00Z',
    staffId: 'USR-001',
    supplierId: 'SUP-002',
  },
  {
    id: 'TXN-002',
    ref: 'BRK-20240415-01',
    type: 'BREAKAGE',
    itemId: 'ITM-001',
    outletId: 'OUT-001',
    quantityDelta: -10,
    value: 25,
    date: '2024-04-15T22:30:00Z',
    staffId: 'USR-003',
    reason: 'Accidental Drop',
  }
];

export const INITIAL_STATE: InventoryState = {
  items: INITIAL_ITEMS,
  transactions: INITIAL_TRANSACTIONS,
  outlets: INITIAL_OUTLETS,
  suppliers: INITIAL_SUPPLIERS,
  users: INITIAL_USERS,
  stockTakeSessions: [],
  snapshots: [],
  currentUser: INITIAL_USERS[0],
};

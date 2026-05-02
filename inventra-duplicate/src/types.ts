
export type Category = string;

export type OutletId = 'OUT-001' | 'OUT-002' | 'OUT-003' | 'OUT-004';

export interface Outlet {
  id: OutletId;
  name: string;
}

export type TransactionType = 'PURCHASE' | 'BREAKAGE' | 'WRITE_OFF' | 'TRANSFER' | 'ADJUSTMENT';

export interface Transaction {
  id: string;
  ref: string;
  type: TransactionType;
  itemId: string;
  outletId: OutletId;
  targetOutletId?: OutletId; // For transfers
  quantityDelta: number;
  value: number; // For WAC valuation
  date: string;
  staffId: string;
  notes?: string;
  supplierId?: string;
  reason?: string;
  photo?: string;
  approvedBy?: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: Category;
  unit: string;
  minStock: number;
  parLevel: number;
  unitCost: number; // Weighted Average Cost (WAC)
  photo?: string;
  stocks: Record<OutletId, number>;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  leadTimeDays: number;
}

export interface User {
  id: string;
  name: string;
  role: 'STAFF' | 'SUPERVISOR' | 'MANAGER';
}

export type StockTakeStatus = 'OPEN' | 'SUBMITTED' | 'CLOSED';

export interface StockTakeItem {
  itemId: string;
  systemQty: number;
  physicalQty?: number;
  variance?: number;
  decision?: 'APPROVE' | 'KEEP';
  reason?: string;
}

export interface StockTakeReport {
  openingValue: number;
  closingValue: number;
  varianceValue: number;
  breakagesValue: number;
  writeOffsValue: number;
  netImpact: number;
}

export interface StockTakeSession {
  id: string;
  ref: string;
  date: string;
  outletId: OutletId;
  categories: Category[];
  status: StockTakeStatus;
  items: StockTakeItem[];
  staffId: string;
  managerId?: string;
  report?: StockTakeReport;
}

export interface InventorySnapshot {
  id: string;
  month: string; // YYYY-MM
  closedAt: string;
  closedBy: string;
  totalValuation: number;
  items: {
    itemId: string;
    sku: string;
    name: string;
    unitCost: number;
    totalStock: number;
    valuation: number;
    stocks: Record<string, number>;
  }[];
  outletBreakdown: Record<string, number>;
}

export interface InventoryState {
  items: Item[];
  transactions: Transaction[];
  outlets: Outlet[];
  suppliers: Supplier[];
  users: User[];
  stockTakeSessions: StockTakeSession[];
  snapshots: InventorySnapshot[];
  categories: string[];
  currentUser: User;
}

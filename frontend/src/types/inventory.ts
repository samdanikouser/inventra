export interface Category {
  id: number;
  name: string;
}

export interface Outlet {
  id: number;
  name: string;
  location?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  email: string;
  lead_time_days: number;
}

export type TransactionType = 'PURCHASE' | 'BREAKAGE' | 'WRITE_OFF' | 'TRANSFER' | 'ADJUSTMENT';

export interface Transaction {
  id: number;
  ref: string;
  type: TransactionType;
  item: number;
  item_name: string;
  outlet: number;
  outlet_name: string;
  target_outlet?: number;
  target_outlet_name?: string;
  quantity_delta: number;
  value: string | number;
  date: string;
  staff: number;
  staff_name: string;
  notes?: string;
  reason?: string;
  supplier?: number;
  supplier_name?: string;
}

export interface Stock {
  outlet: number;
  outlet_name: string;
  quantity: number;
}

export interface Item {
  id: number;
  sku: string;
  name: string;
  category: number;
  category_name: string;
  unit: string;
  min_stock: number;
  par_level: number;
  unit_cost: string | number;
  photo?: string;
  stocks: Stock[];
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name?: string;
}

export type UserRole = 'STAFF' | 'SUPERVISOR' | 'MANAGER';

export interface CurrentUser extends User {
  role: UserRole;
  is_manager: boolean;
  is_supervisor: boolean;
}

export type StockTakeStatus = 'OPEN' | 'SUBMITTED' | 'CLOSED';

export interface StockTakeItem {
  id: number;
  item: number;
  item_name: string;
  sku: string;
  system_qty: number;
  physical_qty?: number;
  variance?: number;
  reason?: string;
}

export interface StockTakeSession {
  id: number;
  ref: string;
  date: string;
  outlet: number;
  outlet_name: string;
  status: StockTakeStatus;
  items: StockTakeItem[];
  staff: number;
  staff_name: string;
  manager?: number;
}

export interface InventorySnapshotItem {
  id: number;
  item: number;
  sku: string;
  name: string;
  unit_cost: string | number;
  total_stock: number;
  valuation: string | number;
  stocks_json: any;
}

export interface InventorySnapshot {
  id: number;
  ref: string;
  month: string;
  closed_at: string;
  closed_by: number;
  closed_by_name: string;
  total_valuation: string | number;
  items: InventorySnapshotItem[];
}

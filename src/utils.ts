import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InventoryState, Transaction, Item, OutletId } from './types';

/**
 * Utility for merging tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates new Weighted Average Cost (WAC)
 */
export const calculateNewWAC = (currentStock: number, currentWAC: number, newQty: number, newCost: number): number => {
  if (currentStock + newQty <= 0) return currentWAC;
  const totalValue = (currentStock * currentWAC) + (newQty * newCost);
  return totalValue / (currentStock + newQty);
};

export const getColorForStatus = (current: number, min: number) => {
  if (current <= 0) return 'bg-red-50 text-red-700 border border-red-100';
  if (current < min) return 'bg-orange-50 text-orange-700 border border-orange-100';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
};

export const getProgressBarColor = (current: number, min: number) => {
  if (current <= 0) return 'bg-red-500';
  if (current < min) return 'bg-orange-500';
  return 'bg-emerald-500';
};

export const formatKD = (amount: number) => {
  return new Intl.NumberFormat('en-KW', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
  }).format(amount);
};

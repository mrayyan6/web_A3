import type { Priority } from '@/types/lead';

export function computePriority(budget: number): Priority {
  if (budget > 20_000_000) return 'High';
  if (budget >= 10_000_000) return 'Medium';
  return 'Low';
}

export function computeScore(budget: number): number {
  if (budget > 20_000_000) return 85;
  if (budget >= 10_000_000) return 55;
  return 25;
}

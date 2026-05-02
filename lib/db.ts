import Dexie, { type Table } from 'dexie';
import type { Child, Screening, HealthWorker } from '@/types';

export class NuruScreenDB extends Dexie {
  children!: Table<Child>;
  screenings!: Table<Screening>;
  healthWorkers!: Table<HealthWorker>;
  constructor() {
    super('NuruScreenDB');
    this.version(1).stores({
      children: 'id, name, village, lga, state, climateContext, createdAt, healthWorkerId',
      screenings: 'id, childId, riskLevel, screenedAt, healthWorkerId, synced',
      healthWorkers: 'id, name, facility',
    });
  }
}

export const db = new NuruScreenDB();

export async function saveChild(child: Child) { await db.children.put(child); }
export async function getChildren(healthWorkerId: string): Promise<Child[]> {
  return db.children.where('healthWorkerId').equals(healthWorkerId).reverse().sortBy('createdAt');
}
export async function getChild(id: string): Promise<Child | undefined> { return db.children.get(id); }
export async function saveScreening(s: Screening) { await db.screenings.put(s); }
export async function getScreeningsForChild(childId: string): Promise<Screening[]> {
  return db.screenings.where('childId').equals(childId).reverse().sortBy('screenedAt');
}
export async function getRecentScreenings(healthWorkerId: string, limit = 20): Promise<Screening[]> {
  return db.screenings.where('healthWorkerId').equals(healthWorkerId).reverse().sortBy('screenedAt').then(s => s.slice(0, limit));
}
export async function getDashboardStats(healthWorkerId: string) {
  const screenings = await db.screenings.where('healthWorkerId').equals(healthWorkerId).toArray();
  const children = await db.children.where('healthWorkerId').equals(healthWorkerId).toArray();
  const riskCounts = { green: 0, yellow: 0, red: 0, unknown: 0 };
  screenings.forEach(s => riskCounts[s.riskLevel]++);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return { totalChildren: children.length, totalScreenings: screenings.length, recentScreenings: screenings.filter(s => s.screenedAt > sevenDaysAgo).length, riskCounts };
}
export async function saveHealthWorker(hw: HealthWorker) { await db.healthWorkers.put(hw); }
export async function getHealthWorker(id: string): Promise<HealthWorker | undefined> { return db.healthWorkers.get(id); }

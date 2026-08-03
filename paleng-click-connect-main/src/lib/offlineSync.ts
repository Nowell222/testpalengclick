import { openDB, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB('palengclick-offline-db', 1, {
    upgrade(db) {
      const store = db.createObjectStore('offline_payments', {
        keyPath: 'id',
      });
      store.createIndex('by-synced', 'synced');
    },
  });
}

export const saveOfflinePayment = async (payment: any) => {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('offline_payments', {
    ...payment,
    id: crypto.randomUUID(),
    synced: false,
    created_at: new Date().toISOString(),
  });
};

export const syncOfflinePayments = async () => {
  if (!dbPromise) return { success: true, count: 0 };
  const db = await dbPromise;

  // Use getAll() + JS filter — booleans are not valid IDB keys and
  // cannot be used with getAllFromIndex/countFromIndex queries.
  const allPayments: any[] = await db.getAll('offline_payments');
  const offlinePayments = allPayments.filter((p: any) => !p.synced);

  if (offlinePayments.length === 0) return { success: true, count: 0 };

  let successCount = 0;

  for (const p of offlinePayments) {
    try {
      // Remove local-only fields before syncing
      const { id, synced, ...dbPayload } = p;

      // Sanitize offline temp shift_id
      if (dbPayload.shift_id && typeof dbPayload.shift_id === 'string' && (dbPayload.shift_id.startsWith('offline-shift-') || dbPayload.shift_id.startsWith('shift-'))) {
        dbPayload.shift_id = null;
      }

      const { error } = await supabase.from('payments').insert({
        ...dbPayload,
        status: 'completed', // Since cashier took it directly
      });

      if (!error) {
        // Mark as synced locally
        await db.put('offline_payments', { ...p, synced: true });
        successCount++;
      } else {
        console.error('Sync error for payment:', error);
      }
    } catch (e) {
      console.error('Failed to sync payment', e);
    }
  }

  // Clear synced payments to save space
  const syncedPayments = allPayments.filter((p: any) => p.synced);
  for (const s of syncedPayments) {
    await db.delete('offline_payments', s.id);
  }

  return { success: true, count: successCount, total: offlinePayments.length };
};

export const getUnsyncedCount = async () => {
  if (!dbPromise) return 0;
  const db = await dbPromise;
  const all: any[] = await db.getAll('offline_payments');
  return all.filter((p: any) => !p.synced).length;
};


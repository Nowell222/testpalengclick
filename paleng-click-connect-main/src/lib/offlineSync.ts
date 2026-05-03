import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

interface PalengClickDB extends DBSchema {
  offline_payments: {
    key: string;
    value: {
      id: string;
      vendor_id: string;
      stall_id?: string | null;
      amount: number;
      payment_method: string;
      payment_type: string;
      period_month?: number | null;
      period_year?: number | null;
      processed_by: string;
      created_at: string;
      status: string;
      synced: boolean;
    };
    indexes: { 'by-synced': boolean };
  };
}

let dbPromise: Promise<IDBPDatabase<PalengClickDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<PalengClickDB>('palengclick-offline-db', 1, {
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

  const offlinePayments = await db.getAllFromIndex('offline_payments', 'by-synced', false);
  if (offlinePayments.length === 0) return { success: true, count: 0 };

  let successCount = 0;

  for (const p of offlinePayments) {
    try {
      // Remove local-only fields before syncing
      const { id, synced, ...dbPayload } = p;

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

  // Optional: clear synced payments to save space
  const syncedPayments = await db.getAllFromIndex('offline_payments', 'by-synced', true);
  for (const s of syncedPayments) {
    await db.delete('offline_payments', s.id);
  }

  return { success: true, count: successCount, total: offlinePayments.length };
};

export const getUnsyncedCount = async () => {
  if (!dbPromise) return 0;
  const db = await dbPromise;
  return await db.countFromIndex('offline_payments', 'by-synced', false);
};

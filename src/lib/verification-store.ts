import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type { PullConfirmationRecord, ScanVerificationRecord } from '../types';

const PULL_CONFIRMATIONS_COLLECTION = 'pullConfirmations';
const SCAN_VERIFICATIONS_COLLECTION = 'scanVerifications';

function normalizeItem(value: string) {
  return value.trim();
}

function toIsoString(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return undefined;
}

function mapPullConfirmation(id: string, data: Record<string, unknown>): PullConfirmationRecord {
  return {
    id,
    pickTicketId: String(data.pickTicketId ?? ''),
    lineId: String(data.lineId ?? ''),
    orderNumber: String(data.orderNumber ?? ''),
    item: String(data.item ?? ''),
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    inventoryStatus: (data.inventoryStatus as PullConfirmationRecord['inventoryStatus']) ?? 'Pending',
    active: Boolean(data.active ?? true),
    notes: String(data.notes ?? ''),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

function mapScanVerification(id: string, data: Record<string, unknown>): ScanVerificationRecord {
  return {
    id,
    pickTicketId: String(data.pickTicketId ?? ''),
    lineId: String(data.lineId ?? ''),
    orderNumber: String(data.orderNumber ?? ''),
    expectedItem: String(data.expectedItem ?? ''),
    expectedLocation: String(data.expectedLocation ?? ''),
    scannedItem: String(data.scannedItem ?? ''),
    scannedLocation: String(data.scannedLocation ?? ''),
    itemMasterDescription: String(data.itemMasterDescription ?? ''),
    itemStatus: String(data.itemStatus ?? ''),
    locationStatus: String(data.locationStatus ?? ''),
    overallResult: String(data.overallResult ?? ''),
    notes: String(data.notes ?? ''),
    overrideUsed: Boolean(data.overrideUsed ?? false),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export async function savePullConfirmation(record: Omit<PullConfirmationRecord, 'id' | 'createdAt'>) {
  const db = getFirestoreDb();
  await addDoc(collection(db, PULL_CONFIRMATIONS_COLLECTION), {
    ...record,
    item: normalizeItem(record.item),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveScanVerification(record: Omit<ScanVerificationRecord, 'id' | 'createdAt'>) {
  const db = getFirestoreDb();
  await addDoc(collection(db, SCAN_VERIFICATIONS_COLLECTION), {
    ...record,
    expectedItem: normalizeItem(record.expectedItem),
    scannedItem: normalizeItem(record.scannedItem),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listActivePullConfirmations(item: string) {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem) {
    return [];
  }

  const db = getFirestoreDb();
  const snapshot = await getDocs(
    query(
      collection(db, PULL_CONFIRMATIONS_COLLECTION),
      where('item', '==', normalizedItem),
      where('active', '==', true),
    ),
  );

  return snapshot.docs
    .map((itemDoc) => mapPullConfirmation(itemDoc.id, itemDoc.data()))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
}

export async function listRecentScanVerifications(item: string) {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem) {
    return [];
  }

  const db = getFirestoreDb();
  const [expectedSnapshot, scannedSnapshot] = await Promise.all([
    getDocs(query(collection(db, SCAN_VERIFICATIONS_COLLECTION), where('expectedItem', '==', normalizedItem))),
    getDocs(query(collection(db, SCAN_VERIFICATIONS_COLLECTION), where('scannedItem', '==', normalizedItem))),
  ]);

  const unique = new Map<string, ScanVerificationRecord>();

  [...expectedSnapshot.docs, ...scannedSnapshot.docs].forEach((itemDoc) => {
    unique.set(itemDoc.id, mapScanVerification(itemDoc.id, itemDoc.data()));
  });

  return [...unique.values()]
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
    .slice(0, 12);
}

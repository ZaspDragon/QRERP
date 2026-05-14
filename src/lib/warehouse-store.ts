import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type {
  ActivityLogRecord,
  ActorIdentity,
  CycleCountLine,
  CycleCountSession,
  EmployeeRecord,
  LocationLabelRecord,
  OrderPickingSession,
  PullConfirmationRecord,
  PutAwayLine,
  PutAwaySession,
  QrScanRecord,
  ReceivingLabelDraft,
  ReceivingLabelRecord,
  ScanVerificationRecord,
  UserProfile,
} from '../types';
import { createId } from '../utils/qr';
import { getFirestoreDb } from './firebase';

export const COLLECTIONS = {
  users: 'users',
  itemMaster: 'itemMaster',
  receivingLabels: 'receivingLabels',
  locations: 'locations',
  qrScans: 'qrScans',
  scanVerifications: 'scanVerifications',
  pullConfirmations: 'pullConfirmations',
  putAwayLogs: 'putAwayLogs',
  cycleCountSessions: 'cycleCountSessions',
  orderPickingSessions: 'orderPickingSessions',
  activityLogs: 'activityLogs',
  employees: 'employees',
} as const;

function nowIso() {
  return new Date().toISOString();
}

export function toIsoString(value: unknown) {
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

function sortByNewest<T extends { createdAt?: string; updatedAt?: string }>(rows: T[]) {
  return [...rows].sort((left, right) => (right.updatedAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.createdAt ?? ''));
}

function mapUserProfile(id: string, data: DocumentData): UserProfile {
  return {
    uid: id,
    name: String(data.name ?? data.displayName ?? ''),
    email: String(data.email ?? ''),
    role: (data.role as UserProfile['role']) ?? 'picker',
    active: Boolean(data.active ?? true),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function mapEmployeeRecord(id: string, data: DocumentData): EmployeeRecord {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: String(data.role ?? ''),
    active: Boolean(data.active ?? true),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

function mapPutAwayLine(data: Record<string, unknown>, index: number): PutAwayLine {
  return {
    id: String(data.id ?? createId(`put-line-${index + 1}`)),
    lineNumber: Number(data.lineNumber ?? data.line ?? index + 1),
    item: String(data.item ?? ''),
    description: String(data.description ?? ''),
    qty: Number(data.qty ?? 0),
    location: String(data.location ?? ''),
    notes: String(data.notes ?? ''),
    scannedItemRaw: String(data.scannedItemRaw ?? ''),
    scannedLocationRaw: String(data.scannedLocationRaw ?? ''),
  };
}

function mapCycleLine(data: Record<string, unknown>, index: number): CycleCountLine {
  return {
    id: String(data.id ?? createId(`cycle-line-${index + 1}`)),
    lineNumber: Number(data.lineNumber ?? data.line ?? index + 1),
    item: String(data.item ?? ''),
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    systemQty: Number(data.systemQty ?? 0),
    countedQty: Number(data.countedQty ?? 0),
    variance: Number(data.variance ?? 0),
    reason: String(data.reason ?? ''),
    warning: String(data.warning ?? ''),
    done: Boolean(data.done ?? false),
  };
}

export function mapPutAwaySession(id: string, data: DocumentData): PutAwaySession {
  return {
    id,
    worker: String(data.worker ?? ''),
    date: String(data.date ?? ''),
    docNumber: String(data.docNumber ?? ''),
    receivedTime: String(data.receivedTime ?? ''),
    stockedTime: String(data.stockedTime ?? ''),
    dockToStockMinutes: Number(data.dockToStockMinutes ?? 0),
    lines: Array.isArray(data.lines) ? data.lines.map((line, index) => mapPutAwayLine(line as Record<string, unknown>, index)) : [],
    lineCount: Number(data.lineCount ?? 0),
    totalQty: Number(data.totalQty ?? 0),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapCycleCountSession(id: string, data: DocumentData): CycleCountSession {
  return {
    id,
    counter: String(data.counter ?? ''),
    date: String(data.date ?? ''),
    countId: String(data.countId ?? ''),
    activeLocation: String(data.activeLocation ?? ''),
    lines: Array.isArray(data.lines) ? data.lines.map((line, index) => mapCycleLine(line as Record<string, unknown>, index)) : [],
    lineCount: Number(data.lineCount ?? 0),
    varianceLines: Number(data.varianceLines ?? 0),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapOrderPickingSession(id: string, data: DocumentData): OrderPickingSession {
  return {
    id,
    picker: String(data.picker ?? ''),
    date: String(data.date ?? ''),
    orderNumber: String(data.orderNumber ?? ''),
    lines: Array.isArray(data.lines) ? (data.lines as OrderPickingSession['lines']) : [],
    lineCount: Number(data.lineCount ?? 0),
    totalPicked: Number(data.totalPicked ?? 0),
    issueLines: Number(data.issueLines ?? 0),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapActivityLogRecord(id: string, data: DocumentData): ActivityLogRecord {
  return {
    id,
    type: String(data.type ?? ''),
    employee: String(data.employee ?? ''),
    date: String(data.date ?? ''),
    item: String(data.item ?? ''),
    description: String(data.description ?? ''),
    qty: Number(data.qty ?? 0),
    systemQty: Number(data.systemQty ?? 0),
    countedQty: Number(data.countedQty ?? 0),
    requiredQty: Number(data.requiredQty ?? 0),
    pickedQty: Number(data.pickedQty ?? 0),
    remainingQty: Number(data.remainingQty ?? 0),
    availableQty: Number(data.availableQty ?? 0),
    variance: Number(data.variance ?? 0),
    location: String(data.location ?? ''),
    uom: String(data.uom ?? ''),
    documentNumber: String(data.documentNumber ?? ''),
    receivedTime: String(data.receivedTime ?? ''),
    stockedTime: String(data.stockedTime ?? ''),
    dockToStockMinutes: Number(data.dockToStockMinutes ?? 0),
    status: String(data.status ?? ''),
    reason: String(data.reason ?? ''),
    notes: String(data.notes ?? ''),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapPullConfirmationRecord(id: string, data: DocumentData): PullConfirmationRecord {
  return {
    id,
    documentNumber: String(data.documentNumber ?? data.orderNumber ?? ''),
    pickTicketId: String(data.pickTicketId ?? ''),
    lineId: String(data.lineId ?? ''),
    item: String(data.item ?? ''),
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    pickedQty: Number(data.pickedQty ?? 0),
    inventoryStatus: (data.inventoryStatus as PullConfirmationRecord['inventoryStatus']) ?? 'Pending',
    active: Boolean(data.active ?? true),
    notes: String(data.notes ?? ''),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    updatedByEmail: String(data.updatedByEmail ?? ''),
  };
}

export function mapScanVerificationRecord(id: string, data: DocumentData): ScanVerificationRecord {
  return {
    id,
    documentNumber: String(data.documentNumber ?? data.orderNumber ?? ''),
    pickTicketId: String(data.pickTicketId ?? ''),
    lineId: String(data.lineId ?? ''),
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

export function mapQrScanRecord(id: string, data: DocumentData): QrScanRecord {
  return {
    id,
    rawValue: String(data.rawValue ?? ''),
    parsedType: (data.parsedType as QrScanRecord['parsedType']) ?? 'unknown',
    item: String(data.item ?? ''),
    location: String(data.location ?? ''),
    description: String(data.description ?? ''),
    qty: Number(data.qty ?? 0),
    sourceModule: String(data.sourceModule ?? ''),
    documentNumber: String(data.documentNumber ?? ''),
    sessionId: String(data.sessionId ?? ''),
    expectedItem: String(data.expectedItem ?? ''),
    expectedLocation: String(data.expectedLocation ?? ''),
    result: String(data.result ?? ''),
    scanSource: (data.scanSource as QrScanRecord['scanSource']) ?? 'manual',
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapReceivingLabelRecord(id: string, data: DocumentData): ReceivingLabelRecord {
  return {
    id,
    lineId: String(data.lineId ?? id),
    docType: String(data.docType ?? ''),
    docNumber: String(data.docNumber ?? ''),
    branch: String(data.branch ?? ''),
    item: String(data.item ?? ''),
    qty: Number(data.qty ?? 0),
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    uom: String(data.uom ?? ''),
    sourceFile: String(data.sourceFile ?? ''),
    qrPayload: data.qrPayload as ReceivingLabelRecord['qrPayload'],
    active: Boolean(data.active ?? true),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function mapLocationLabelRecord(id: string, data: DocumentData): LocationLabelRecord {
  return {
    id,
    location: String(data.location ?? id),
    qrValue: String(data.qrValue ?? ''),
    aisle: String(data.aisle ?? ''),
    bay: String(data.bay ?? ''),
    level: String(data.level ?? ''),
    active: Boolean(data.active ?? true),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    createdBy: String(data.createdBy ?? ''),
    createdByEmail: String(data.createdByEmail ?? ''),
  };
}

export function watchCollection<T>(
  collectionName: string,
  mapper: (id: string, data: DocumentData) => T,
  onUpdate: (rows: T[]) => void,
  rowLimit = 250,
) {
  const db = getFirestoreDb();
  const collectionQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(rowLimit));

  return onSnapshot(collectionQuery, (snapshot) => {
    const rows = snapshot.docs.map((itemDoc) => mapper(itemDoc.id, itemDoc.data()));
    onUpdate(sortByNewest(rows as Array<{ createdAt?: string; updatedAt?: string }>) as T[]);
  });
}

export function watchUserProfile(uid: string, onUpdate: (profile: UserProfile | null) => void) {
  const db = getFirestoreDb();
  return onSnapshot(doc(db, COLLECTIONS.users, uid), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    onUpdate(mapUserProfile(snapshot.id, snapshot.data()));
  });
}

export async function ensureUserProfile(user: User) {
  const db = getFirestoreDb();
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  const existing = await getDoc(userRef);
  const now = nowIso();

  if (!existing.exists()) {
    const fallbackName = user.displayName || user.email?.split('@')[0] || 'Warehouse User';

    await setDoc(userRef, {
      uid: user.uid,
      name: fallbackName,
      email: user.email ?? '',
      role: 'picker',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function saveEmployee(input: { name: string; email: string; role: string }, actor: ActorIdentity) {
  const db = getFirestoreDb();
  const employeeRef = doc(collection(db, COLLECTIONS.employees));
  const now = nowIso();

  await setDoc(employeeRef, {
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role.trim(),
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    createdByEmail: actor.email,
  });
}

export async function setEmployeeActive(employeeId: string, active: boolean) {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTIONS.employees, employeeId), {
    active,
    updatedAt: nowIso(),
  });
}

export async function saveReceivingLabels(rows: ReceivingLabelDraft[], actor: ActorIdentity) {
  if (!rows.length) {
    return 0;
  }

  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const now = nowIso();

  rows.forEach((row) => {
    batch.set(
      doc(db, COLLECTIONS.receivingLabels, row.lineId),
      {
        ...row,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.uid,
        createdByEmail: actor.email,
      },
      { merge: true },
    );
  });

  await batch.commit();
  return rows.length;
}

export async function saveLocationLabels(rows: LocationLabelRecord[], actor: ActorIdentity) {
  if (!rows.length) {
    return 0;
  }

  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const now = nowIso();

  rows.forEach((row) => {
    batch.set(
      doc(db, COLLECTIONS.locations, row.location),
      {
        ...row,
        id: row.location,
        active: true,
        createdAt: row.createdAt ?? now,
        updatedAt: now,
        createdBy: actor.uid,
        createdByEmail: actor.email,
      },
      { merge: true },
    );
  });

  await batch.commit();
  return rows.length;
}

async function saveActivityLogs(logs: Omit<ActivityLogRecord, 'id'>[]) {
  if (!logs.length) {
    return;
  }

  const db = getFirestoreDb();
  const batch = writeBatch(db);

  logs.forEach((log) => {
    batch.set(doc(collection(db, COLLECTIONS.activityLogs)), log);
  });

  await batch.commit();
}

function buildPutAwayActivityLogs(session: PutAwaySession): Omit<ActivityLogRecord, 'id'>[] {
  return session.lines.map((line) => ({
    type: 'putaway',
    employee: session.worker,
    date: session.date,
    item: line.item,
    description: line.description,
    qty: line.qty,
    systemQty: 0,
    countedQty: 0,
    requiredQty: 0,
    pickedQty: 0,
    remainingQty: 0,
    availableQty: 0,
    variance: 0,
    location: line.location,
    uom: '',
    documentNumber: session.docNumber,
    receivedTime: session.receivedTime,
    stockedTime: session.stockedTime,
    dockToStockMinutes: session.dockToStockMinutes,
    status: '',
    reason: '',
    notes: line.notes,
    createdAt: nowIso(),
    createdBy: session.createdBy,
    createdByEmail: session.createdByEmail,
  }));
}

function buildCycleActivityLogs(session: CycleCountSession): Omit<ActivityLogRecord, 'id'>[] {
  return session.lines.map((line) => ({
    type: 'cycleCount',
    employee: session.counter,
    date: session.date,
    item: line.item,
    description: line.description,
    qty: line.countedQty,
    systemQty: line.systemQty,
    countedQty: line.countedQty,
    requiredQty: 0,
    pickedQty: 0,
    remainingQty: 0,
    availableQty: 0,
    variance: line.variance,
    location: line.location,
    uom: '',
    documentNumber: session.countId,
    receivedTime: '',
    stockedTime: '',
    dockToStockMinutes: 0,
    status: line.done ? 'Count Verified' : 'Needs Review',
    reason: line.reason,
    notes: line.warning,
    createdAt: nowIso(),
    createdBy: session.createdBy,
    createdByEmail: session.createdByEmail,
  }));
}

function buildPickingActivityLogs(session: OrderPickingSession): Omit<ActivityLogRecord, 'id'>[] {
  return session.lines
    .filter((line) => line.pickedQty > 0 || line.overrideNotes || line.scannedItem || line.scannedLocation)
    .map((line) => ({
      type: 'orderPicking',
      employee: session.picker,
      date: session.date,
      item: line.expectedItem,
      description: line.itemMasterDescription || line.expectedDescription,
      qty: line.pickedQty,
      systemQty: 0,
      countedQty: 0,
      requiredQty: line.requiredQty,
      pickedQty: line.pickedQty,
      remainingQty: line.remainingQty,
      availableQty: line.availableQty,
      variance: 0,
      location: line.scannedLocation || line.fromSlot,
      uom: line.uom,
      documentNumber: session.orderNumber,
      receivedTime: '',
      stockedTime: '',
      dockToStockMinutes: 0,
      status: line.status,
      reason: line.inventoryStatus,
      notes: line.overrideNotes,
      createdAt: nowIso(),
      createdBy: session.createdBy,
      createdByEmail: session.createdByEmail,
    }));
}

export async function savePutAwaySession(session: PutAwaySession) {
  const db = getFirestoreDb();
  const sessionId = session.id || createId('putaway');

  await setDoc(doc(db, COLLECTIONS.putAwayLogs, sessionId), {
    ...session,
    id: sessionId,
    createdAt: session.createdAt ?? nowIso(),
  });

  await saveActivityLogs(buildPutAwayActivityLogs({ ...session, id: sessionId }));
  return sessionId;
}

export async function saveCycleCountSession(session: CycleCountSession) {
  const db = getFirestoreDb();
  const sessionId = session.id || createId('cycle');

  await setDoc(doc(db, COLLECTIONS.cycleCountSessions, sessionId), {
    ...session,
    id: sessionId,
    createdAt: session.createdAt ?? nowIso(),
  });

  await saveActivityLogs(buildCycleActivityLogs({ ...session, id: sessionId }));
  return sessionId;
}

export async function saveOrderPickingSession(session: OrderPickingSession) {
  const db = getFirestoreDb();
  const sessionId = session.id || createId('pick');

  await setDoc(doc(db, COLLECTIONS.orderPickingSessions, sessionId), {
    ...session,
    id: sessionId,
    createdAt: session.createdAt ?? nowIso(),
  });

  await saveActivityLogs(buildPickingActivityLogs({ ...session, id: sessionId }));
  return sessionId;
}

export async function saveScanVerification(record: Omit<ScanVerificationRecord, 'id'>) {
  const db = getFirestoreDb();
  const verificationId = createId('verify');

  await setDoc(doc(db, COLLECTIONS.scanVerifications, verificationId), {
    ...record,
    createdAt: record.createdAt ?? nowIso(),
  });

  return verificationId;
}

export async function recordQrScan(record: Omit<QrScanRecord, 'id'>) {
  const db = getFirestoreDb();
  const scanId = createId('scan');

  await setDoc(doc(db, COLLECTIONS.qrScans, scanId), {
    ...record,
    createdAt: record.createdAt ?? nowIso(),
  });

  return scanId;
}

export async function upsertPullConfirmation(record: PullConfirmationRecord) {
  const db = getFirestoreDb();
  const ref = doc(db, COLLECTIONS.pullConfirmations, record.id);
  const existing = await getDoc(ref);
  const now = nowIso();

  await setDoc(
    ref,
    {
      ...record,
      createdAt: existing.exists() ? toIsoString(existing.data().createdAt) ?? record.createdAt ?? now : record.createdAt ?? now,
      createdBy: existing.exists() ? String(existing.data().createdBy ?? record.createdBy) : record.createdBy,
      createdByEmail: existing.exists() ? String(existing.data().createdByEmail ?? record.createdByEmail) : record.createdByEmail,
      updatedAt: now,
      updatedBy: record.updatedBy,
      updatedByEmail: record.updatedByEmail,
    },
    { merge: true },
  );
}

export async function markPullConfirmationResolved(id: string, actor: ActorIdentity) {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTIONS.pullConfirmations, id), {
    active: false,
    inventoryStatus: '✔️ Resolved',
    updatedAt: nowIso(),
    updatedBy: actor.name,
    updatedByEmail: actor.email,
  });
}

async function listByField<T>(
  collectionName: string,
  field: string,
  value: string,
  mapper: (id: string, data: DocumentData) => T,
) {
  if (!value.trim()) {
    return [];
  }

  const db = getFirestoreDb();
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', value.trim())));
  return snapshot.docs.map((itemDoc) => mapper(itemDoc.id, itemDoc.data()));
}

export async function listPullConfirmationsByItem(item: string) {
  const rows = await listByField(COLLECTIONS.pullConfirmations, 'item', item, mapPullConfirmationRecord);
  return sortByNewest(rows);
}

export async function listPullConfirmationsByLocation(location: string) {
  const rows = await listByField(COLLECTIONS.pullConfirmations, 'location', location.trim().toUpperCase(), mapPullConfirmationRecord);
  return sortByNewest(rows);
}

export async function listPullConfirmationsByDocument(documentNumber: string) {
  const rows = await listByField(COLLECTIONS.pullConfirmations, 'documentNumber', documentNumber.trim(), mapPullConfirmationRecord);
  return sortByNewest(rows);
}

export async function listRecentScanVerificationsByItem(item: string) {
  const [expectedRows, scannedRows] = await Promise.all([
    listByField(COLLECTIONS.scanVerifications, 'expectedItem', item, mapScanVerificationRecord),
    listByField(COLLECTIONS.scanVerifications, 'scannedItem', item, mapScanVerificationRecord),
  ]);

  const unique = new Map<string, ScanVerificationRecord>();
  [...expectedRows, ...scannedRows].forEach((row) => unique.set(row.id, row));
  return sortByNewest([...unique.values()]).slice(0, 20);
}

export async function listRecentScanVerificationsByLocation(location: string) {
  const [expectedRows, scannedRows] = await Promise.all([
    listByField(COLLECTIONS.scanVerifications, 'expectedLocation', location.trim().toUpperCase(), mapScanVerificationRecord),
    listByField(COLLECTIONS.scanVerifications, 'scannedLocation', location.trim().toUpperCase(), mapScanVerificationRecord),
  ]);

  const unique = new Map<string, ScanVerificationRecord>();
  [...expectedRows, ...scannedRows].forEach((row) => unique.set(row.id, row));
  return sortByNewest([...unique.values()]).slice(0, 20);
}

export async function listRecentScanVerificationsByDocument(documentNumber: string) {
  const rows = await listByField(COLLECTIONS.scanVerifications, 'documentNumber', documentNumber.trim(), mapScanVerificationRecord);
  return sortByNewest(rows).slice(0, 20);
}

export async function listRecentQrScansByItem(item: string) {
  const rows = await listByField(COLLECTIONS.qrScans, 'item', item, mapQrScanRecord);
  return sortByNewest(rows).slice(0, 20);
}

export async function listRecentQrScansByLocation(location: string) {
  const rows = await listByField(COLLECTIONS.qrScans, 'location', location.trim().toUpperCase(), mapQrScanRecord);
  return sortByNewest(rows).slice(0, 20);
}

export async function listRecentQrScansByDocument(documentNumber: string) {
  const rows = await listByField(COLLECTIONS.qrScans, 'documentNumber', documentNumber.trim(), mapQrScanRecord);
  return sortByNewest(rows).slice(0, 20);
}

export function downloadCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length) {
    return;
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

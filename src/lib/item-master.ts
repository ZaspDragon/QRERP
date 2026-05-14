import { collection, doc, documentId, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import type { ActorIdentity, ItemMasterImportRow, ItemMasterRecord } from '../types';
import { buildItemLabelPayload, normalizeItemNumber } from '../utils/qr';
import { getFirestoreDb } from './firebase';
import { detectHeaderRow, getCellValue, parseNumberLike, readFirstWorksheetRows } from './spreadsheet';

const ITEM_MASTER_SOURCE_FILE = 'Item Availability.xlsx';
const ITEM_MASTER_COLLECTION = 'itemMaster';

const itemMasterAliases = {
  item: ['item', 'item#', 'itemnumber'],
  description: ['description'],
  vendorDescription: ['vendordescription', 'packinglistdescription'],
  availableQty: ['availableqty', 'qtyavailable'],
  defaultLocation: ['location', 'defaultlocation'],
  binLocation: ['bin', 'binloc', 'binlocation'],
  uom: ['uom', 'um'],
  category: ['category'],
  itemType: ['type', 'itemtype'],
  websiteUrl: ['websiteurl', 'url'],
} as const;

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
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

function mapFirestoreRecord(id: string, data: Record<string, unknown>): ItemMasterRecord {
  const item = String(data.item ?? id);
  const description = String(data.description ?? '');
  const defaultLocation = String(data.defaultLocation ?? '');
  const binLocation = String(data.binLocation ?? '');
  const uom = String(data.uom ?? '');

  return {
    id,
    rowNumber: 0,
    item,
    description,
    vendorDescription: String(data.vendorDescription ?? ''),
    availableQty: parseNumberLike(String(data.availableQty ?? 0)),
    defaultLocation,
    binLocation,
    uom,
    category: String(data.category ?? ''),
    itemType: String(data.itemType ?? ''),
    websiteUrl: String(data.websiteUrl ?? ''),
    qrPayload:
      (data.qrPayload as ItemMasterRecord['qrPayload'] | undefined) ??
      buildItemLabelPayload({
        item,
        description,
        location: defaultLocation || binLocation,
        uom,
        source: ITEM_MASTER_SOURCE_FILE,
      }),
    sourceFile: String(data.sourceFile ?? ITEM_MASTER_SOURCE_FILE),
    active: Boolean(data.active ?? true),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: String(data.updatedBy ?? ''),
    updatedByEmail: String(data.updatedByEmail ?? ''),
  };
}

function buildExportRows(records: ItemMasterRecord[]) {
  return records.map((record) => ({
    'Item #': record.item,
    Description: record.description,
    'Vendor Description': record.vendorDescription,
    'Available Qty': record.availableQty,
    Location: record.defaultLocation,
    Bin: record.binLocation,
    UOM: record.uom,
    Category: record.category,
    Type: record.itemType,
    'Website URL': record.websiteUrl,
    Active: record.active ? 'TRUE' : 'FALSE',
    'Updated By': record.updatedBy,
    'Updated By Email': record.updatedByEmail,
    'Updated At': record.updatedAt ?? '',
    'Created At': record.createdAt ?? '',
    'QR Payload': JSON.stringify(record.qrPayload),
  }));
}

function downloadBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export async function parseItemMasterFile(file: File) {
  const { rows, sheetName } = await readFirstWorksheetRows(file);
  const detected = detectHeaderRow(rows, itemMasterAliases, ['item']);

  const parsedRows = rows
    .slice(detected.headerRowIndex + 1)
    .map((row, rowOffset) => {
      const item = normalizeItemNumber(getCellValue(row, detected.columnIndexByKey, 'item'));
      const description = getCellValue(row, detected.columnIndexByKey, 'description');
      const vendorDescription = getCellValue(row, detected.columnIndexByKey, 'vendorDescription');
      const defaultLocation = getCellValue(row, detected.columnIndexByKey, 'defaultLocation');
      const binLocation = getCellValue(row, detected.columnIndexByKey, 'binLocation');
      const uom = getCellValue(row, detected.columnIndexByKey, 'uom');
      const resolvedDescription = description || vendorDescription;

      if (!item) {
        return null;
      }

      return {
        rowNumber: detected.headerRowIndex + rowOffset + 2,
        item,
        description: resolvedDescription,
        vendorDescription,
        availableQty: parseNumberLike(getCellValue(row, detected.columnIndexByKey, 'availableQty')),
        defaultLocation,
        binLocation,
        uom,
        category: getCellValue(row, detected.columnIndexByKey, 'category'),
        itemType: getCellValue(row, detected.columnIndexByKey, 'itemType'),
        websiteUrl: getCellValue(row, detected.columnIndexByKey, 'websiteUrl'),
        qrPayload: buildItemLabelPayload({
          item,
          description: resolvedDescription,
          location: defaultLocation || binLocation,
          uom,
          source: ITEM_MASTER_SOURCE_FILE,
        }),
        sourceFile: ITEM_MASTER_SOURCE_FILE,
        active: true,
      } satisfies ItemMasterImportRow;
    })
    .filter((row) => row !== null) as ItemMasterImportRow[];

  if (!parsedRows.length) {
    throw new Error('No item rows were found after the detected header row.');
  }

  return {
    fileName: file.name,
    sheetName,
    headerRowIndex: detected.headerRowIndex,
    detectedHeaders: detected.detectedHeaders,
    rows: parsedRows,
  };
}

export async function listItemMasterRecords() {
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, ITEM_MASTER_COLLECTION));

  return snapshot.docs
    .map((itemDoc) => mapFirestoreRecord(itemDoc.id, itemDoc.data()))
    .sort((left, right) => left.item.localeCompare(right.item, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function getItemMasterRecord(item: string) {
  const normalizedItem = normalizeItemNumber(item);
  if (!normalizedItem) {
    return null;
  }

  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, ITEM_MASTER_COLLECTION, normalizedItem));

  if (!snapshot.exists()) {
    return null;
  }

  return mapFirestoreRecord(snapshot.id, snapshot.data());
}

export async function listItemMasterRecordsByLocation(location: string) {
  const normalizedLocation = location.trim().toUpperCase();

  if (!normalizedLocation) {
    return [];
  }

  const db = getFirestoreDb();
  const [defaultLocationSnapshot, binLocationSnapshot] = await Promise.all([
    getDocs(query(collection(db, ITEM_MASTER_COLLECTION), where('defaultLocation', '==', normalizedLocation))),
    getDocs(query(collection(db, ITEM_MASTER_COLLECTION), where('binLocation', '==', normalizedLocation))),
  ]);

  const unique = new Map<string, ItemMasterRecord>();

  [...defaultLocationSnapshot.docs, ...binLocationSnapshot.docs].forEach((itemDoc) => {
    unique.set(itemDoc.id, mapFirestoreRecord(itemDoc.id, itemDoc.data()));
  });

  return [...unique.values()].sort((left, right) => left.item.localeCompare(right.item, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function saveItemMasterRecords(rows: ItemMasterImportRow[], user: ActorIdentity) {
  if (!rows.length) {
    return 0;
  }

  const db = getFirestoreDb();
  const itemIds = [...new Set(rows.map((row) => normalizeItemNumber(row.item)).filter(Boolean))];
  const existingCreatedAt = new Map<string, string | undefined>();

  for (const idChunk of chunk(itemIds, 30)) {
    const snapshot = await getDocs(query(collection(db, ITEM_MASTER_COLLECTION), where(documentId(), 'in', idChunk)));
    snapshot.docs.forEach((itemDoc) => {
      existingCreatedAt.set(itemDoc.id, toIsoString(itemDoc.data().createdAt));
    });
  }

  for (const rowChunk of chunk(rows, 400)) {
    const batch = writeBatch(db);

    rowChunk.forEach((row) => {
      const itemId = normalizeItemNumber(row.item);
      const itemRef = doc(db, ITEM_MASTER_COLLECTION, itemId);
      const now = new Date().toISOString();

      batch.set(
        itemRef,
        {
          item: itemId,
          description: row.description,
          vendorDescription: row.vendorDescription,
          availableQty: row.availableQty,
          defaultLocation: row.defaultLocation.toUpperCase(),
          binLocation: row.binLocation.toUpperCase(),
          uom: row.uom,
          category: row.category,
          itemType: row.itemType,
          websiteUrl: row.websiteUrl,
          qrPayload: row.qrPayload,
          sourceFile: ITEM_MASTER_SOURCE_FILE,
          active: true,
          createdAt: existingCreatedAt.get(itemId) ?? now,
          updatedAt: now,
          updatedBy: user.name,
          updatedByEmail: user.email,
        },
        { merge: true },
      );
    });

    await batch.commit();
  }

  return rows.length;
}

export async function exportItemMasterFile(format: 'xlsx' | 'csv') {
  const records = await listItemMasterRecords();

  if (!records.length) {
    throw new Error('No item master records are available to export.');
  }

  const sheet = XLSX.utils.json_to_sheet(buildExportRows(records));

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob('item-master-export.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    return records.length;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Item Master');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob('item-master-export.xlsx', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  return records.length;
}

export async function upsertSingleItemMasterRecord(record: ItemMasterRecord, user: ActorIdentity) {
  const db = getFirestoreDb();
  const now = new Date().toISOString();

  await setDoc(
    doc(db, ITEM_MASTER_COLLECTION, normalizeItemNumber(record.item)),
    {
      ...record,
      item: normalizeItemNumber(record.item),
      createdAt: record.createdAt ?? now,
      updatedAt: now,
      updatedBy: user.name,
      updatedByEmail: user.email,
    },
    { merge: true },
  );
}

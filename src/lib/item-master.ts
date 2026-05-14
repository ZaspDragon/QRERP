import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { getFirestoreDb } from './firebase';
import { detectHeaderRow, getCellValue, parseNumberLike, readFirstWorksheetRows } from './spreadsheet';
import type { Employee, ItemLabelPayload, ItemMasterImportRow, ItemMasterRecord } from '../types';

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

function normalizeItemId(value: string) {
  return value.trim();
}

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

function buildItemLabelPayload(row: {
  item: string;
  description: string;
  defaultLocation: string;
  binLocation: string;
  uom: string;
}): ItemLabelPayload {
  return {
    type: 'item_label',
    item: row.item,
    description: row.description,
    location: row.defaultLocation || row.binLocation,
    uom: row.uom,
    source: ITEM_MASTER_SOURCE_FILE,
  };
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
    qrPayload: (data.qrPayload as ItemLabelPayload | undefined) ?? buildItemLabelPayload({ item, description, defaultLocation, binLocation, uom }),
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
      const item = normalizeItemId(getCellValue(row, detected.columnIndexByKey, 'item'));
      const description = getCellValue(row, detected.columnIndexByKey, 'description');
      const vendorDescription = getCellValue(row, detected.columnIndexByKey, 'vendorDescription');
      const defaultLocation = getCellValue(row, detected.columnIndexByKey, 'defaultLocation');
      const binLocation = getCellValue(row, detected.columnIndexByKey, 'binLocation');
      const uom = getCellValue(row, detected.columnIndexByKey, 'uom');
      const resolvedDescription = description || vendorDescription;

      if (!item) {
        return null;
      }

      const previewRow: ItemMasterImportRow = {
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
          defaultLocation,
          binLocation,
          uom,
        }),
        sourceFile: ITEM_MASTER_SOURCE_FILE,
        active: true,
      };

      return previewRow;
    })
    .filter((row): row is ItemMasterImportRow => Boolean(row));

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
  const normalizedItem = normalizeItemId(item);
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

export async function saveItemMasterRecords(rows: ItemMasterImportRow[], user: Employee) {
  if (!rows.length) {
    return 0;
  }

  const db = getFirestoreDb();
  const itemIds = [...new Set(rows.map((row) => normalizeItemId(row.item)).filter(Boolean))];
  const existingCreatedAt = new Map<string, unknown>();

  for (const idChunk of chunk(itemIds, 30)) {
    const snapshot = await getDocs(query(collection(db, ITEM_MASTER_COLLECTION), where(documentId(), 'in', idChunk)));
    snapshot.docs.forEach((itemDoc) => {
      existingCreatedAt.set(itemDoc.id, itemDoc.data().createdAt);
    });
  }

  for (const rowChunk of chunk(rows, 400)) {
    const batch = writeBatch(db);

    rowChunk.forEach((row) => {
      const itemId = normalizeItemId(row.item);
      const itemRef = doc(db, ITEM_MASTER_COLLECTION, itemId);

      batch.set(
        itemRef,
        {
          item: itemId,
          description: row.description,
          vendorDescription: row.vendorDescription,
          availableQty: row.availableQty,
          defaultLocation: row.defaultLocation,
          binLocation: row.binLocation,
          uom: row.uom,
          category: row.category,
          itemType: row.itemType,
          websiteUrl: row.websiteUrl,
          qrPayload: row.qrPayload,
          sourceFile: ITEM_MASTER_SOURCE_FILE,
          active: true,
          createdAt: existingCreatedAt.get(itemId) ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
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

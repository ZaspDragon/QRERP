import type { ReceivingLabelDraft } from '../types';
import { buildItemLabelPayload, createId, normalizeItemNumber, normalizeLocation } from '../utils/qr';
import { parseNumberLike } from './spreadsheet';
import * as XLSX from 'xlsx';

const DOC_TYPES = ['PO', 'SPO', 'SXFR', 'XFR'];

function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/\$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanKey(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function looksLikeItemNumber(value: string) {
  return /^\d{5,8}$/.test(cleanText(value));
}

function rowIsBlank(row: unknown[]) {
  return row.every((cell) => !cleanText(cell));
}

function isDocType(value: string) {
  return DOC_TYPES.includes(cleanText(value).toUpperCase());
}

export function normalizeDocNumber(value: string, defaultType = 'PO') {
  let text = cleanText(value).toUpperCase();
  text = text.replace(/P\.O\./g, 'PO');
  text = text.replace(/[^A-Z0-9-]/g, '');

  if (!text) {
    return '';
  }

  if (/^(PO|SPO|SXFR|XFR)/.test(text)) {
    return text;
  }

  return `${defaultType}${text}`;
}

export function formatDocDisplay(label: Pick<ReceivingLabelDraft, 'docType' | 'docNumber'>) {
  const type = cleanText(label.docType).toUpperCase();
  const number = cleanText(label.docNumber).toUpperCase();

  if (!number && type) {
    return type;
  }

  if (!type) {
    return number;
  }

  if (number.startsWith(type)) {
    return number;
  }

  return `${type}${number}`;
}

export function makeReceivingLabelId(docType: string, docNumber: string, item: string, location = '') {
  return `${docType || 'DOC'}-${docNumber || 'NODOC'}-${item || 'NOITEM'}-${location || 'NOLOC'}-${createId('LBL')}`
    .replace(/\s+/g, '')
    .toUpperCase();
}

function buildReceivingLabel(row: {
  docType: string;
  docNumber: string;
  branch: string;
  item: string;
  qty: number;
  description: string;
  location: string;
  uom: string;
  sourceFile: string;
}) {
  const item = normalizeItemNumber(row.item);
  const description = cleanText(row.description);
  const location = normalizeLocation(row.location);
  const qrPayload = buildItemLabelPayload({
    item,
    description,
    location,
    uom: row.uom,
    source: row.sourceFile || 'receivingLabels',
    qty: row.qty,
  });

  return {
    lineId: makeReceivingLabelId(row.docType, row.docNumber, item, location),
    docType: row.docType,
    docNumber: normalizeDocNumber(row.docNumber, row.docType),
    branch: cleanText(row.branch).toUpperCase(),
    item,
    qty: row.qty,
    description,
    location,
    uom: cleanText(row.uom).toUpperCase(),
    sourceFile: row.sourceFile,
    qrPayload,
  } satisfies ReceivingLabelDraft;
}

function extractTopDocumentMeta(rows: string[][], defaults?: { docType?: string; docNumber?: string; branch?: string }) {
  const fallbackType = defaults?.docType || 'SPO';
  let docType = fallbackType;
  let docNumber = cleanText(defaults?.docNumber || '');
  let branch = cleanText(defaults?.branch || '');

  const topText = rows
    .slice(0, 25)
    .map((row) => row.map(cleanText).join(' '))
    .join(' ')
    .toUpperCase();

  const fullDocMatch = topText.match(/\b(SPO|SXFR|XFR|PO)[\s#:\-]*([0-9]{4,12})\b/i);
  if (!docNumber && fullDocMatch) {
    docType = fullDocMatch[1].toUpperCase();
    docNumber = `${docType}${fullDocMatch[2]}`;
  }

  const branchMatch = topText.match(/\bBRANCH\s*[-:#]?\s*([A-Z]{2}\d{2})\b/i);
  if (!branch && branchMatch) {
    branch = branchMatch[1].toUpperCase();
  }

  return {
    docType,
    docNumber: normalizeDocNumber(docNumber, docType),
    branch,
  };
}

function detectReceivingReportRows(rows: string[][], meta: { docType: string; docNumber: string; branch: string }, sourceFile: string) {
  const fixedRows: ReceivingLabelDraft[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const nextRow = rows[index + 1] || [];

    if (rowIsBlank(row)) {
      continue;
    }

    const lineNumber = cleanText(row[0]);
    const itemNumber = cleanText(row[4]);
    const description = cleanText(nextRow[0]);
    const location = cleanText(nextRow[6]);
    const qty = cleanText(nextRow[12]);
    const uom = cleanText(nextRow[13]);

    const isRealReceivingLine = /^\d{1,4}$/.test(lineNumber) && looksLikeItemNumber(itemNumber);

    if (!isRealReceivingLine) {
      continue;
    }

    fixedRows.push(
      buildReceivingLabel({
        docType: meta.docType,
        docNumber: meta.docNumber,
        branch: meta.branch,
        item: itemNumber,
        qty: qty ? parseNumberLike(qty) : 0,
        description,
        location,
        uom,
        sourceFile,
      }),
    );

    index += 1;
  }

  return fixedRows;
}

function findHeaderRow(rows: string[][]) {
  let bestIndex = 0;
  let bestScore = -1;

  rows.forEach((row, index) => {
    if (index > 70) {
      return;
    }

    const keys = row.map(cleanKey);
    let score = 0;

    if (keys.includes('item') || keys.includes('itemnumber') || keys.includes('itemno')) {
      score += 10;
    }
    if (keys.includes('description') || keys.includes('desc') || keys.includes('itemdescription')) {
      score += 10;
    }
    if (keys.includes('qty') || keys.includes('quantity') || keys.includes('qtyord')) {
      score += 5;
    }
    if (keys.includes('bin') || keys.includes('location') || keys.includes('loc')) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function mapHeaders(headers: string[]) {
  const map: Record<string, number> = {};

  headers.forEach((header, index) => {
    const key = cleanKey(header);

    if (['item', 'itemnumber', 'itemno', 'itemnum', 'itemid', 'sku'].includes(key)) {
      map.item = index;
    }
    if (['description', 'desc', 'itemdescription', 'productdescription', 'itemdesc', 'vendordescription'].includes(key)) {
      map.description = index;
    }
    if (['qty', 'quantity', 'qtyord', 'qtyordered', 'orderedqty', 'qtyreceived', 'receivedqty'].includes(key)) {
      map.qty = index;
    }
    if (['bin', 'location', 'loc', 'binlocation', 'putawaylocation'].includes(key)) {
      map.location = index;
    }
    if (['branch', 'warehouse', 'site', 'facility'].includes(key)) {
      map.branch = index;
    }
    if (['po', 'ponumber', 'spo', 'sponumber', 'sxfr', 'sxfrnumber', 'xfr', 'xfrnumber', 'documentnumber', 'docnumber'].includes(key)) {
      map.docNumber = index;
    }
    if (['type', 'doctype', 'documenttype'].includes(key)) {
      map.docType = index;
    }
    if (['uom', 'um'].includes(key)) {
      map.uom = index;
    }
  });

  return map;
}

function getCell(row: string[], index?: number) {
  if (index === undefined || index === null) {
    return '';
  }

  return cleanText(row[index]);
}

function readCleanTableRows(rows: string[][], meta: { docType: string; docNumber: string; branch: string }, sourceFile: string) {
  const headerIndex = findHeaderRow(rows);
  const headers = rows[headerIndex] || [];
  const map = mapHeaders(headers);
  const dataRows = rows.slice(headerIndex + 1);

  return dataRows
    .filter((row) => !rowIsBlank(row))
    .map((row) => {
      let docType = getCell(row, map.docType) || meta.docType || 'SPO';
      docType = cleanText(docType).toUpperCase();

      if (!isDocType(docType)) {
        docType = meta.docType || 'SPO';
      }

      const docNumber = normalizeDocNumber(getCell(row, map.docNumber) || meta.docNumber || '', docType);

      return buildReceivingLabel({
        docType,
        docNumber,
        branch: getCell(row, map.branch) || meta.branch || '',
        item: getCell(row, map.item),
        qty: parseNumberLike(getCell(row, map.qty)),
        description: getCell(row, map.description),
        location: getCell(row, map.location),
        uom: getCell(row, map.uom),
        sourceFile,
      });
    })
    .filter((row) => looksLikeItemNumber(row.item));
}

export async function parseReceivingLabelFile(file: File, defaults?: { docType?: string; docNumber?: string; branch?: string }) {
  const data = await file.arrayBuffer();

  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: false,
    raw: false,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const normalizedRows = rows.map((row) => row.map((cell) => cleanText(cell)));

  if (!normalizedRows.length) {
    throw new Error('The uploaded file does not contain any rows.');
  }

  const meta = extractTopDocumentMeta(normalizedRows, defaults);
  const receivingRows = detectReceivingReportRows(normalizedRows, meta, file.name);
  const parsedRows = receivingRows.length ? receivingRows : readCleanTableRows(normalizedRows, meta, file.name);

  if (!parsedRows.length) {
    throw new Error('No valid PO / SPO / SXFR / XFR lines were found in the uploaded file.');
  }

  return {
    fileName: file.name,
    rows: parsedRows,
    meta,
  };
}

export function parseBulkReceivingText(
  raw: string,
  defaults?: { docType?: string; docNumber?: string; branch?: string; uom?: string },
) {
  const text = raw.trim();

  if (!text) {
    return [];
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const parts = line.split(',').map((value) => cleanText(value));
      let docType = parts[0] || defaults?.docType || 'SPO';
      let docNumber = parts[1] || defaults?.docNumber || '';
      let branch = parts[2] || defaults?.branch || '';
      let item = parts[3] || '';
      let qty = parts[4] || '';
      let description = parts[5] || '';
      let location = parts[6] || '';
      let uom = parts[7] || defaults?.uom || '';

      docType = docType.toUpperCase();

      if (!isDocType(docType)) {
        uom = location || defaults?.uom || '';
        location = description;
        description = qty;
        qty = item;
        item = branch;
        branch = defaults?.branch || '';
        docNumber = docType;
        docType = defaults?.docType || 'SPO';
      }

      if (!item || !looksLikeItemNumber(item)) {
        return null;
      }

      return buildReceivingLabel({
        docType,
        docNumber,
        branch,
        item,
        qty: parseNumberLike(qty),
        description,
        location,
        uom,
        sourceFile: 'Bulk Paste',
      });
    })
    .filter((row): row is ReceivingLabelDraft => Boolean(row));
}

export function buildManualReceivingLabel(input: {
  docType: string;
  docNumber: string;
  branch: string;
  item: string;
  qty: number;
  description: string;
  location: string;
  uom: string;
  copies: number;
}) {
  const copies = Math.max(1, Number(input.copies || 1));

  return Array.from({ length: copies }, () =>
    buildReceivingLabel({
      docType: input.docType,
      docNumber: input.docNumber,
      branch: input.branch,
      item: input.item,
      qty: input.qty,
      description: input.description,
      location: input.location,
      uom: input.uom,
      sourceFile: 'Manual Entry',
    }),
  );
}

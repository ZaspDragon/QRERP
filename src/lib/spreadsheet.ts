import * as XLSX from 'xlsx';

export type HeaderAliasMap = Record<string, readonly string[]>;

export interface DetectedHeaderResult {
  headerRowIndex: number;
  columnIndexByKey: Record<string, number>;
  detectedHeaders: Record<string, string>;
}

export async function readFirstWorksheetRows(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('The uploaded workbook does not contain any worksheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  return {
    workbook,
    sheetName,
    rows: rows.map((row) => row.map((cell) => String(cell ?? '').trim())),
  };
}

export function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

export function parseNumberLike(value: string) {
  const normalized = value.replace(/,/g, '').trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function detectHeaderRow(rows: string[][], aliases: HeaderAliasMap, requiredKeys: string[] = []): DetectedHeaderResult {
  const normalizedAliasEntries = Object.entries(aliases).map(([key, values]) => [key, new Set(values.map(normalizeHeader))] as const);

  let bestMatch: DetectedHeaderResult | null = null;
  let bestScore = -1;

  for (const [rowIndex, row] of rows.entries()) {
    const columnIndexByKey: Record<string, number> = {};
    const detectedHeaders: Record<string, string> = {};

    for (const [cellIndex, cell] of row.entries()) {
      const normalizedCell = normalizeHeader(cell);
      if (!normalizedCell) {
        continue;
      }

      const match = normalizedAliasEntries.find(
        ([key, normalizedAliases]) => columnIndexByKey[key] === undefined && normalizedAliases.has(normalizedCell),
      );
      if (!match) {
        continue;
      }

      const [key] = match;
      columnIndexByKey[key] = cellIndex;
      detectedHeaders[key] = cell;
    }

    const score = Object.keys(columnIndexByKey).length;
    const hasRequiredKeys = requiredKeys.every((key) => key in columnIndexByKey);

    if (!hasRequiredKeys || score === 0) {
      continue;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        headerRowIndex: rowIndex,
        columnIndexByKey,
        detectedHeaders,
      };
    }
  }

  if (!bestMatch) {
    throw new Error('Unable to detect a header row in the uploaded sheet.');
  }

  return bestMatch;
}

export function getCellValue(row: string[], columnIndexByKey: Record<string, number>, key: string) {
  const columnIndex = columnIndexByKey[key];

  if (columnIndex === undefined) {
    return '';
  }

  return String(row[columnIndex] ?? '').trim();
}

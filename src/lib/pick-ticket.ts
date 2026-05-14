import { createId, parseScanValue } from '../utils/qr';
import { detectHeaderRow, getCellValue, parseNumberLike, readFirstWorksheetRows } from './spreadsheet';
import type { InventoryStatus, ItemMasterRecord, PickLineStatus, PickTicketLine } from '../types';

const pickTicketAliases = {
  orderNumber: ['order', 'ordernumber', 'order#', 'pickticket', 'pickticket#', 'ticket', 'ticketnumber'],
  lineNumber: ['line', 'line#', 'linenumber', 'lineitem'],
  expectedItem: ['item', 'item#', 'itemnumber', 'sku', 'expecteditem'],
  expectedDescription: ['description', 'itemdescription', 'vendordescription', 'packinglistdescription'],
  fromSlot: ['fromslot', 'slot', 'fromlocation', 'location', 'bin', 'binloc'],
  quantity: ['qty', 'quantity', 'pickqty', 'orderedqty'],
  uom: ['uom', 'um'],
} as const;

export interface ParsedPickScan {
  scannedItem: string;
  scannedLocation: string;
  scannedDescription: string;
  rawValue: string;
}

export interface PickVerificationOutcome {
  itemMatch: boolean;
  locationMatch: boolean | null;
  itemStatus: string;
  locationStatus: string;
  verifyResult: string;
  overallResult: string;
  itemMasterDescription: string;
}

function normalizeValue(value: string) {
  return value.trim().toUpperCase();
}

function buildVerifyResult(itemStatus: string, locationStatus: string) {
  return [itemStatus, locationStatus].filter(Boolean).join('\n');
}

export async function parsePickTicketFile(file: File) {
  const { rows, sheetName } = await readFirstWorksheetRows(file);
  const detected = detectHeaderRow(rows, pickTicketAliases, ['expectedItem']);
  const pickTicketId = createId('ticket');

  const parsedLines = rows
    .slice(detected.headerRowIndex + 1)
    .map((row, rowOffset) => {
      const expectedItem = getCellValue(row, detected.columnIndexByKey, 'expectedItem').trim();

      if (!expectedItem) {
        return null;
      }

      const lineNumber = getCellValue(row, detected.columnIndexByKey, 'lineNumber') || `${rowOffset + 1}`;
      const orderNumber = getCellValue(row, detected.columnIndexByKey, 'orderNumber') || file.name.replace(/\.[^.]+$/, '');
      const quantityValue = parseNumberLike(getCellValue(row, detected.columnIndexByKey, 'quantity'));

      const line: PickTicketLine = {
        id: createId('line'),
        pickTicketId,
        orderNumber,
        lineNumber,
        expectedItem,
        expectedDescription: getCellValue(row, detected.columnIndexByKey, 'expectedDescription'),
        fromSlot: getCellValue(row, detected.columnIndexByKey, 'fromSlot'),
        quantity: quantityValue,
        uom: getCellValue(row, detected.columnIndexByKey, 'uom'),
        scannedItem: '',
        scannedLocation: '',
        itemMasterDescription: '',
        itemStatus: 'Awaiting scan',
        locationStatus: 'Awaiting scan',
        verifyResult: 'Awaiting scan',
        status: 'Queued',
        pullCheck: false,
        inventoryStatus: 'Pending',
        overrideNotes: '',
        overrideBy: '',
        overrideByEmail: '',
      };

      return line;
    })
    .filter((line): line is PickTicketLine => Boolean(line));

  if (!parsedLines.length) {
    throw new Error('No pick ticket lines were found after the detected header row.');
  }

  return {
    fileName: file.name,
    sheetName,
    headerRowIndex: detected.headerRowIndex,
    detectedHeaders: detected.detectedHeaders,
    pickTicketId,
    rows: parsedLines,
  };
}

export function parsePickScan(rawValue: string): ParsedPickScan {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      scannedItem: '',
      scannedLocation: '',
      scannedDescription: '',
      rawValue,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const metadata =
      typeof parsed.metadata === 'object' && parsed.metadata !== null
        ? (parsed.metadata as Record<string, unknown>)
        : {};

    if (String(parsed.type ?? '').toLowerCase() === 'item_label') {
      return {
        scannedItem: String(parsed.item ?? '').trim(),
        scannedLocation: String(parsed.location ?? '').trim(),
        scannedDescription: String(parsed.description ?? '').trim(),
        rawValue,
      };
    }

    if (typeof parsed.entityId === 'string' || typeof parsed.code === 'string') {
      return {
        scannedItem: String(parsed.entityId ?? parsed.code ?? '').trim(),
        scannedLocation: String(parsed.location ?? metadata.location ?? '').trim(),
        scannedDescription: String(parsed.label ?? parsed.description ?? '').trim(),
        rawValue,
      };
    }
  } catch {
    // Fall back to shorthand parsing below.
  }

  const genericScan = parseScanValue(trimmed);

  if (genericScan.qrType === 'ITEM') {
    return {
      scannedItem: genericScan.entityId,
      scannedLocation: '',
      scannedDescription: genericScan.displayValue,
      rawValue,
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      scannedItem: trimmed,
      scannedLocation: '',
      scannedDescription: '',
      rawValue,
    };
  }

  return {
    scannedItem: trimmed,
    scannedLocation: '',
    scannedDescription: '',
    rawValue,
  };
}

export function verifyPickScan(line: PickTicketLine, parsedScan: ParsedPickScan, itemMaster: ItemMasterRecord | null): PickVerificationOutcome {
  const itemMatch = normalizeValue(line.expectedItem) === normalizeValue(parsedScan.scannedItem);
  const hasScannedLocation = Boolean(parsedScan.scannedLocation);
  const hasExpectedLocation = Boolean(line.fromSlot);
  const locationMatch = hasExpectedLocation && hasScannedLocation ? normalizeValue(line.fromSlot) === normalizeValue(parsedScan.scannedLocation) : null;

  const itemStatus = itemMatch
    ? '✅ Correct Item'
    : `❌ Wrong Item\nExpected: ${line.expectedItem}\nScanned: ${parsedScan.scannedItem || 'Unknown'}`;

  const locationStatus =
    hasExpectedLocation && hasScannedLocation
      ? locationMatch
        ? '✅ Correct Location'
        : `❌ Wrong Location\nExpected: ${line.fromSlot}\nScanned: ${parsedScan.scannedLocation}`
      : hasExpectedLocation
        ? 'Location not available on scan'
        : 'No From Slot provided';

  const overallResult = itemMatch
    ? locationMatch === false
      ? 'Correct Item / Location Review'
      : 'Correct Item'
    : 'Wrong Item';

  return {
    itemMatch,
    locationMatch,
    itemStatus,
    locationStatus,
    verifyResult: buildVerifyResult(itemStatus, locationStatus),
    overallResult,
    itemMasterDescription: itemMaster?.description || parsedScan.scannedDescription || 'Item not found in itemMaster',
  };
}

export function getStatusAfterVerification(outcome: PickVerificationOutcome): PickLineStatus {
  return outcome.itemMatch ? 'Verified' : 'Needs Review';
}

export function canMarkPicked(line: PickTicketLine) {
  return line.status === 'Override Approved' || normalizeValue(line.expectedItem) === normalizeValue(line.scannedItem);
}

export function getInventoryStatusForFailure(outcome: PickVerificationOutcome): InventoryStatus {
  return outcome.itemMatch ? 'Pending' : 'Needs Review';
}

import type { InventoryStatus, ItemMasterRecord, PickLineStatus, PickTicketLine } from '../types';
import { parseNumberLike, readFirstWorksheetRows } from './spreadsheet';
import { createId, normalizeItemNumber, normalizeLocation, parseQrScan } from '../utils/qr';

const pickTicketAliases = {
  orderNumber: ['order', 'ordernumber', 'order#', 'pickticket', 'pickticket#', 'ticket', 'ticketnumber', 'transfernumber'],
  lineNumber: ['line', 'line#', 'linenumber', 'lineitem'],
  expectedItem: ['item', 'item#', 'itemnumber', 'sku', 'expecteditem'],
  expectedDescription: ['description', 'itemdescription', 'vendordescription', 'packinglistdescription'],
  fromSlot: ['fromslot', 'slot', 'fromlocation', 'location', 'bin', 'binloc', 'binlocation', 'binloc'],
  requiredQty: ['qty', 'quantity', 'pickqty', 'orderedqty', 'orderqty', 'requiredqty'],
  availableQty: ['avail', 'available', 'availableqty', 'qtyavailable'],
  pickedQty: ['pickedqty', 'pickqtyscanned'],
  uom: ['uom', 'um'],
} as const;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function getCellValue(row: string[], columnIndexByKey: Record<string, number>, key: string) {
  const columnIndex = columnIndexByKey[key];

  if (columnIndex === undefined) {
    return '';
  }

  return String(row[columnIndex] ?? '').trim();
}

function findBestHeaderRow(rows: string[][]) {
  const normalizedAliasEntries = Object.entries(pickTicketAliases).map(([key, values]) => [key, new Set(values.map(normalizeHeader))] as const);
  let bestRowIndex = -1;
  let bestScore = -1;
  let bestMap: Record<string, number> = {};
  let bestHeaders: Record<string, string> = {};

  rows.forEach((row, rowIndex) => {
    const columnIndexByKey: Record<string, number> = {};
    const detectedHeaders: Record<string, string> = {};

    row.forEach((cell, cellIndex) => {
      const normalizedCell = normalizeHeader(cell);
      if (!normalizedCell) {
        return;
      }

      const match = normalizedAliasEntries.find(
        ([key, aliases]) => columnIndexByKey[key] === undefined && aliases.has(normalizedCell),
      );

      if (!match) {
        return;
      }

      const [key] = match;
      columnIndexByKey[key] = cellIndex;
      detectedHeaders[key] = cell;
    });

    const score = Object.keys(columnIndexByKey).length;
    const hasRequired = columnIndexByKey.expectedItem !== undefined;

    if (hasRequired && score > bestScore) {
      bestRowIndex = rowIndex;
      bestScore = score;
      bestMap = columnIndexByKey;
      bestHeaders = detectedHeaders;
    }
  });

  if (bestRowIndex < 0) {
    throw new Error('Unable to detect a pick ticket header row.');
  }

  return {
    headerRowIndex: bestRowIndex,
    columnIndexByKey: bestMap,
    detectedHeaders: bestHeaders,
  };
}

export async function parsePickTicketFile(file: File) {
  const { rows, sheetName } = await readFirstWorksheetRows(file);
  const detected = findBestHeaderRow(rows);
  const pickTicketId = createId('ticket');

  let discoveredOrderNumber = file.name.replace(/\.[^.]+$/, '');

  rows.forEach((row) => {
    row.forEach((cell) => {
      const match = String(cell || '').trim().match(/\*?(S?XFR|XFR|SO|PO)\d+\*?/i);
      if (match) {
        discoveredOrderNumber = match[0].replace(/\*/g, '').trim().toUpperCase();
      }
    });
  });

  const parsedLines = rows
    .slice(detected.headerRowIndex + 1)
    .map((row, rowOffset) => {
      const expectedItem = normalizeItemNumber(getCellValue(row, detected.columnIndexByKey, 'expectedItem'));

      if (!expectedItem) {
        return null;
      }

      const orderNumber = getCellValue(row, detected.columnIndexByKey, 'orderNumber') || discoveredOrderNumber;
      const requiredQty = parseNumberLike(getCellValue(row, detected.columnIndexByKey, 'requiredQty'));
      const pickedQty = parseNumberLike(getCellValue(row, detected.columnIndexByKey, 'pickedQty'));
      const lineNumber = getCellValue(row, detected.columnIndexByKey, 'lineNumber') || `${rowOffset + 1}`;

      return {
        id: createId('line'),
        pickTicketId,
        orderNumber,
        lineNumber,
        expectedItem,
        expectedDescription: getCellValue(row, detected.columnIndexByKey, 'expectedDescription'),
        fromSlot: normalizeLocation(getCellValue(row, detected.columnIndexByKey, 'fromSlot')),
        requiredQty,
        availableQty: parseNumberLike(getCellValue(row, detected.columnIndexByKey, 'availableQty')),
        pickedQty,
        remainingQty: Math.max(requiredQty - pickedQty, 0),
        uom: getCellValue(row, detected.columnIndexByKey, 'uom'),
        scannedItem: '',
        scannedLocation: '',
        itemMasterDescription: '',
        itemStatus: 'Awaiting item scan',
        locationStatus: 'Awaiting location scan',
        verifyResult: 'Awaiting scan',
        status: 'Queued',
        pullCheck: false,
        inventoryStatus: 'Pending',
        overrideNotes: '',
        overrideBy: '',
        overrideByEmail: '',
        lastPullQty: 0,
      } satisfies PickTicketLine;
    })
    .filter((line) => line !== null) as PickTicketLine[];

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

function normalizeCompare(value: string) {
  return value.trim().toUpperCase();
}

export function applyPickScan(line: PickTicketLine, rawValue: string, itemMaster: ItemMasterRecord | null) {
  const parsed = parseQrScan(rawValue);
  const nextLine: PickTicketLine = {
    ...line,
  };

  if (parsed.parsedType === 'item_label' || parsed.parsedType === 'item_number') {
    nextLine.scannedItem = parsed.item;
    nextLine.itemMasterDescription = itemMaster?.description || parsed.description || line.itemMasterDescription;
  }

  if (parsed.parsedType === 'location' || (parsed.parsedType === 'item_label' && parsed.location)) {
    nextLine.scannedLocation = parsed.location;
  }

  const itemMatch = Boolean(nextLine.scannedItem) && normalizeCompare(nextLine.expectedItem) === normalizeCompare(nextLine.scannedItem);
  const locationAvailable = Boolean(nextLine.fromSlot) && Boolean(nextLine.scannedLocation);
  const locationMatch = locationAvailable
    ? normalizeCompare(nextLine.fromSlot) === normalizeCompare(nextLine.scannedLocation)
    : null;

  nextLine.itemStatus = nextLine.scannedItem
    ? itemMatch
      ? '✅ Correct Item'
      : `❌ Wrong Item\nExpected: ${line.expectedItem}\nScanned: ${nextLine.scannedItem}`
    : 'Awaiting item scan';

  nextLine.locationStatus = nextLine.fromSlot
    ? nextLine.scannedLocation
      ? locationMatch
        ? '✅ Correct Location'
        : `❌ Wrong Location\nExpected: ${line.fromSlot}\nScanned: ${nextLine.scannedLocation}`
      : 'Awaiting location scan'
    : 'No From Slot provided';

  nextLine.verifyResult = [nextLine.itemStatus, nextLine.locationStatus]
    .filter(Boolean)
    .join('\n');
  nextLine.status = itemMatch ? 'Verified' : nextLine.scannedItem ? 'Needs Review' : 'Queued';
  nextLine.inventoryStatus = itemMatch ? nextLine.inventoryStatus : '❌ Issue / Needs Review';
  nextLine.lastVerifiedAt = new Date().toISOString();

  return {
    line: nextLine,
    itemMatch,
    locationMatch,
    parsed,
    overallResult:
      itemMatch && locationMatch === true
        ? '✅ Correct Item + Correct Location'
        : itemMatch && locationMatch === false
          ? '❌ Wrong Location'
        : itemMatch
          ? '✅ Correct Item'
          : nextLine.scannedItem
            ? '❌ Wrong Item'
            : 'Awaiting scan',
  };
}

export function canMarkPicked(line: PickTicketLine) {
  return line.status === 'Override Approved' || normalizeCompare(line.expectedItem) === normalizeCompare(line.scannedItem);
}

export function getLineStatusFromQuantities(line: PickTicketLine): InventoryStatus {
  if (line.pullCheck && line.lastPullQty !== line.pickedQty) {
    return '⚠️ Needs Recheck';
  }

  if (line.pickedQty === 0) {
    return line.inventoryStatus === '✔️ Resolved' ? '✔️ Resolved' : 'Pending';
  }

  if (line.pickedQty < line.requiredQty) {
    return '⚠️ Partially Pulled';
  }

  return line.inventoryStatus;
}

export function markLinePicked(line: PickTicketLine): PickTicketLine {
  if (!canMarkPicked(line)) {
    return line;
  }

  return {
    ...line,
    status: 'Picked',
    remainingQty: Math.max(line.requiredQty - line.pickedQty, 0),
  };
}

export function applyOverride(line: PickTicketLine, userName: string, userEmail: string): PickTicketLine {
  return {
    ...line,
    status: 'Override Approved',
    overrideBy: userName,
    overrideByEmail: userEmail,
    inventoryStatus: '❌ Issue / Needs Review',
  };
}

export function updatePickedQty(line: PickTicketLine, pickedQty: number): PickTicketLine {
  const nextLine = {
    ...line,
    pickedQty,
    remainingQty: Math.max(line.requiredQty - pickedQty, 0),
  };

  if (line.pullCheck && line.lastPullQty !== pickedQty) {
    nextLine.pullCheck = false;
    nextLine.inventoryStatus = '⚠️ Needs Recheck';
  } else if (pickedQty > 0 && pickedQty < line.requiredQty) {
    nextLine.inventoryStatus = '⚠️ Partially Pulled';
  }

  return nextLine;
}

export function getVerificationStatus(itemMatch: boolean): PickLineStatus {
  return itemMatch ? 'Verified' : 'Needs Review';
}

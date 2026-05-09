import { qrTypes, type ParsedScan, type QRPayload, type QRType } from '../types';
import { toTitleCase } from './format';

const qrTypeSet = new Set<QRType>(qrTypes);

export function createId(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${prefix}-${suffix}`.toUpperCase();
}

export function getWorkflowRoute(qrType: QRType) {
  switch (qrType) {
    case 'ITEM':
    case 'BIN':
    case 'PALLET':
      return '/inventory';
    case 'RECEIVING':
    case 'OSD':
      return '/receiving';
    case 'PUTAWAY':
      return '/putaway';
    case 'CYCLE_COUNT':
      return '/cycle-count';
    case 'ORDER_PICK':
    case 'TRANSFER_PICK':
      return '/order-picking';
    case 'EQUIPMENT':
      return '/equipment';
    case 'SAFETY':
      return '/safety';
    case 'EMPLOYEE':
      return '/settings';
    case 'UNKNOWN':
    default:
      return '/scan-history';
  }
}

export function getWorkflowName(qrType: QRType) {
  switch (qrType) {
    case 'ITEM':
    case 'BIN':
    case 'PALLET':
      return 'Inventory';
    case 'RECEIVING':
    case 'OSD':
      return 'Receiving';
    case 'PUTAWAY':
      return 'Putaway';
    case 'CYCLE_COUNT':
      return 'Cycle Count';
    case 'ORDER_PICK':
    case 'TRANSFER_PICK':
      return 'Order Picking';
    case 'EQUIPMENT':
      return 'Equipment';
    case 'SAFETY':
      return 'Safety';
    case 'EMPLOYEE':
      return 'Settings';
    case 'UNKNOWN':
    default:
      return 'Scan History';
  }
}

function normalizeType(input: unknown): QRType {
  if (typeof input !== 'string') {
    return 'UNKNOWN';
  }

  const normalized = input.trim().toUpperCase().replace(/\s+/g, '_') as QRType;
  return qrTypeSet.has(normalized) ? normalized : 'UNKNOWN';
}

function normalizePayloadCandidate(payload: Partial<QRPayload>, rawValue: string): ParsedScan {
  const qrType = normalizeType(payload.type);
  const entityId = String(payload.entityId ?? payload.code ?? payload.label ?? rawValue).trim();
  const code = String(payload.code ?? entityId).trim();
  const displayValue = String(payload.label ?? payload.code ?? entityId).trim();
  const normalizedPayload: QRPayload = {
    type: qrType,
    entityId,
    code,
    label: displayValue,
    workflow: String(payload.workflow ?? getWorkflowName(qrType)),
    site: String(payload.site ?? 'QR Legends Demo DC'),
    createdAt: String(payload.createdAt ?? new Date().toISOString()),
    metadata: payload.metadata ?? {},
  };

  return {
    qrType,
    rawValue,
    displayValue,
    entityId,
    code,
    workflowRoute: getWorkflowRoute(qrType),
    payload: normalizedPayload,
  };
}

export function parseScanValue(rawValue: string): ParsedScan {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      qrType: 'UNKNOWN',
      rawValue,
      displayValue: 'Empty Scan',
      entityId: 'UNKNOWN',
      code: 'UNKNOWN',
      workflowRoute: getWorkflowRoute('UNKNOWN'),
      payload: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<QRPayload>;
    if (parsed && typeof parsed === 'object') {
      return normalizePayloadCandidate(parsed, trimmed);
    }
  } catch {
    // Manual entry can still be interpreted below.
  }

  const prefixMatch = trimmed.match(/^([A-Z_]+)\s*[:|]\s*(.+)$/i);
  if (prefixMatch) {
    const qrType = normalizeType(prefixMatch[1]);
    const entityId = prefixMatch[2].trim();
    return {
      qrType,
      rawValue,
      displayValue: entityId,
      entityId,
      code: entityId,
      workflowRoute: getWorkflowRoute(qrType),
      payload: null,
    };
  }

  return {
    qrType: 'UNKNOWN',
    rawValue,
    displayValue: trimmed,
    entityId: trimmed,
    code: trimmed,
    workflowRoute: getWorkflowRoute('UNKNOWN'),
    payload: null,
  };
}

export function stringifyPayload(payload: QRPayload) {
  return JSON.stringify(payload, null, 2);
}

export function buildPayload(input: {
  type: QRType;
  entityId: string;
  code: string;
  label: string;
  site: string;
  metadata: Record<string, string>;
}) {
  const workflow = getWorkflowName(input.type);

  return {
    type: input.type,
    entityId: input.entityId.trim(),
    code: input.code.trim(),
    label: input.label.trim(),
    workflow,
    site: input.site.trim(),
    createdAt: new Date().toISOString(),
    metadata: input.metadata,
  } satisfies QRPayload;
}

export function getRouteActionLabel(qrType: QRType) {
  return `Routed to ${getWorkflowName(qrType)}`;
}

export function getReadableType(qrType: QRType) {
  return toTitleCase(qrType);
}

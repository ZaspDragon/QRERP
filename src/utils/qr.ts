import QRCode from 'qrcode';
import type { ItemLabelPayload, ParsedQrScan } from '../types';

export function createId(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 10)
      : Math.random().toString(36).slice(2, 12);

  return `${prefix}-${suffix}`;
}

export function normalizeItemNumber(value: string) {
  return value.trim();
}

export function normalizeLocation(value: string) {
  return value.trim().toUpperCase();
}

export function buildLocationQrValue(location: string) {
  return `LOC:${normalizeLocation(location)}`;
}

export function buildItemLabelPayload(input: {
  item: string;
  description: string;
  location: string;
  uom: string;
  source: string;
  qty?: number;
}) {
  const payload: ItemLabelPayload = {
    type: 'item_label',
    item: normalizeItemNumber(input.item),
    description: input.description.trim(),
    location: normalizeLocation(input.location),
    uom: input.uom.trim(),
    source: input.source.trim(),
  };

  if (input.qty && input.qty > 0) {
    payload.qty = input.qty;
  }

  return payload;
}

export function isPlainItemNumber(value: string) {
  return /^\d+$/.test(value.trim());
}

export function parseQrScan(rawValue: string): ParsedQrScan {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      parsedType: 'unknown',
      rawValue,
      item: '',
      location: '',
      description: '',
      uom: '',
      source: '',
      qty: 0,
      payload: null,
    };
  }

  if (trimmed.toUpperCase().startsWith('LOC:')) {
    return {
      parsedType: 'location',
      rawValue,
      item: '',
      location: normalizeLocation(trimmed.slice(4)),
      description: '',
      uom: '',
      source: 'location_label',
      qty: 0,
      payload: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<ItemLabelPayload> & { type?: string };

    if (String(parsed.type ?? '').toLowerCase() === 'item_label') {
      const payload = buildItemLabelPayload({
        item: String(parsed.item ?? ''),
        description: String(parsed.description ?? ''),
        location: String(parsed.location ?? ''),
        uom: String(parsed.uom ?? ''),
        source: String(parsed.source ?? 'item_label'),
        qty: typeof parsed.qty === 'number' ? parsed.qty : Number(parsed.qty ?? 0),
      });

      return {
        parsedType: 'item_label',
        rawValue,
        item: payload.item,
        location: payload.location,
        description: payload.description,
        uom: payload.uom,
        source: payload.source,
        qty: payload.qty ?? 0,
        payload,
      };
    }
  } catch {
    // Fall through to plain item handling.
  }

  if (isPlainItemNumber(trimmed)) {
    return {
      parsedType: 'item_number',
      rawValue,
      item: normalizeItemNumber(trimmed),
      location: '',
      description: '',
      uom: '',
      source: 'plain_item_number',
      qty: 0,
      payload: null,
    };
  }

  return {
    parsedType: 'unknown',
    rawValue,
    item: '',
    location: '',
    description: '',
    uom: '',
    source: '',
    qty: 0,
    payload: null,
  };
}

export function stringifyQrPayload(payload: ItemLabelPayload) {
  return JSON.stringify(payload, null, 2);
}

export async function toQrDataUrl(value: string, width = 240) {
  return QRCode.toDataURL(value, {
    width,
    margin: 1,
  });
}

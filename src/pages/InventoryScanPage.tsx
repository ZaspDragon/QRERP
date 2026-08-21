import { useState } from 'react';
import { Link } from 'react-router-dom';
import CameraScanner from '../components/qr/CameraScanner';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { getItemMasterRecord } from '../lib/item-master';
import type { ItemMasterRecord, ParsedQrScan } from '../types';
import { parseQrScan } from '../utils/qr';

export default function InventoryScanPage() {
  const [sticker, setSticker] = useState<ParsedQrScan | null>(null);
  const [master, setMaster] = useState<ItemMasterRecord | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleScan(rawValue: string) {
    const parsed = parseQrScan(rawValue);
    if (!['item_label', 'item_number'].includes(parsed.parsedType) || !parsed.item) {
      setError('Sticker not recognized. Scan a QRERP receiving freight sticker.');
      setStatus('');
      return;
    }
    setSticker(parsed);
    setError('');
    try {
      const record = await getItemMasterRecord(parsed.item);
      setMaster(record);
      setStatus(`Found ${parsed.description || record?.description || `item ${parsed.item}`}.`);
    } catch (lookupError) {
      setMaster(null);
      setStatus(`Sticker read successfully for item ${parsed.item}.`);
      setError(lookupError instanceof Error ? lookupError.message : 'Item Master lookup was unavailable.');
    }
  }

  const itemName = sticker?.description || master?.description || master?.vendorDescription || '';
  const location = sticker?.location || master?.defaultLocation || master?.binLocation || '';

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Step 2 · Identify and Store" title="Inventory" description="Scan the receiving sticker to see the product name, item number, quantity, and assigned slot before putting freight away." actions={<Link className="secondary-button" to="/inventory-lookup">Advanced Lookup</Link>} />
      <SectionCard title="Scan Receiving Sticker" description="The sticker name is shown immediately and confirmed against the Item Master when available.">
        <CameraScanner onScan={(value) => void handleScan(value)} />
        {status ? <div className="verification-banner success">{status}</div> : null}
        {error ? <div className="verification-banner danger">{error}</div> : null}
      </SectionCard>
      {sticker ? (
        <SectionCard title={itemName || 'Item name unavailable'} description="Scanned freight details">
          <div className="detail-grid">
            <div><dt>Item Name</dt><dd>{itemName || 'Not listed on sticker or Item Master'}</dd></div>
            <div><dt>Item #</dt><dd>{sticker.item}</dd></div>
            <div><dt>Quantity</dt><dd>{sticker.qty || '—'}</dd></div>
            <div><dt>Assigned Slot</dt><dd>{location || 'Scan or assign a slot'}</dd></div>
            <div><dt>UOM</dt><dd>{sticker.uom || master?.uom || '—'}</dd></div>
            <div><dt>Available Qty</dt><dd>{master?.availableQty ?? '—'}</dd></div>
          </div>
          <div className="button-row">
            <Link className="primary-button" to="/putaway">Scan Into Slot</Link>
            <button className="secondary-button" type="button" onClick={() => { setSticker(null); setMaster(null); setStatus(''); setError(''); }}>Scan Another</button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

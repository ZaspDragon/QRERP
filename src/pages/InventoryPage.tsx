import { useState, type FormEvent } from 'react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { getItemMasterRecord } from '../lib/item-master';
import { getFirebaseConfigError, isFirebaseConfigured } from '../lib/firebase';
import { listActivePullConfirmations, listRecentScanVerifications } from '../lib/verification-store';
import { formatCompactNumber, formatDateTime } from '../utils/format';
import type { ItemMasterRecord, PullConfirmationRecord, ScanVerificationRecord } from '../types';

function deriveLookupSignals(pulls: PullConfirmationRecord[], verifications: ScanVerificationRecord[]) {
  const signals: string[] = [];

  if (pulls.length) {
    signals.push('Pulled');
  }

  if (verifications.some((record) => record.overallResult.toLowerCase().includes('wrong'))) {
    signals.push('Wrong');
  }

  if (
    verifications.some(
      (record) =>
        record.overallResult.toLowerCase().includes('short') ||
        record.notes.toLowerCase().includes('short'),
    )
  ) {
    signals.push('Short');
  }

  if (
    verifications.some(
      (record) =>
        record.overrideUsed ||
        record.overallResult.toLowerCase().includes('review') ||
        record.overallResult.toLowerCase().includes('override'),
    )
  ) {
    signals.push('Needs Review');
  }

  return signals.length ? signals : ['No recent activity'];
}

export default function InventoryPage() {
  const { bins, items, pallets } = useERP();
  const firebaseReady = isFirebaseConfigured();
  const firebaseError = getFirebaseConfigError();
  const lowStockItems = items.filter((item) => item.quantity <= item.reorderPoint).length;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const [searchItem, setSearchItem] = useState('');
  const [lookupRecord, setLookupRecord] = useState<ItemMasterRecord | null>(null);
  const [pullConfirmations, setPullConfirmations] = useState<PullConfirmationRecord[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<ScanVerificationRecord[]>([]);
  const [lookupStatus, setLookupStatus] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  async function handleLookup(event?: FormEvent) {
    event?.preventDefault();

    const item = searchItem.trim();

    if (!item) {
      setLookupError('Enter an item number to search the imported item master.');
      return;
    }

    setLookupStatus('');
    setLookupError('');
    setIsLookingUp(true);

    try {
      const [record, pulls, verifications] = await Promise.all([
        getItemMasterRecord(item),
        listActivePullConfirmations(item),
        listRecentScanVerifications(item),
      ]);

      setLookupRecord(record);
      setPullConfirmations(pulls);
      setRecentVerifications(verifications);
      setLookupStatus(
        record
          ? `Loaded item ${record.item} with ${pulls.length} active pull confirmation(s) and ${verifications.length} recent verification record(s).`
          : `No item master record found for ${item}.`,
      );
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Unable to search the item master.');
    } finally {
      setIsLookingUp(false);
    }
  }

  const lookupSignals = deriveLookupSignals(pullConfirmations, recentVerifications);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Storage"
        title="Inventory"
        description="Search the imported item master, see available quantity and location, and review active pulls plus recent scan verifications from the order-picking workflow."
      />

      <RouteWorkflowCard route="/inventory" />

      {!firebaseReady ? <div className="info-banner warning-banner">{firebaseError}</div> : null}

      <section className="stat-grid">
        <StatCard label="Inventory Units" value={formatCompactNumber(totalUnits)} helper={`${items.length} demo SKUs loaded`} />
        <StatCard label="Low Stock" value={`${lowStockItems}`} helper="Items at or below reorder point" />
        <StatCard label="Tracked Bins" value={`${bins.length}`} helper="Open, tight, and audit-needed bins" />
        <StatCard label="Active Pallets" value={`${pallets.length}`} helper="Stored, inbound, or moving pallets" />
      </section>

      <SectionCard title="Inventory Lookup" description="Search an item number to pull its itemMaster record, available quantity, default/bin location, active pulls, and recent verification audit history.">
        <form className="stack-form" onSubmit={(event) => void handleLookup(event)}>
          <label>
            <span>Item number</span>
            <input
              className="text-input"
              value={searchItem}
              onChange={(event) => setSearchItem(event.target.value)}
              placeholder="552103"
            />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={!firebaseReady || isLookingUp}>
              {isLookingUp ? 'Searching…' : 'Search Item Master'}
            </button>
          </div>
          {lookupStatus ? <div className="info-banner success-banner">{lookupStatus}</div> : null}
          {lookupError ? <div className="info-banner danger-banner">{lookupError}</div> : null}
        </form>
      </SectionCard>

      <div className="split-layout">
        <SectionCard title="Item Master Record" description="Direct item-level lookup from Firestore itemMaster.">
          {lookupRecord ? (
            <div className="stack-form">
              <div className="detail-grid">
                <div>
                  <dt>Item</dt>
                  <dd>{lookupRecord.item}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{lookupRecord.description || '—'}</dd>
                </div>
                <div>
                  <dt>Available Qty</dt>
                  <dd>{lookupRecord.availableQty}</dd>
                </div>
                <div>
                  <dt>Default Location</dt>
                  <dd>{lookupRecord.defaultLocation || '—'}</dd>
                </div>
                <div>
                  <dt>Bin Location</dt>
                  <dd>{lookupRecord.binLocation || '—'}</dd>
                </div>
                <div>
                  <dt>UOM</dt>
                  <dd>{lookupRecord.uom || '—'}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{lookupRecord.category || '—'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{lookupRecord.itemType || '—'}</dd>
                </div>
              </div>
              <div className="chip-grid">
                {lookupSignals.map((signal) => (
                  <StatusBadge key={signal} status={signal} />
                ))}
              </div>
              {lookupRecord.websiteUrl ? (
                <a className="secondary-button inline-link-button" href={lookupRecord.websiteUrl} target="_blank" rel="noreferrer">
                  Open Website URL
                </a>
              ) : null}
              <div className="code-block">{JSON.stringify(lookupRecord.qrPayload, null, 2)}</div>
            </div>
          ) : (
            <div className="empty-state">Search an item number to load the Firestore item master record.</div>
          )}
        </SectionCard>

        <SectionCard title="Active Pull Confirmations" description="Pulls that have already been checked and sent toward inventory review.">
          <DataTable
            rows={pullConfirmations}
            emptyMessage="No active pull confirmations found for the searched item."
            columns={[
              { key: 'order', label: 'Order', render: (row) => row.orderNumber },
              { key: 'item', label: 'Item', render: (row) => row.item },
              { key: 'location', label: 'Location', render: (row) => row.location || '—' },
              { key: 'status', label: 'Inventory Status', render: (row) => <StatusBadge status={row.inventoryStatus} /> },
              { key: 'created', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Recent Scan Verifications" description="Latest scan verification events tied to the searched item number.">
        <DataTable
          rows={recentVerifications}
          emptyMessage="No recent scan verifications found for the searched item."
          columns={[
            { key: 'created', label: 'Verified At', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
            { key: 'expectedItem', label: 'Expected Item', render: (row) => row.expectedItem },
            { key: 'scannedItem', label: 'Scanned Item', render: (row) => row.scannedItem || '—' },
            { key: 'location', label: 'Scanned Location', render: (row) => row.scannedLocation || '—' },
            { key: 'result', label: 'Verify Result', render: (row) => <div className="table-note">{row.overallResult}</div> },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Demo Warehouse Snapshot" description="Legacy local demo records remain available for the broader warehouse walkthrough.">
        <DataTable
          rows={items}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => row.sku },
            { key: 'name', label: 'Item', render: (row) => row.name },
            { key: 'qty', label: 'On Hand', render: (row) => row.quantity },
            { key: 'bin', label: 'Bin', render: (row) => row.binId },
            { key: 'pallet', label: 'Pallet', render: (row) => row.palletId },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

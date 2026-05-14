import { useMemo, useState, type FormEvent } from 'react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { getItemMasterRecord, listItemMasterRecordsByLocation } from '../lib/item-master';
import {
  listPullConfirmationsByDocument,
  listPullConfirmationsByItem,
  listPullConfirmationsByLocation,
  listRecentQrScansByDocument,
  listRecentQrScansByItem,
  listRecentQrScansByLocation,
  listRecentScanVerificationsByDocument,
  listRecentScanVerificationsByItem,
  listRecentScanVerificationsByLocation,
} from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';
import type { InventoryItemSignals, ItemMasterRecord, PullConfirmationRecord, QrScanRecord, ScanVerificationRecord } from '../types';

type SearchMode = 'item' | 'location' | 'document';

function deriveSignals(
  itemRecord: ItemMasterRecord | null,
  itemMatches: ItemMasterRecord[],
  pulls: PullConfirmationRecord[],
  verifications: ScanVerificationRecord[],
): InventoryItemSignals[] {
  const signals: InventoryItemSignals[] = [];

  if (itemRecord || itemMatches.length) {
    signals.push({ label: 'Item Master Found', tone: 'positive' });
  }

  if (pulls.some((record) => record.inventoryStatus === '✅ Sent to Inventory')) {
    signals.push({ label: '✅ Pulled', tone: 'positive' });
  }

  if (pulls.some((record) => record.inventoryStatus === '⚠️ Partially Pulled')) {
    signals.push({ label: '⚠️ Partially Pulled', tone: 'warning' });
  }

  if (pulls.some((record) => record.inventoryStatus === '⚠️ Needs Recheck')) {
    signals.push({ label: '⚠️ Needs Recheck', tone: 'warning' });
  }

  if (verifications.some((record) => record.overallResult.includes('Wrong') || record.itemStatus.includes('Wrong'))) {
    signals.push({ label: '❌ Wrong Item', tone: 'warning' });
  }

  if (verifications.some((record) => record.overallResult.includes('Short') || record.notes.toLowerCase().includes('short'))) {
    signals.push({ label: '❌ Issue / Needs Review', tone: 'warning' });
  }

  if (verifications.some((record) => record.overrideUsed || record.overallResult.includes('Review'))) {
    signals.push({ label: 'Needs Review', tone: 'warning' });
  }

  return signals.length ? signals : [{ label: 'No recent activity', tone: 'neutral' }];
}

export default function InventoryPage() {
  const { pullConfirmations } = useERP();
  const [searchMode, setSearchMode] = useState<SearchMode>('item');
  const [query, setQuery] = useState('');
  const [itemRecord, setItemRecord] = useState<ItemMasterRecord | null>(null);
  const [itemMatches, setItemMatches] = useState<ItemMasterRecord[]>([]);
  const [pulls, setPulls] = useState<PullConfirmationRecord[]>([]);
  const [verifications, setVerifications] = useState<ScanVerificationRecord[]>([]);
  const [scans, setScans] = useState<QrScanRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function handleLookup(event?: FormEvent) {
    event?.preventDefault();

    const term = query.trim();
    if (!term) {
      setError('Enter an item number, location, or document number to search.');
      return;
    }

    setStatus('');
    setError('');
    setIsWorking(true);

    try {
      if (searchMode === 'item') {
        const [record, pullRows, verificationRows, scanRows] = await Promise.all([
          getItemMasterRecord(term),
          listPullConfirmationsByItem(term),
          listRecentScanVerificationsByItem(term),
          listRecentQrScansByItem(term),
        ]);

        setItemRecord(record);
        setItemMatches(record ? [record] : []);
        setPulls(pullRows);
        setVerifications(verificationRows);
        setScans(scanRows);
        setStatus(record ? `Loaded item ${record.item} from item master.` : `No item master record found for ${term}.`);
      }

      if (searchMode === 'location') {
        const [matches, pullRows, verificationRows, scanRows] = await Promise.all([
          listItemMasterRecordsByLocation(term),
          listPullConfirmationsByLocation(term),
          listRecentScanVerificationsByLocation(term),
          listRecentQrScansByLocation(term),
        ]);

        setItemRecord(matches[0] ?? null);
        setItemMatches(matches);
        setPulls(pullRows);
        setVerifications(verificationRows);
        setScans(scanRows);
        setStatus(`Loaded ${matches.length} item master record(s) for location ${term.toUpperCase()}.`);
      }

      if (searchMode === 'document') {
        const [pullRows, verificationRows, scanRows] = await Promise.all([
          listPullConfirmationsByDocument(term),
          listRecentScanVerificationsByDocument(term),
          listRecentQrScansByDocument(term),
        ]);

        setItemRecord(null);
        setItemMatches([]);
        setPulls(pullRows);
        setVerifications(verificationRows);
        setScans(scanRows);
        setStatus(`Loaded document activity for ${term}.`);
      }
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to search inventory lookup.');
    } finally {
      setIsWorking(false);
    }
  }

  const signals = useMemo(() => deriveSignals(itemRecord, itemMatches, pulls, verifications), [itemMatches, itemRecord, pulls, verifications]);
  const openPulls = pullConfirmations.filter((record) => record.active).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Fast Lookup"
        title="Inventory Lookup"
        description="Search item master, pull confirmations, recent scan verifications, and QR scan history by item number, location, or document number."
      />

      <section className="stat-grid">
        <StatCard label="Active Pulls" value={`${openPulls}`} helper="Current inventory-facing confirmations" />
        <StatCard label="Lookup Signals" value={`${signals.length}`} helper="Pulled, wrong, short, and review indicators" />
        <StatCard label="Verifications" value={`${verifications.length}`} helper="Recent matching verification rows" />
        <StatCard label="QR Scans" value={`${scans.length}`} helper="Recent scan history rows for the current search" />
      </section>

      <SectionCard title="Inventory Search" description="Search by item number, location, or document number without calling external systems.">
        <form className="stack-form" onSubmit={(event) => void handleLookup(event)}>
          <div className="inline-form-grid">
            <label>
              <span>Search By</span>
              <select className="text-input" value={searchMode} onChange={(event) => setSearchMode(event.target.value as SearchMode)}>
                <option value="item">Item #</option>
                <option value="location">Location</option>
                <option value="document">Document #</option>
              </select>
            </label>
            <label>
              <span>Search Value</span>
              <input
                className="text-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchMode === 'item' ? '552103' : searchMode === 'location' ? 'A-02-2' : 'SXFR123456'}
              />
            </label>
          </div>
          {status ? <div className="verification-banner success">{status}</div> : null}
          {error ? <div className="verification-banner danger">{error}</div> : null}
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={isWorking}>
              {isWorking ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="split-layout">
        <SectionCard title="Item Master Result" description="Item Availability.xlsx records stored in Firestore itemMaster.">
          {searchMode === 'item' && itemRecord ? (
            <div className="stack-form">
              <div className="detail-grid">
                <div>
                  <dt>Item</dt>
                  <dd>{itemRecord.item}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{itemRecord.description || '—'}</dd>
                </div>
                <div>
                  <dt>Available Qty</dt>
                  <dd>{itemRecord.availableQty}</dd>
                </div>
                <div>
                  <dt>Default Location</dt>
                  <dd>{itemRecord.defaultLocation || '—'}</dd>
                </div>
                <div>
                  <dt>Bin Location</dt>
                  <dd>{itemRecord.binLocation || '—'}</dd>
                </div>
                <div>
                  <dt>UOM</dt>
                  <dd>{itemRecord.uom || '—'}</dd>
                </div>
              </div>
            </div>
          ) : searchMode === 'location' ? (
            <DataTable
              rows={itemMatches}
              emptyMessage="No item master rows matched the location search."
              columns={[
                { key: 'item', label: 'Item', render: (row) => row.item },
                { key: 'description', label: 'Description', render: (row) => row.description || '—' },
                { key: 'availableQty', label: 'Available Qty', render: (row) => row.availableQty },
                { key: 'defaultLocation', label: 'Default Location', render: (row) => row.defaultLocation || '—' },
                { key: 'binLocation', label: 'Bin', render: (row) => row.binLocation || '—' },
              ]}
            />
          ) : (
            <div className="empty-state">
              {searchMode === 'document'
                ? 'Document searches focus on pulls, verifications, and QR scans.'
                : 'Search an item number or location to load item master results.'}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Signals" description="Fast badges for pulled, wrong, short, and review states.">
          <div className="chip-grid">
            {signals.map((signal) => (
              <StatusBadge key={signal.label} status={signal.label} toneOverride={signal.tone} />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Active Pull Confirmations" description="Pulls already sent to inventory for the current search.">
        <DataTable
          rows={pulls}
          emptyMessage="No pull confirmations matched the current search."
          columns={[
            { key: 'documentNumber', label: 'Document #', render: (row) => row.documentNumber || '—' },
            { key: 'item', label: 'Item', render: (row) => row.item },
            { key: 'location', label: 'Location', render: (row) => row.location || '—' },
            { key: 'pickedQty', label: 'Picked Qty', render: (row) => row.pickedQty },
            { key: 'inventoryStatus', label: 'Inventory Status', render: (row) => <StatusBadge status={row.inventoryStatus} /> },
            { key: 'updatedAt', label: 'Updated', render: (row) => (row.updatedAt ? formatDateTime(row.updatedAt) : '—') },
          ]}
        />
      </SectionCard>

      <div className="split-layout">
        <SectionCard title="Recent Scan Verifications" description="Item and location verification history for the current search.">
          <DataTable
            rows={verifications}
            emptyMessage="No verification history matched the current search."
            columns={[
              { key: 'createdAt', label: 'Verified', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
              { key: 'expectedItem', label: 'Expected Item', render: (row) => row.expectedItem || '—' },
              { key: 'scannedItem', label: 'Scanned Item', render: (row) => row.scannedItem || '—' },
              { key: 'scannedLocation', label: 'Scanned Location', render: (row) => row.scannedLocation || '—' },
              { key: 'result', label: 'Verify Result', render: (row) => <div className="table-note">{row.overallResult}</div> },
            ]}
          />
        </SectionCard>

        <SectionCard title="Recent QR Scans" description="Captured QR scan history for audit visibility.">
          <DataTable
            rows={scans}
            emptyMessage="No QR scan history matched the current search."
            columns={[
              { key: 'createdAt', label: 'Scanned', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
              { key: 'sourceModule', label: 'Module', render: (row) => row.sourceModule || '—' },
              { key: 'item', label: 'Item', render: (row) => row.item || '—' },
              { key: 'location', label: 'Location', render: (row) => row.location || '—' },
              { key: 'result', label: 'Result', render: (row) => <StatusBadge status={row.result || 'Captured'} /> },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}

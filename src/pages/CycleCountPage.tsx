import { useEffect, useMemo, useState } from 'react';
import CameraScanner from '../components/qr/CameraScanner';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { getItemMasterRecord } from '../lib/item-master';
import { downloadCsv, recordQrScan, saveCycleCountSession } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';
import { createId, parseQrScan } from '../utils/qr';
import type { CycleCountLine, CycleCountSession } from '../types';

function createCycleLine(lineNumber: number, location = ''): CycleCountLine {
  return {
    id: createId(`cycle-${lineNumber}`),
    lineNumber,
    item: '',
    description: '',
    location,
    systemQty: 0,
    countedQty: 0,
    variance: 0,
    reason: 'Count Verified',
    warning: '',
    done: false,
  };
}

function buildInitialLines(activeLocation = '') {
  return Array.from({ length: 8 }, (_, index) => createCycleLine(index + 1, activeLocation));
}

export default function CycleCountPage() {
  const { currentUser, cycleCountSessions, firebaseReady } = useERP();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [countId, setCountId] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [manualScan, setManualScan] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [lines, setLines] = useState<CycleCountLine[]>(() => buildInitialLines());
  const [selectedLineId, setSelectedLineId] = useState<string>('');

  const selectedLine = useMemo(() => lines.find((line) => line.id === selectedLineId) ?? lines[0] ?? null, [lines, selectedLineId]);
  const usedLines = lines.filter((line) => line.item || line.location || line.systemQty || line.countedQty).length;
  const varianceLines = lines.filter((line) => line.variance !== 0 && (line.item || line.location)).length;

  function updateLine(lineId: string, updater: (line: CycleCountLine) => CycleCountLine) {
    setLines((previous) => previous.map((line) => (line.id === lineId ? updater(line) : line)));
  }

  function addRow() {
    setLines((previous) => [...previous, createCycleLine(previous.length + 1, activeLocation)]);
  }

  useEffect(() => {
    if (!selectedLineId && lines[0]) {
      setSelectedLineId(lines[0].id);
      return;
    }

    if (selectedLineId && !lines.some((line) => line.id === selectedLineId) && lines[0]) {
      setSelectedLineId(lines[0].id);
    }
  }, [lines, selectedLineId]);

  async function applyScan(rawValue: string, scanSource: 'camera' | 'manual') {
    if (!currentUser || !selectedLine) {
      return;
    }

    const parsed = parseQrScan(rawValue);

    if (parsed.parsedType === 'unknown') {
      setError('The scanned QR value was not recognized as a location label or item label.');
      return;
    }

    setStatus('');
    setError('');

    if (parsed.parsedType === 'location') {
      setActiveLocation(parsed.location);
      updateLine(selectedLine.id, (line) => ({
        ...line,
        location: line.location || parsed.location,
      }));
      setStatus(`Active location set to ${parsed.location}. New rows will auto-fill this location.`);
    } else {
      const itemMaster = await getItemMasterRecord(parsed.item);
      const expectedLocation = itemMaster?.defaultLocation || itemMaster?.binLocation || '';
      const warning =
        activeLocation && expectedLocation && activeLocation.toUpperCase() !== expectedLocation.toUpperCase()
          ? `Warning: item master location is ${expectedLocation}, active location is ${activeLocation}.`
          : '';

      updateLine(selectedLine.id, (line) => ({
        ...line,
        item: parsed.item,
        description: itemMaster?.description || parsed.description || line.description,
        location: activeLocation || line.location,
        warning,
      }));
      setStatus(parsed.item ? `Item ${parsed.item} added to line ${selectedLine.lineNumber}.` : 'Item scan captured.');
    }

    if (firebaseReady) {
      await recordQrScan({
        rawValue,
        parsedType: parsed.parsedType,
        item: parsed.item,
        location: parsed.location || activeLocation,
        description: parsed.description,
        qty: parsed.qty,
        sourceModule: 'cycle-count',
        documentNumber: countId.trim(),
        sessionId: 'draft-cycle',
        expectedItem: '',
        expectedLocation: activeLocation,
        result: parsed.parsedType === 'location' ? 'Active location captured' : 'Cycle line captured',
        scanSource,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
      });
    }

    setManualScan('');
  }

  async function handleSave() {
    if (!currentUser) {
      return;
    }

    const used = lines
      .filter((line) => line.item || line.location || line.systemQty || line.countedQty)
      .map((line) => ({
        ...line,
        variance: line.countedQty - line.systemQty,
      }));

    if (!used.length) {
      setError('Enter or scan at least one cycle count line.');
      return;
    }

    setIsWorking(true);
    setStatus('');
    setError('');

    try {
      const session: CycleCountSession = {
        id: createId('cycle-session'),
        counter: currentUser.name,
        date,
        countId: countId.trim(),
        activeLocation,
        lines: used,
        lineCount: used.length,
        varianceLines: used.filter((line) => line.variance !== 0).length,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
      };

      await saveCycleCountSession(session);
      setStatus(`Saved cycle count session with ${used.length} row(s).`);
      setLines(buildInitialLines(activeLocation));
      setCountId('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the cycle count session.');
    } finally {
      setIsWorking(false);
    }
  }

  function handleExportCsv() {
    const used = lines.filter((line) => line.item || line.location || line.systemQty || line.countedQty);

    downloadCsv(
      used.map((line) => ({
        lineNumber: line.lineNumber,
        item: line.item,
        description: line.description,
        location: line.location,
        systemQty: line.systemQty,
        countedQty: line.countedQty,
        variance: line.countedQty - line.systemQty,
        reason: line.reason,
        warning: line.warning,
        date,
        countId,
      })),
      `cycle-count-${date}.csv`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventory Accuracy"
        title="Cycle Count"
        description="Scan a location QR first to set the active location, then scan item labels into new count rows with location mismatch warnings from item master."
      />

      <section className="stat-grid">
        <StatCard label="Active Location" value={activeLocation || '—'} helper="Set from a location QR scan" />
        <StatCard label="Used Rows" value={`${usedLines}`} helper="Cycle count rows with captured data" />
        <StatCard label="Variance Rows" value={`${varianceLines}`} helper="Rows where counted qty differs from system qty" />
        <StatCard label="Saved Sessions" value={`${cycleCountSessions.length}`} helper="Historical cycle count sessions in Firestore" />
      </section>

      <div className="split-layout">
        <SectionCard title="Cycle Count Scan Panel" description="Location scans set the active location. Item scans fill the selected row.">
          <div className="stack-form">
            <div className="inline-form-grid">
              <label>
                <span>Count ID</span>
                <input className="text-input" value={countId} onChange={(event) => setCountId(event.target.value)} placeholder="CC-2026-05-14-A02" />
              </label>
              <label>
                <span>Date</span>
                <input className="text-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>

            <div className="verification-banner info">Active Location: {activeLocation || 'Scan a location label to start.'}</div>

            {selectedLine ? (
              <div className="detail-grid">
                <div>
                  <dt>Selected Line</dt>
                  <dd>{selectedLine.lineNumber}</dd>
                </div>
                <div>
                  <dt>Item</dt>
                  <dd>{selectedLine.item || '—'}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{selectedLine.description || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selectedLine.location || activeLocation || '—'}</dd>
                </div>
              </div>
            ) : null}

            <CameraScanner onScan={(value) => void applyScan(value, 'camera')} />

            <label>
              <span>Manual scan value</span>
              <textarea
                className="text-input"
                rows={5}
                value={manualScan}
                onChange={(event) => setManualScan(event.target.value)}
                placeholder='Paste {"type":"item_label", ...} or LOC:A-02-2'
              />
            </label>

            {status ? <div className="verification-banner success">{status}</div> : null}
            {error ? <div className="verification-banner danger">{error}</div> : null}

            <div className="button-row">
              <button className="primary-button" type="button" disabled={!manualScan.trim()} onClick={() => void applyScan(manualScan, 'manual')}>
                Apply Manual Scan
              </button>
              <button className="secondary-button" type="button" onClick={addRow}>
                Add Row
              </button>
              <button className="secondary-button" type="button" disabled={!usedLines} onClick={handleExportCsv}>
                Export CSV
              </button>
              <button className="secondary-button" type="button" disabled={!currentUser || isWorking} onClick={() => void handleSave()}>
                {isWorking ? 'Saving...' : 'Save Cycle Count'}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Cycle Count Worksheet" description="Edit quantities and reasons before saving the session.">
          <DataTable
            rows={lines}
            emptyMessage="No cycle count rows are available."
            columns={[
              {
                key: 'line',
                label: 'Line',
                render: (row) => (
                  <button className="chip-button" type="button" onClick={() => setSelectedLineId(row.id)}>
                    {selectedLineId === row.id ? `Line ${row.lineNumber}` : `Select ${row.lineNumber}`}
                  </button>
                ),
              },
              { key: 'item', label: 'Item', render: (row) => row.item || '—' },
              { key: 'description', label: 'Description', render: (row) => row.description || '—' },
              { key: 'location', label: 'Location', render: (row) => row.location || activeLocation || '—' },
              {
                key: 'systemQty',
                label: 'System Qty',
                render: (row) => (
                  <input
                    className="table-input"
                    type="number"
                    value={row.systemQty}
                    onChange={(event) =>
                      updateLine(row.id, (line) => ({
                        ...line,
                        systemQty: Number(event.target.value || 0),
                        variance: line.countedQty - Number(event.target.value || 0),
                      }))
                    }
                  />
                ),
              },
              {
                key: 'countedQty',
                label: 'Counted Qty',
                render: (row) => (
                  <input
                    className="table-input"
                    type="number"
                    value={row.countedQty}
                    onChange={(event) =>
                      updateLine(row.id, (line) => ({
                        ...line,
                        countedQty: Number(event.target.value || 0),
                        variance: Number(event.target.value || 0) - line.systemQty,
                      }))
                    }
                  />
                ),
              },
              { key: 'variance', label: 'Variance', render: (row) => row.variance },
              {
                key: 'reason',
                label: 'Reason',
                render: (row) => (
                  <select
                    className="table-input"
                    value={row.reason}
                    onChange={(event) =>
                      updateLine(row.id, (line) => ({
                        ...line,
                        reason: event.target.value,
                      }))
                    }
                  >
                    <option>Count Verified</option>
                    <option>Misplaced Inventory</option>
                    <option>Short Pick</option>
                    <option>Over Pick</option>
                    <option>Receiving Error</option>
                    <option>Putaway Error</option>
                    <option>Transfer Error</option>
                    <option>Damage</option>
                    <option>Recount Required</option>
                  </select>
                ),
              },
              { key: 'warning', label: 'Warning', render: (row) => row.warning ? <StatusBadge status={row.warning} /> : '—' },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Recent Cycle Count Sessions" description="Saved Firestore cycle count sessions from the unified warehouse app.">
        <DataTable
          rows={cycleCountSessions.slice(0, 12)}
          emptyMessage="No cycle count sessions have been saved yet."
          columns={[
            { key: 'date', label: 'Date', render: (row) => row.date || '—' },
            { key: 'counter', label: 'Counter', render: (row) => row.counter || '—' },
            { key: 'countId', label: 'Count ID', render: (row) => row.countId || '—' },
            { key: 'activeLocation', label: 'Active Location', render: (row) => row.activeLocation || '—' },
            { key: 'lineCount', label: 'Lines', render: (row) => row.lineCount },
            { key: 'varianceLines', label: 'Variance Lines', render: (row) => row.varianceLines },
            { key: 'createdAt', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
          ]}
        />
      </SectionCard>
    </div>
  );
}

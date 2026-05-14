import { useState } from 'react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';
import { saveLocationLabels } from '../lib/warehouse-store';
import { printLocationLabels } from '../utils/printing';
import { buildLocationQrValue, normalizeLocation, toQrDataUrl } from '../utils/qr';
import type { LocationLabelRecord } from '../types';

function padBay(value: string) {
  return value.padStart(2, '0');
}

export default function LocationLabelsPage() {
  const { currentUser, firebaseReady, locations, isLeadOrAdmin } = useERP();
  const [aisle, setAisle] = useState('A');
  const [bay, setBay] = useState('02');
  const [startLevel, setStartLevel] = useState('1');
  const [endLevel, setEndLevel] = useState('7');
  const [generatedRows, setGeneratedRows] = useState<LocationLabelRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  function handleGenerate() {
    setStatus('');
    setError('');

    const normalizedAisle = aisle.trim().toUpperCase();
    const normalizedBay = padBay(bay.trim());
    const start = Number(startLevel);
    const end = Number(endLevel);

    if (!normalizedAisle || !normalizedBay || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      setError('Enter a valid aisle, bay, start level, and end level.');
      return;
    }

    const rows: LocationLabelRecord[] = [];

    for (let level = start; level <= end; level += 1) {
      const location = normalizeLocation(`${normalizedAisle}-${normalizedBay}-${level}`);
      rows.push({
        id: location,
        location,
        qrValue: buildLocationQrValue(location),
        aisle: normalizedAisle,
        bay: normalizedBay,
        level: String(level),
        active: true,
        createdBy: currentUser?.uid ?? '',
        createdByEmail: currentUser?.email ?? '',
      });
    }

    setGeneratedRows(rows);
    setStatus(`Generated ${rows.length} location label(s).`);
  }

  async function handleSave() {
    if (!currentUser || !generatedRows.length) {
      return;
    }

    setIsWorking(true);
    setStatus('');
    setError('');

    try {
      const saved = await saveLocationLabels(generatedRows, currentUser);
      setStatus(`Saved ${saved} location label(s) to Firestore locations.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the location labels.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePrint() {
    if (!generatedRows.length) {
      return;
    }

    const printable = await Promise.all(
      generatedRows.map(async (row) => ({
        title: row.location,
        subtitle: row.qrValue,
        details: [`Aisle ${row.aisle}`, `Bay ${row.bay}`, `Level ${row.level}`],
        qrImageSrc: await toQrDataUrl(row.qrValue, 280),
      })),
    );

    printLocationLabels(printable);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Warehouse Bins"
        title="Location QR Labels"
        description="Generate location ranges such as A-02-1 through A-02-7, save them into Firestore locations, and print large location labels."
      />

      <SectionCard title="Location Range Generation" description="Generate a label set from an aisle, bay, and level range.">
        <div className="stack-form">
          <div className="inline-form-grid">
            <label>
              <span>Aisle</span>
              <input className="text-input" value={aisle} onChange={(event) => setAisle(event.target.value)} placeholder="A" />
            </label>
            <label>
              <span>Bay</span>
              <input className="text-input" value={bay} onChange={(event) => setBay(event.target.value)} placeholder="02" />
            </label>
            <label>
              <span>Start Level</span>
              <input className="text-input" type="number" min="1" value={startLevel} onChange={(event) => setStartLevel(event.target.value)} />
            </label>
            <label>
              <span>End Level</span>
              <input className="text-input" type="number" min="1" value={endLevel} onChange={(event) => setEndLevel(event.target.value)} />
            </label>
          </div>

          {status ? <div className="info-banner success-banner">{status}</div> : null}
          {error ? <div className="info-banner danger-banner">{error}</div> : null}

          <div className="button-row">
            <button className="primary-button" type="button" onClick={handleGenerate}>
              Generate Range
            </button>
            <button className="secondary-button" type="button" disabled={!generatedRows.length} onClick={() => void handlePrint()}>
              Print Large Location Labels
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!generatedRows.length || !currentUser || !firebaseReady || !isLeadOrAdmin || isWorking}
              onClick={() => void handleSave()}
            >
              {isWorking ? 'Saving...' : 'Save to Firestore'}
            </button>
          </div>
          {!isLeadOrAdmin ? <div className="info-banner warning-banner">Lead or admin access is required to save location labels.</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="Generated Preview" description="Preview the generated location QR values before saving or printing.">
        <DataTable
          rows={generatedRows}
          emptyMessage="Generate a location range to preview labels."
          columns={[
            { key: 'location', label: 'Location', render: (row) => row.location },
            { key: 'qrValue', label: 'QR Value', render: (row) => row.qrValue },
            { key: 'aisle', label: 'Aisle', render: (row) => row.aisle },
            { key: 'bay', label: 'Bay', render: (row) => row.bay },
            { key: 'level', label: 'Level', render: (row) => row.level },
          ]}
        />
      </SectionCard>

      <SectionCard title="Saved Location Labels" description="Latest Firestore locations records already available to the warehouse team.">
        <DataTable
          rows={locations.slice(0, 30)}
          emptyMessage="No location labels are saved yet."
          columns={[
            { key: 'location', label: 'Location', render: (row) => row.location },
            { key: 'qrValue', label: 'QR Value', render: (row) => row.qrValue },
            { key: 'aisle', label: 'Aisle', render: (row) => row.aisle || '—' },
            { key: 'bay', label: 'Bay', render: (row) => row.bay || '—' },
            { key: 'level', label: 'Level', render: (row) => row.level || '—' },
          ]}
        />
      </SectionCard>
    </div>
  );
}

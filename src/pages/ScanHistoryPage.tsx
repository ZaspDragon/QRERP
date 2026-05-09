import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';
import { qrTypes } from '../types';

export default function ScanHistoryPage() {
  const [searchParams] = useSearchParams();
  const { scanHistory } = useERP();
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? 'ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const highlightScan = searchParams.get('scan');

  const filteredRows = scanHistory.filter((row) => {
    const passesType = typeFilter === 'ALL' || row.qrType === typeFilter;
    if (!passesType) {
      return false;
    }

    if (dateFilter === 'ALL') {
      return true;
    }

    const daysBack = Number(dateFilter);
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    return new Date(row.timestamp).getTime() >= cutoff;
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Audit Trail"
        title="Scan history"
        description="Every scan is stored in localStorage with timestamp, QR type, value, action, status, and user, plus optional notes for workflow follow-up."
      />

      <SectionCard title="Filters" description="Slice the history by type and recent date window.">
        <div className="filter-bar">
          <label>
            <span>QR Type</span>
            <select className="text-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="ALL">All types</option>
              {qrTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date Range</span>
            <select className="text-input" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
              <option value="ALL">All dates</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Saved scans" description={`${filteredRows.length} records shown.`}>
        <DataTable
          rows={filteredRows}
          columns={[
            { key: 'time', label: 'Timestamp', render: (row) => formatDateTime(row.timestamp) },
            { key: 'type', label: 'QR Type', render: (row) => row.qrType },
            {
              key: 'value',
              label: 'Value',
              render: (row) => (
                <div className={row.id === highlightScan ? 'highlight-cell' : undefined}>
                  <strong>{row.displayValue}</strong>
                  {row.notes ? <span>{row.notes}</span> : null}
                </div>
              ),
            },
            { key: 'action', label: 'Action', render: (row) => row.action },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'user', label: 'User', render: (row) => row.user },
          ]}
        />
      </SectionCard>
    </div>
  );
}

import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { downloadCsv } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';

export default function HistoryPage() {
  const { activityLogs } = useERP();

  function handleExportCsv() {
    downloadCsv(
      activityLogs.map((row) => ({
        createdAt: row.createdAt ?? '',
        date: row.date,
        type: row.type,
        employee: row.employee,
        item: row.item,
        description: row.description,
        qty: row.qty,
        countedQty: row.countedQty,
        pickedQty: row.pickedQty,
        requiredQty: row.requiredQty,
        variance: row.variance,
        location: row.location,
        documentNumber: row.documentNumber,
        status: row.status,
        reason: row.reason,
        notes: row.notes,
      })),
      `warehouse-history-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Audit Trail"
        title="History"
        description="Merged warehouse activity history from put away, cycle count, and order picking with CSV export preserved from Warehouse Ops."
        actions={
          <button className="secondary-button" type="button" onClick={handleExportCsv} disabled={!activityLogs.length}>
            Export CSV
          </button>
        }
      />

      <SectionCard title="Warehouse Activity History" description="Every saved workflow session contributes audit rows here.">
        <DataTable
          rows={activityLogs}
          emptyMessage="No activity history has been saved yet."
          columns={[
            { key: 'createdAt', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
            { key: 'type', label: 'Type', render: (row) => row.type },
            { key: 'employee', label: 'Employee', render: (row) => row.employee || '—' },
            { key: 'item', label: 'Item', render: (row) => row.item || '—' },
            { key: 'qty', label: 'Qty', render: (row) => row.qty || row.pickedQty || row.countedQty || '—' },
            { key: 'location', label: 'Location', render: (row) => row.location || '—' },
            { key: 'document', label: 'Document #', render: (row) => row.documentNumber || '—' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || row.reason || 'Logged'} /> },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
          ]}
        />
      </SectionCard>
    </div>
  );
}

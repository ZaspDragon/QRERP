import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { downloadCsv, markPullConfirmationResolved } from '../lib/warehouse-store';
import { formatDateTime } from '../utils/format';

export default function PullConfirmationsPage() {
  const { currentUser, isLeadOrAdmin, pullConfirmations } = useERP();

  const activePulls = pullConfirmations.filter((pull) => pull.active);
  const recheckPulls = pullConfirmations.filter((pull) => pull.inventoryStatus === '⚠️ Needs Recheck');
  const resolvedPulls = pullConfirmations.filter((pull) => pull.inventoryStatus === '✔️ Resolved');

  async function handleResolve(id: string) {
    if (!currentUser || !isLeadOrAdmin) {
      return;
    }

    await markPullConfirmationResolved(id, currentUser);
  }

  function handleExportCsv() {
    downloadCsv(
      pullConfirmations.map((row) => ({
        id: row.id,
        documentNumber: row.documentNumber,
        item: row.item,
        description: row.description,
        location: row.location,
        pickedQty: row.pickedQty,
        inventoryStatus: row.inventoryStatus,
        active: row.active,
        notes: row.notes,
        createdAt: row.createdAt ?? '',
        updatedAt: row.updatedAt ?? '',
      })),
      `pull-confirmations-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventory Queue"
        title="Pull Confirmations"
        description="Inventory-facing view of checked pulls, recheck needs, and resolution state from order picking."
        actions={
          <button className="secondary-button" type="button" onClick={handleExportCsv} disabled={!pullConfirmations.length}>
            Export CSV
          </button>
        }
      />

      <section className="stat-grid">
        <StatCard label="Active Pulls" value={`${activePulls.length}`} helper="Currently open pull confirmations" />
        <StatCard label="Needs Recheck" value={`${recheckPulls.length}`} helper="Picked qty changed after a pull was sent" />
        <StatCard label="Resolved" value={`${resolvedPulls.length}`} helper="Closed out by lead or admin" />
      </section>

      <SectionCard title="Pull Confirmation Queue" description="Each row reflects the latest inventory-facing pull state.">
        <DataTable
          rows={pullConfirmations}
          emptyMessage="No pull confirmations have been created yet."
          columns={[
            { key: 'documentNumber', label: 'Document #', render: (row) => row.documentNumber },
            { key: 'item', label: 'Item', render: (row) => row.item },
            { key: 'description', label: 'Description', render: (row) => row.description || '—' },
            { key: 'location', label: 'Location', render: (row) => row.location || '—' },
            { key: 'pickedQty', label: 'Picked Qty', render: (row) => row.pickedQty },
            { key: 'status', label: 'Inventory Status', render: (row) => <StatusBadge status={row.inventoryStatus} /> },
            { key: 'updatedAt', label: 'Updated', render: (row) => (row.updatedAt ? formatDateTime(row.updatedAt) : '—') },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) =>
                row.active ? (
                  <button className="chip-button" type="button" disabled={!isLeadOrAdmin} onClick={() => void handleResolve(row.id)}>
                    Mark Resolved
                  </button>
                ) : (
                  <StatusBadge status="✔️ Resolved" />
                ),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}

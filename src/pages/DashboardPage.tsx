import { Link } from 'react-router-dom';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const {
    currentUser,
    employees,
    receivingLabels,
    locations,
    putAwayLogs,
    cycleCountSessions,
    orderPickingSessions,
    pullConfirmations,
    activityLogs,
  } = useERP();

  const activeEmployees = employees.filter((employee) => employee.active).length;
  const pendingRechecks = pullConfirmations.filter((pull) => pull.inventoryStatus === '⚠️ Needs Recheck').length;
  const activePulls = pullConfirmations.filter((pull) => pull.active).length;
  const recentActivity = activityLogs.slice(0, 10);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Unified Shell"
        title="Dashboard"
        description="One QR warehouse workspace for receiving, put away, cycle count, order picking, inventory lookup, pull confirmation, and history."
        actions={
          <div className="button-row">
            <Link className="primary-button" to="/order-picking">
              Open Order Picking
            </Link>
            <Link className="secondary-button" to="/receiving">
              Open Sticker Labels
            </Link>
          </div>
        }
      />

      <section className="stat-grid">
        <StatCard label="Receiving Labels" value={`${receivingLabels.length}`} helper="Saved sticker labels and receiving imports" />
        <StatCard label="Location Labels" value={`${locations.length}`} helper="Stored warehouse bin labels" />
        <StatCard label="Active Pulls" value={`${activePulls}`} helper={`${pendingRechecks} confirmation(s) need recheck`} />
        <StatCard label="Active Employees" value={`${activeEmployees}`} helper={currentUser ? `Signed in as ${currentUser.name}` : 'Waiting for sign-in'} />
      </section>

      <div className="split-layout">
        <SectionCard title="Module Snapshot" description="Recent workflow totals across the merged warehouse app.">
          <div className="dashboard-grid">
            <div className="dashboard-metric">
              <strong>{putAwayLogs.length}</strong>
              <span>Put Away Logs</span>
            </div>
            <div className="dashboard-metric">
              <strong>{cycleCountSessions.length}</strong>
              <span>Cycle Count Sessions</span>
            </div>
            <div className="dashboard-metric">
              <strong>{orderPickingSessions.length}</strong>
              <span>Order Picking Sessions</span>
            </div>
            <div className="dashboard-metric">
              <strong>{activityLogs.length}</strong>
              <span>Activity History Rows</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Quick Routing" description="Jump straight into the highest-traffic warehouse actions.">
          <div className="action-grid">
            <Link className="action-tile" to="/receiving">
              <strong>Receiving / Sticker Labels</strong>
              <span>Manual labels, bulk paste, PO/SPO/SXFR/XFR import, and item master import.</span>
            </Link>
            <Link className="action-tile" to="/putaway">
              <strong>Put Away</strong>
              <span>Scan item and location QR values, save put away logs, and keep dock-to-stock timing.</span>
            </Link>
            <Link className="action-tile" to="/cycle-count">
              <strong>Cycle Count</strong>
              <span>Scan the active location first, then fill count rows from item QR scans.</span>
            </Link>
            <Link className="action-tile" to="/inventory">
              <strong>Inventory Lookup</strong>
              <span>Search by item, location, or document without hitting live inventory systems.</span>
            </Link>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Recent Pull Confirmations" description="Inventory-facing pull status from verified picking work.">
        <DataTable
          rows={pullConfirmations.slice(0, 8)}
          emptyMessage="No pull confirmations have been saved yet."
          columns={[
            { key: 'document', label: 'Document #', render: (row) => row.documentNumber },
            { key: 'item', label: 'Item', render: (row) => row.item },
            { key: 'location', label: 'Location', render: (row) => row.location || '—' },
            { key: 'qty', label: 'Picked Qty', render: (row) => row.pickedQty },
            { key: 'status', label: 'Inventory Status', render: (row) => <StatusBadge status={row.inventoryStatus} /> },
            { key: 'updated', label: 'Updated', render: (row) => (row.updatedAt ? formatDateTime(row.updatedAt) : '—') },
          ]}
        />
      </SectionCard>

      <SectionCard title="Recent Activity" description="Warehouse activity logs saved from put away, cycle count, and order picking.">
        <DataTable
          rows={recentActivity}
          emptyMessage="No warehouse activity has been logged yet."
          columns={[
            { key: 'created', label: 'Created', render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : '—') },
            { key: 'type', label: 'Type', render: (row) => row.type },
            { key: 'employee', label: 'Employee', render: (row) => row.employee || '—' },
            { key: 'item', label: 'Item', render: (row) => row.item || '—' },
            { key: 'qty', label: 'Qty', render: (row) => row.qty || row.pickedQty || row.countedQty || '—' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || row.reason || 'Logged'} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useERP } from '../context/ERPContext';
import { formatCompactNumber, formatDateTime } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';

export default function DashboardPage() {
  const { items, receivingLoads, putawayTasks, cycleCounts, scanHistory, safetyReports } = useERP();
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = items.filter((item) => item.quantity <= item.reorderPoint).length;
  const openReceiving = receivingLoads.filter((load) => load.status !== 'Received').length;
  const activeTasks = putawayTasks.filter((task) => task.status !== 'Complete').length + cycleCounts.filter((task) => task.status !== 'Counted').length;
  const openSafety = safetyReports.filter((report) => report.status !== 'Resolved').length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="QR Legends ERP"
        title="Warehouse dashboard"
        description="Track inbound, storage, picking, shipping, and scan activity from a single mobile-first control tower."
        actions={
          <div className="button-row">
            <Link className="primary-button" to="/scanner">
              Open Scanner
            </Link>
            <Link className="secondary-button" to="/generator">
              Generate QR
            </Link>
          </div>
        }
      />

      <section className="stat-grid">
        <StatCard label="On-Hand Units" value={formatCompactNumber(totalUnits)} helper={`${lowStockCount} items below reorder point`} />
        <StatCard label="Open Receiving" value={`${openReceiving}`} helper="Loads awaiting receive or closeout" />
        <StatCard label="Active Tasks" value={`${activeTasks}`} helper="Putaway and count work in queue" />
        <StatCard label="Safety Follow-Up" value={`${openSafety}`} helper="Open mitigation and inspection items" />
      </section>

      <section className="action-grid">
        <Link className="action-tile" to="/receiving">
          <strong>Receiving</strong>
          <span>Review docks, inbound pallets, and OSD exceptions.</span>
        </Link>
        <Link className="action-tile" to="/inventory">
          <strong>Inventory</strong>
          <span>Check stock, bins, and pallet placement with large tablet-ready tables.</span>
        </Link>
        <Link className="action-tile" to="/order-picking">
          <strong>Order Picking</strong>
          <span>Launch wave and transfer tasks from routed QR scans.</span>
        </Link>
        <Link className="action-tile" to="/reports">
          <strong>Reports</strong>
          <span>See dock readiness, count health, and equipment utilization at a glance.</span>
        </Link>
      </section>

      <SectionCard title="Recent scan activity" description="Every scan and workflow event is retained in localStorage for this demo.">
        <DataTable
          rows={scanHistory.slice(0, 6)}
          columns={[
            { key: 'time', label: 'Timestamp', render: (row) => formatDateTime(row.timestamp) },
            { key: 'type', label: 'QR Type', render: (row) => row.qrType },
            { key: 'value', label: 'Value', render: (row) => row.displayValue },
            { key: 'action', label: 'Action', render: (row) => row.action },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'user', label: 'User', render: (row) => row.user },
          ]}
        />
      </SectionCard>
    </div>
  );
}

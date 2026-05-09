import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { formatCompactNumber, formatDateTime } from '../utils/format';

export default function InventoryPage() {
  const { items, bins, pallets } = useERP();
  const lowStockItems = items.filter((item) => item.quantity <= item.reorderPoint).length;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Storage"
        title="Inventory"
        description="Clean warehouse-friendly views for item stock, reserve bins, and pallets scanned from mobile devices."
      />

      <RouteWorkflowCard route="/inventory" />

      <section className="stat-grid">
        <StatCard label="Inventory Units" value={formatCompactNumber(totalUnits)} helper={`${items.length} demo SKUs loaded`} />
        <StatCard label="Low Stock" value={`${lowStockItems}`} helper="Items at or below reorder point" />
        <StatCard label="Tracked Bins" value={`${bins.length}`} helper="Open, tight, and audit-needed bins" />
        <StatCard label="Active Pallets" value={`${pallets.length}`} helper="Stored, inbound, or moving pallets" />
      </section>

      <SectionCard title="Item master" description="Use item and pallet QR codes to locate stock quickly.">
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

      <div className="split-layout">
        <SectionCard title="Bins" description="Warehouse-friendly storage view with occupancy.">
          <DataTable
            rows={bins}
            columns={[
              { key: 'bin', label: 'Bin', render: (row) => row.id },
              { key: 'zone', label: 'Zone', render: (row) => row.zone },
              { key: 'level', label: 'Level', render: (row) => row.level },
              { key: 'occupancy', label: 'Occupancy', render: (row) => `${row.occupancy}%` },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </SectionCard>

        <SectionCard title="Pallets" description="Latest pallet movement and availability.">
          <DataTable
            rows={pallets}
            columns={[
              { key: 'id', label: 'Pallet', render: (row) => row.id },
              { key: 'items', label: 'Items', render: (row) => row.itemCount },
              { key: 'location', label: 'Location', render: (row) => row.currentBinId },
              { key: 'moved', label: 'Last Move', render: (row) => formatDateTime(row.lastMove) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}

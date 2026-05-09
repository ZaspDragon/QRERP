import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';

export default function ShippingPage() {
  const { shipments } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Outbound Docks"
        title="Shipping"
        description="Monitor loading progress, trailer readiness, and carrier departure windows with warehouse-sized controls."
      />

      <section className="stat-grid">
        <StatCard label="Loading" value={`${shipments.filter((shipment) => shipment.status === 'Loading').length}`} helper="Trailers currently being loaded" />
        <StatCard label="Staged" value={`${shipments.filter((shipment) => shipment.status === 'Staged').length}`} helper="Orders staged at dock" />
        <StatCard label="Queued" value={`${shipments.filter((shipment) => shipment.status === 'Queued').length}`} helper="Upcoming trailer work" />
        <StatCard label="Orders" value={`${shipments.reduce((sum, shipment) => sum + shipment.orders, 0)}`} helper="Outbound orders scheduled today" />
      </section>

      <SectionCard title="Shipping wave board" description="Outbound execution aligned to dock timing.">
        <DataTable
          rows={shipments}
          columns={[
            { key: 'id', label: 'Shipment', render: (row) => row.id },
            { key: 'carrier', label: 'Carrier', render: (row) => row.carrier },
            { key: 'dock', label: 'Dock', render: (row) => row.dock },
            { key: 'trailer', label: 'Trailer', render: (row) => row.trailer },
            { key: 'departure', label: 'Departure', render: (row) => formatDateTime(row.departure) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';
import { formatDateTime } from '../utils/format';

export default function ReceivingPage() {
  const { receivingLoads } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inbound"
        title="Receiving"
        description="Manage inbound loads, dock assignments, and OSD follow-up from the same scan-driven workflow lane."
      />

      <RouteWorkflowCard route="/receiving" />

      <section className="stat-grid">
        <StatCard label="Scheduled Loads" value={`${receivingLoads.length}`} helper="Inbound loads on the board today" />
        <StatCard label="Expected" value={`${receivingLoads.filter((load) => load.status === 'Expected').length}`} helper="Ready for arrival and unload" />
        <StatCard label="In Progress" value={`${receivingLoads.filter((load) => load.status === 'In Progress').length}`} helper="Currently being received at dock" />
        <StatCard label="OSD Ready" value={`${receivingLoads.filter((load) => load.status === 'Blocked').length}`} helper="Loads needing discrepancy resolution" />
      </section>

      <SectionCard title="Receiving board" description="Use QR scans to start, complete, or escalate load work.">
        <DataTable
          rows={receivingLoads}
          columns={[
            { key: 'id', label: 'Load', render: (row) => row.id },
            { key: 'supplier', label: 'Supplier', render: (row) => row.supplier },
            { key: 'dock', label: 'Dock', render: (row) => row.dock },
            { key: 'eta', label: 'ETA', render: (row) => formatDateTime(row.eta) },
            { key: 'pallet', label: 'Pallet', render: (row) => row.palletId },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

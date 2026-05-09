import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';

export default function EquipmentPage() {
  const { equipment } = useERP();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Assets"
        title="Equipment"
        description="Track forklifts, scanners, printers, and support equipment with QR-driven status updates and label printing."
      />

      <RouteWorkflowCard route="/equipment" />

      <section className="stat-grid">
        <StatCard label="Ready" value={`${equipment.filter((item) => item.status === 'Ready').length}`} helper="Available for assignment" />
        <StatCard label="In Use" value={`${equipment.filter((item) => item.status === 'In Use').length}`} helper="Active on the floor" />
        <StatCard label="Charging" value={`${equipment.filter((item) => item.status === 'Charging').length}`} helper="Battery room or docked assets" />
        <StatCard label="Inspection" value={`${equipment.filter((item) => item.status === 'Inspection').length}`} helper="Needs follow-up before use" />
      </section>

      <SectionCard title="Equipment roster" description="Assign and manage operational assets.">
        <DataTable
          rows={equipment}
          columns={[
            { key: 'id', label: 'Asset', render: (row) => row.id },
            { key: 'name', label: 'Equipment', render: (row) => row.name },
            { key: 'type', label: 'Type', render: (row) => row.type },
            { key: 'battery', label: 'Battery', render: (row) => row.battery },
            { key: 'location', label: 'Location', render: (row) => row.location },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

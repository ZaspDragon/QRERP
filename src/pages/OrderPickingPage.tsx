import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RouteWorkflowCard from '../components/workflow/RouteWorkflowCard';
import { useERP } from '../context/ERPContext';

export default function OrderPickingPage() {
  const { orderPicks } = useERP();
  const totalLines = orderPicks.reduce((sum, task) => sum + task.lines, 0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Outbound Work"
        title="Order picking"
        description="Handle both order picks and transfer picks from the same routed workflow lane."
      />

      <RouteWorkflowCard route="/order-picking" />

      <section className="stat-grid">
        <StatCard label="Queued Picks" value={`${orderPicks.filter((task) => task.status === 'Queued').length}`} helper="Waiting for release" />
        <StatCard label="In Progress" value={`${orderPicks.filter((task) => task.status === 'In Progress').length}`} helper="Live pick work on the floor" />
        <StatCard label="Rush Orders" value={`${orderPicks.filter((task) => task.priority === 'Rush').length}`} helper="Priority customer demand" />
        <StatCard label="Lines to Pick" value={`${totalLines}`} helper="Total lines across demo waves" />
      </section>

      <SectionCard title="Pick queue" description="Order pick and transfer pick QR types both route to this module.">
        <DataTable
          rows={orderPicks}
          columns={[
            { key: 'id', label: 'Task', render: (row) => row.id },
            { key: 'mode', label: 'Mode', render: (row) => row.mode },
            { key: 'order', label: 'Order', render: (row) => row.orderId },
            { key: 'route', label: 'Route', render: (row) => row.route },
            { key: 'lines', label: 'Lines', render: (row) => row.lines },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';

const departments = [
  { path: '/receiving', title: 'Receiving', text: 'Upload the PO or transfer, review the freight, and print every QR sticker.' },
  { path: '/inventory', title: 'Inventory', text: 'Scan received freight into standard, bulk, or perishable slots.' },
  { path: '/order-picking', title: 'Transfers / Order Picking', text: 'Upload the pick ticket, scan the item and slot, and confirm the pull.' },
  { path: '/shipping', title: 'Shipping', text: 'Verify, load, and send branch freight with scannable labels attached.' },
];

export default function DashboardPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Four Departments · One Scan Flow"
        title="What are you working on?"
        description="The same QR freight label follows an item from receiving through storage, picking, shipping, and receipt at the next branch."
      />
      <div className="action-grid">
        {departments.map((department) => (
          <Link className="action-tile" to={department.path} key={department.path}>
            <strong>{department.title}</strong>
            <span>{department.text}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

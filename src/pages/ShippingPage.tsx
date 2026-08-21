import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

export default function ShippingPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Branch Shipping" title="Shipping" description="Verify branch-transfer freight, load it for the destination branch, and keep the QR label attached so the receiving branch can scan it in immediately." actions={<Link className="primary-button" to="/order-picking">Open Transfer Picking</Link>} />
      <div className="action-grid">
        <div className="action-tile"><strong>1. Pick</strong><span>Verify the item, quantity, and source slot.</span></div>
        <div className="action-tile"><strong>2. Verify</strong><span>Match each handling unit to its SXFR/XFR QR label.</span></div>
        <div className="action-tile"><strong>3. Load & Send</strong><span>Load the correct branch trailer with labels visible.</span></div>
        <div className="action-tile"><strong>4. Receive</strong><span>The destination scans the freight and puts it away.</span></div>
      </div>
      <div className="split-layout">
        <SectionCard title="Ship to Another Branch" description="Prepare and verify each shipment before loading."><div className="button-row"><Link className="primary-button" to="/order-picking">Start Transfer / Order Pick</Link><Link className="secondary-button" to="/pull-confirmations">Review Pulls</Link></div></SectionCard>
        <SectionCard title="Receive From Another Branch" description="Scan the same freight label into a standard, bulk, or perishable slot."><div className="button-row"><Link className="primary-button" to="/receiving">Receive Transfer</Link><Link className="secondary-button" to="/putaway">Scan Into Slot</Link></div></SectionCard>
      </div>
    </div>
  );
}

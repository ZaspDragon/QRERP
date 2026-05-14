import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useERP } from './context/ERPContext';
import CycleCountPage from './pages/CycleCountPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import HistoryPage from './pages/HistoryPage';
import InventoryPage from './pages/InventoryPage';
import LocationLabelsPage from './pages/LocationLabelsPage';
import LoginPage from './pages/LoginPage';
import OrderPickingPage from './pages/OrderPickingPage';
import PullConfirmationsPage from './pages/PullConfirmationsPage';
import PutawayPage from './pages/PutawayPage';
import ReceivingPage from './pages/ReceivingPage';

function LoadingPage() {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="verification-banner info">Loading QR Warehouse ERP...</div>
      </div>
    </div>
  );
}

export default function App() {
  const { authLoading, currentUser, signOut } = useERP();

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <AppShell currentUserName={currentUser.name} currentUserRole={currentUser.role} currentUserEmail={currentUser.email} onSignOut={signOut}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/receiving" element={<ReceivingPage />} />
        <Route path="/location-labels" element={<LocationLabelsPage />} />
        <Route path="/putaway" element={<PutawayPage />} />
        <Route path="/cycle-count" element={<CycleCountPage />} />
        <Route path="/order-picking" element={<OrderPickingPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pull-confirmations" element={<PullConfirmationsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  );
}

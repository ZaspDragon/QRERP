import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useERP } from './context/ERPContext';
import CycleCountPage from './pages/CycleCountPage';
import DashboardPage from './pages/DashboardPage';
import EquipmentPage from './pages/EquipmentPage';
import GeneratorPage from './pages/GeneratorPage';
import InventoryPage from './pages/InventoryPage';
import OrderPickingPage from './pages/OrderPickingPage';
import PutawayPage from './pages/PutawayPage';
import QRFlowsPage from './pages/QRFlowsPage';
import ReceivingPage from './pages/ReceivingPage';
import ReportsPage from './pages/ReportsPage';
import SafetyPage from './pages/SafetyPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import ScannerPage from './pages/ScannerPage';
import SettingsPage from './pages/SettingsPage';
import ShippingPage from './pages/ShippingPage';

export default function App() {
  const { currentUser, settings, activeScan } = useERP();

  return (
    <AppShell
      currentUserName={currentUser.name}
      siteName={settings.siteName}
      activeScanLabel={activeScan?.displayValue}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/qr-flows" element={<QRFlowsPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
        <Route path="/scan-history" element={<ScanHistoryPage />} />
        <Route path="/receiving" element={<ReceivingPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/putaway" element={<PutawayPage />} />
        <Route path="/cycle-count" element={<CycleCountPage />} />
        <Route path="/order-picking" element={<OrderPickingPage />} />
        <Route path="/shipping" element={<ShippingPage />} />
        <Route path="/safety" element={<SafetyPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  );
}

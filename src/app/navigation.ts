export interface NavigationItem {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const navigationItems: NavigationItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    shortLabel: 'Home',
    description: 'Warehouse KPIs and quick actions',
  },
  {
    path: '/qr-flows',
    label: 'QR Code Flows',
    shortLabel: 'Flows',
    description: 'Supported QR types and workflow routing',
  },
  {
    path: '/scanner',
    label: 'QR Scanner',
    shortLabel: 'Scan',
    description: 'Camera-based scanning and manual entry',
  },
  {
    path: '/generator',
    label: 'QR Labels / Item Master',
    shortLabel: 'Labels',
    description: 'Generate labels and manage imported item master data',
  },
  {
    path: '/scan-history',
    label: 'Scan History',
    shortLabel: 'History',
    description: 'Saved scans, actions, and filters',
  },
  {
    path: '/receiving',
    label: 'Receiving',
    shortLabel: 'Recv',
    description: 'Inbound loads, docks, and OSD actions',
  },
  {
    path: '/inventory',
    label: 'Inventory',
    shortLabel: 'Inv',
    description: 'Items, pallets, and storage bins',
  },
  {
    path: '/putaway',
    label: 'Putaway',
    shortLabel: 'Put',
    description: 'Directed putaway task queue',
  },
  {
    path: '/cycle-count',
    label: 'Cycle Count',
    shortLabel: 'Count',
    description: 'Scheduled counts and variance control',
  },
  {
    path: '/order-picking',
    label: 'Order Picking',
    shortLabel: 'Pick',
    description: 'Order and transfer picking work',
  },
  {
    path: '/shipping',
    label: 'Shipping',
    shortLabel: 'Ship',
    description: 'Outbound wave and trailer readiness',
  },
  {
    path: '/safety',
    label: 'Safety',
    shortLabel: 'Safe',
    description: 'Incident tracking and compliance follow-up',
  },
  {
    path: '/equipment',
    label: 'Equipment',
    shortLabel: 'Equip',
    description: 'Forklifts, scanners, and utilization',
  },
  {
    path: '/reports',
    label: 'Reports',
    shortLabel: 'Rpts',
    description: 'Performance snapshots and trends',
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'More',
    description: 'Demo users, preferences, and reset tools',
  },
];

export const mobilePrimaryPaths = ['/', '/scanner', '/inventory', '/receiving', '/reports'];

export function getNavigationLabel(pathname: string) {
  const match = navigationItems.find((item) => item.path === pathname);
  return match?.label ?? 'QR Legends ERP';
}

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
    description: 'Unified warehouse activity and quick actions',
  },
  {
    path: '/receiving',
    label: 'Receiving / Sticker Labels',
    shortLabel: 'Recv',
    description: 'Sticker labels, receiving imports, and item master',
  },
  {
    path: '/location-labels',
    label: 'Location QR Labels',
    shortLabel: 'Loc',
    description: 'Generate and print warehouse location labels',
  },
  {
    path: '/putaway',
    label: 'Put Away',
    shortLabel: 'Put',
    description: 'Scan-driven put away logs with dock-to-stock timing',
  },
  {
    path: '/cycle-count',
    label: 'Cycle Count',
    shortLabel: 'Count',
    description: 'Location-led counting and variance review',
  },
  {
    path: '/order-picking',
    label: 'Order Picking',
    shortLabel: 'Pick',
    description: 'Pick ticket verification, pull checks, and ticket finish',
  },
  {
    path: '/inventory',
    label: 'Inventory Lookup',
    shortLabel: 'Inv',
    description: 'Fast item, location, and document lookups',
  },
  {
    path: '/pull-confirmations',
    label: 'Pull Confirmations',
    shortLabel: 'Pulls',
    description: 'Inventory-facing pull queue and recheck status',
  },
  {
    path: '/employees',
    label: 'Employees',
    shortLabel: 'Team',
    description: 'Warehouse team roster and role visibility',
  },
  {
    path: '/history',
    label: 'History',
    shortLabel: 'Hist',
    description: 'Warehouse activity log and CSV export',
  },
];

export const mobilePrimaryPaths = ['/', '/receiving', '/putaway', '/order-picking', '/inventory'];

export function getNavigationLabel(pathname: string) {
  const match = navigationItems.find((item) => item.path === pathname);
  return match?.label ?? 'QR Warehouse ERP';
}

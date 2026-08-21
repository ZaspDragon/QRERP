export interface NavigationItem {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const navigationItems: NavigationItem[] = [
  { path: '/', label: 'Dashboard', shortLabel: 'Home', description: 'Choose a warehouse department' },
  { path: '/receiving', label: 'Receiving', shortLabel: 'Receive', description: 'Upload a PO or transfer and print every freight label' },
  { path: '/inventory', label: 'Inventory', shortLabel: 'Inventory', description: 'Scan freight into standard, bulk, or perishable slots' },
  { path: '/order-picking', label: 'Transfers / Order Picking', shortLabel: 'Pick', description: 'Pick orders and prepare branch transfers' },
  { path: '/shipping', label: 'Shipping', shortLabel: 'Ship', description: 'Verify, load, and send freight to another branch' },
];

export const mobilePrimaryPaths = ['/receiving', '/inventory', '/order-picking', '/shipping'];

export function getNavigationLabel(pathname: string) {
  const match = navigationItems.find((item) => item.path === pathname);
  return match?.label ?? 'QR Warehouse ERP';
}

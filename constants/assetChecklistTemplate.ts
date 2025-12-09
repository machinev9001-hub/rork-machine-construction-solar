import { ChecklistItem } from '@/types';

export const DEFAULT_ASSET_CHECKLIST_TEMPLATE: Omit<ChecklistItem, 'id' | 'completed' | 'completedAt' | 'completedBy'>[] = [
  { label: 'Fire Extinguishers available and to standard.', order: 1 },
  { label: 'First Aid Kit Available & to standard (sealed)', order: 2 },
  { label: "Tools, jack, wheel spanner and triangle's", order: 3 },
  { label: 'Wheel chocks available (N/A for tracked plant)', order: 4 },
  { label: 'Drip Tray (for mobile plant)', order: 5 },
  { label: 'Any visible damage on the body/structural work.', order: 6 },
  { label: 'Wipers functioning and free from defects', order: 7 },
  { label: 'Wind Screen free from defects', order: 8 },
  { label: "Road worthy disc (N/A on tracked plant/ADT's)", order: 9 },
  { label: 'Lights functioning and free from defects', order: 10 },
  { label: 'Indicators functioning and free from defects (N/A on tracked plant)', order: 11 },
  { label: 'Hooter functioning and free from defects', order: 12 },
  { label: 'Strobe Light', order: 13 },
  { label: 'Mirrors', order: 14 },
  { label: 'Brakes functioning and free from defects', order: 15 },
  { label: 'Check function of all instruments & controls', order: 16 },
  { label: 'Seats & Seat Belts (present & free from defects)', order: 17 },
  { label: 'Emergency stops identified (where applicable)', order: 18 },
  { label: 'Emergency stops working (where applicable)', order: 19 },
  { label: 'Hand brake functioning and free from defects', order: 20 },
  { label: 'Reverse alarm functioning and free from defects', order: 21 },
  { label: 'Reverse lights functioning and free from defects', order: 22 },
  { label: 'Fuel tank cap', order: 23 },
  { label: 'Tires in good condition; adequate thread; free from side wall cuts.( N/A on tracked plant)', order: 24 },
  { label: 'Wheel nuts secured and free from defects ( N/A on tracked plant)', order: 25 },
  { label: 'Check for any leaks.', order: 26 },
  { label: 'All moving parts properly guarded (where applicable)', order: 27 },
  { label: 'Grease Nipples & Pins', order: 28 },
  { label: 'Hydraulic Pipes', order: 29 },
  { label: 'Battery Terminals & Covers', order: 30 },
  { label: 'Walk ways, well-constructed, clean and free of obstacles.', order: 31 },
  { label: 'Hand rails provided and well-constructed.', order: 32 },
  { label: 'Lock out Procedure available.', order: 33 },
  { label: 'Tracks', order: 34 },
  { label: 'Hour / Tacho meter installed ensure it runs only when machine engine is running', order: 35 },
  { label: 'Time Sheet Book from Sub Contractor not Company owner if different', order: 36 },
];

export function generateChecklistFromTemplate(): ChecklistItem[] {
  return DEFAULT_ASSET_CHECKLIST_TEMPLATE.map((item, index) => ({
    id: `checklist-${Date.now()}-${index}`,
    label: item.label,
    completed: false,
    order: item.order,
  }));
}

export const INDUSTRY_SECTORS = [
  'Construction & Civils',
  'Mining',
  'Manufacturing',
  'Oil & Gas',
  'Renewable Energy',
  'Infrastructure',
  'Transportation & Logistics',
  'Agriculture',
  'Marine & Maritime',
  'Telecommunications',
  'Water & Utilities',
  'Forestry',
  'Healthcare Facilities',
  'Real Estate Development',
  'Aviation',
] as const;

export type IndustrySector = typeof INDUSTRY_SECTORS[number];

export const ALL_UNITS = [
  'mm', 'cm', 'm', 'km',
  'm²', 'm³',
  'L', 'kg', 't',
  'N', 'Pa', 'V', 'W',
  '°C', '°F',
  'Nos', 'Units', 'Qnty'
] as const;

export type Unit = typeof ALL_UNITS[number];

export const UNIT_LABELS: Record<Unit, string> = {
  'mm': 'Millimeter (mm)',
  'cm': 'Centimeter (cm)',
  'm': 'Meter (m)',
  'km': 'Kilometer (km)',
  'm²': 'Square meter (m²)',
  'm³': 'Cubic meter (m³)',
  'L': 'Liter (L)',
  'kg': 'Kilogram (kg)',
  't': 'Metric ton (t)',
  'N': 'Newton (N)',
  'Pa': 'Pascal (Pa)',
  'V': 'Volt (V)',
  'W': 'Watt (W)',
  '°C': 'Celsius (°C)',
  '°F': 'Fahrenheit (°F)',
  'Nos': 'Numbers (Nos)',
  'Units': 'Units',
  'Qnty': 'Quantity (Qnty)',
};


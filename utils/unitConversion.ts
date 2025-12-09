export type Unit = 'mm' | 'cm' | 'm' | 'km' | 'm²' | 'm³' | 'L' | 'kg' | 't' | 'N' | 'Pa' | 'V' | 'W' | '°C' | '°F' | 'Units' | 'Qnty';

export type Category = 'length' | 'area' | 'volume' | 'mass' | 'force' | 'pressure' | 'electric' | 'power' | 'temperature' | 'dimensionless';

const LENGTH_UNITS: Unit[] = ['mm', 'cm', 'm', 'km'];
const AREA_UNITS: Unit[] = ['m²'];
const VOLUME_UNITS: Unit[] = ['m³', 'L'];
const MASS_UNITS: Unit[] = ['kg', 't'];
const FORCE_UNITS: Unit[] = ['N'];
const PRESSURE_UNITS: Unit[] = ['Pa'];
const ELECTRIC_UNITS: Unit[] = ['V'];
const POWER_UNITS: Unit[] = ['W'];
const TEMPERATURE_UNITS: Unit[] = ['°C', '°F'];
const DIMENSIONLESS_UNITS: Unit[] = ['Units', 'Qnty'];

export function getCategory(unit: Unit): Category {
  if (LENGTH_UNITS.includes(unit)) return 'length';
  if (AREA_UNITS.includes(unit)) return 'area';
  if (VOLUME_UNITS.includes(unit)) return 'volume';
  if (MASS_UNITS.includes(unit)) return 'mass';
  if (FORCE_UNITS.includes(unit)) return 'force';
  if (PRESSURE_UNITS.includes(unit)) return 'pressure';
  if (ELECTRIC_UNITS.includes(unit)) return 'electric';
  if (POWER_UNITS.includes(unit)) return 'power';
  if (TEMPERATURE_UNITS.includes(unit)) return 'temperature';
  if (DIMENSIONLESS_UNITS.includes(unit)) return 'dimensionless';
  return 'dimensionless';
}

export function isCompatible(unit1: Unit, unit2: Unit): boolean {
  return getCategory(unit1) === getCategory(unit2);
}

export function normalize(value: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return value;
  
  if (!isCompatible(fromUnit, toUnit)) {
    console.warn(`Cannot convert between incompatible units: ${fromUnit} -> ${toUnit}`);
    return value;
  }

  if (fromUnit === 'mm' && toUnit === 'cm') return value / 10;
  if (fromUnit === 'mm' && toUnit === 'm') return value / 1000;
  if (fromUnit === 'mm' && toUnit === 'km') return value / 1000000;
  if (fromUnit === 'cm' && toUnit === 'mm') return value * 10;
  if (fromUnit === 'cm' && toUnit === 'm') return value / 100;
  if (fromUnit === 'cm' && toUnit === 'km') return value / 100000;
  if (fromUnit === 'm' && toUnit === 'mm') return value * 1000;
  if (fromUnit === 'm' && toUnit === 'cm') return value * 100;
  if (fromUnit === 'm' && toUnit === 'km') return value / 1000;
  if (fromUnit === 'km' && toUnit === 'mm') return value * 1000000;
  if (fromUnit === 'km' && toUnit === 'cm') return value * 100000;
  if (fromUnit === 'km' && toUnit === 'm') return value * 1000;

  if (fromUnit === 'm³' && toUnit === 'L') return value * 1000;
  if (fromUnit === 'L' && toUnit === 'm³') return value / 1000;

  if (fromUnit === 'kg' && toUnit === 't') return value / 1000;
  if (fromUnit === 't' && toUnit === 'kg') return value * 1000;

  if (fromUnit === '°C' && toUnit === '°F') return (value * 9/5) + 32;
  if (fromUnit === '°F' && toUnit === '°C') return (value - 32) * 5/9;

  return value;
}

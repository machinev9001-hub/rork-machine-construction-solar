export function normalizeRole(role: string | undefined | null): string {
  if (!role) return '';
  return role.trim().toLowerCase();
}

export function isManagementRole(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  const managementRoles = [
    'admin',
    'planner',
    'supervisor',
    'qc',
    'master',
    'hse',
    'hr',
    'plant manager',
    'surveyor',
    'staff manager',
    'logistics manager',
    'onboarding & inductions',
    'accounts'
  ];
  
  return managementRoles.includes(normalized);
}

export function roleMatches(role1: string | undefined | null, role2: string | undefined | null): boolean {
  return normalizeRole(role1) === normalizeRole(role2);
}

export function isOperatorRole(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'operator';
}

export function isDieselClerkRole(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'diesel clerk';
}

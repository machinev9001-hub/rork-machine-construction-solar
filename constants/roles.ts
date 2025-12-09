import { UserRole } from '@/types';

export type RoleTarget = 'employee' | 'user';

type RoleOption = {
  label: string;
  targets: RoleTarget[];
};

const ROLE_OPTIONS: RoleOption[] = [
  { label: 'General Worker', targets: ['employee', 'user'] },
  { label: 'Operator', targets: ['employee', 'user'] },
  { label: 'Supervisor', targets: ['employee', 'user'] },
  { label: 'Foreman', targets: ['employee', 'user'] },
  { label: 'Engineer', targets: ['employee', 'user'] },
  { label: 'Electrician', targets: ['employee', 'user'] },
  { label: 'Plumber', targets: ['employee', 'user'] },
  { label: 'Carpenter', targets: ['employee', 'user'] },
  { label: 'Welder', targets: ['employee', 'user'] },
  { label: 'Admin', targets: ['employee', 'user'] },
  { label: 'Planner', targets: ['employee', 'user'] },
  { label: 'QC', targets: ['employee', 'user'] },
  { label: 'Plant Manager', targets: ['employee', 'user'] },
  { label: 'Surveyor', targets: ['employee', 'user'] },
  { label: 'Staff Manager', targets: ['employee', 'user'] },
  { label: 'Logistics Manager', targets: ['employee', 'user'] },
  { label: 'HSE', targets: ['employee', 'user'] },
  { label: 'HR', targets: ['employee', 'user'] },
  { label: 'Accounts', targets: ['employee', 'user'] },
];

export const getRoleOptions = (target: RoleTarget): string[] =>
  ROLE_OPTIONS.filter((option) => option.targets.includes(target)).map((option) => option.label);

export const getEmployeeRoleOptions = (): string[] => getRoleOptions('employee');

export const getUserRoleOptions = (): UserRole[] => getRoleOptions('user') as UserRole[];

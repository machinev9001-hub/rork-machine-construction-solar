export interface SitePackUser {
  id: string;
  userId: string;
  name: string;
  role: string;
  roleGroup?: string;
  pin?: string;
  siteId?: string;
  siteName?: string;
  companyName?: string;
  masterAccountId?: string;
}

export interface SitePackPlant {
  id: string;
  plantNr: string;
  description: string;
  type?: string;
  category?: string;
  tachoType?: string;
  hireType?: string;
  costRate?: number;
  defaultSiteId?: string;
  defaultLocation?: string;
}

export interface SitePackActivity {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  defaultScope?: number;
}

export interface SitePackActivityInstance {
  id: string;
  taskId: string;
  name: string;
  mainMenuKey?: string;
  subMenuKey?: string;
  unit?: string;
  scopeValue: number;
  qcValue: number;
  scopeApproved: boolean;
  supervisorInputBy?: string;
  cablingHandoff?: boolean;
  terminationHandoff?: boolean;
}

export interface SitePackActivityTemplate {
  id: string;
  mainMenu: string;
  subMenu: string;
  activities: SitePackActivity[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description?: string;
  activityTypes: string[];
  isDefault?: boolean;
}

export interface BlockArea {
  id: string;
  name: string;
  pvAreaId: string;
  pvAreaName: string;
  siteId: string;
  rowConfigs: { row: string; columns: string[] }[];
  layoutTemplates?: LayoutTemplate[];
  createdAt: any;
}

export interface SitePackGeometry {
  pvAreas: string[];
  blockNumbers: string[];
  specialAreas: string[];
}

export interface SitePackTheme {
  themeMode: 'global' | 'per-ui';
  selectedTheme: string;
  uiThemes: { [uiKey: string]: string };
  customBackgroundColor?: string;
}

export interface SitePackSettings {
  siteId: string;
  siteName: string;
  timeZone?: string;
  workingHours?: {
    start: string;
    end: string;
  };
  weekdayMinHours?: number;
  weekendMinHours?: number;
  qcMandatory?: boolean;
}

export interface SitePack {
  version: number;
  siteId: string;
  generatedAt: string;
  users: SitePackUser[];
  plant: SitePackPlant[];
  activityTemplates: SitePackActivityTemplate[];
  activityInstances: SitePackActivityInstance[];
  geometry: SitePackGeometry;
  settings: SitePackSettings;
  theme?: SitePackTheme;
}

export interface SitePackMetadata {
  siteId: string;
  packVersion: number;
  packGeneratedAt: string;
  lastLoadedAt: string;
}

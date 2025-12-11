export type UserRole =
  | "Admin"
  | "Planner"
  | "Supervisor"
  | "QC"
  | "Operator"
  | "Plant Manager"
  | "Surveyor"
  | "Staff Manager"
  | "Logistics Manager"
  | "HSE"
  | "HR"
  | "Accounts"
  | "General Worker"
  | "Foreman"
  | "Engineer"
  | "Electrician"
  | "Plumber"
  | "Carpenter"
  | "Welder"
  | "master";

export type CompanySettings = {
  legalEntityName: string;
  alias: string;
  address: string;
  contact: string;
  adminContact: string;
  adminEmail: string;
  companyRegistrationNr: string;
  vatNr: string;
  plantTypes?: string[];
};

export type Company = {
  id: string;
  legalEntityName: string;
  alias: string;
  address: string;
  contactNumber: string;
  adminContact: string;
  adminEmail: string;
  companyRegistrationNr: string;
  vatNumber: string;
  industrySector: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
};

export type CompanyUser = {
  userId: string;
  companyId: string;
  role: UserRole;
  siteIds?: string[];
  addedAt: any;
  addedBy: string;
};

export type SubContractorUser = {
  id: string;
  userId: string;
  pin?: string;
  subContractorName: string;
  legalEntityName: string;
  userName?: string;
  directPersonalContactNr: string;
  adminContact: string;
  adminEmail: string;
  companyRegistrationNr: string;
  vatNr: string;
  role: UserRole;
  siteId: string;
  createdAt: any;
  createdBy: string;
  disabledMenus?: string[];
  isLocked?: boolean;
};

export type MasterAccount = {
  id: string;
  masterId: string;
  name: string;
  pin: string;
  companyIds: string[];
  currentCompanyId?: string;
  createdAt: any;
};

export type User = {
  id: string;
  userId: string;
  name: string;
  role: UserRole | 'master';
  companyIds: string[];
  currentCompanyId?: string;
  companyName?: string;
  companyContactMobile?: string;
  supervisorName?: string;
  supervisorMobile?: string;
  siteId?: string;
  siteName?: string;
  pin?: string;
  masterAccountId?: string;
  createdAt: any;
  isLocked?: boolean;
};

export type LatLon = {
  latitude: number;
  longitude: number;
};

export type FacePolicy = {
  minMatchScore: number;
  requireLiveness: boolean;
  allowOfflineMatch: boolean;
  maxGpsAccuracyMeters?: number;
};

export type Site = {
  id: string;
  name: string;
  companyId: string;
  masterAccountId: string;
  companySettings?: CompanySettings;
  description?: string;
  location?: string;
  status?: 'Active' | 'Inactive' | 'Archived' | 'Deleted';
  faceClockInEnabled?: boolean;
  faceGeoCenter?: LatLon;
  faceGeoRadiusKm?: number;
  facePolicy?: FacePolicy;
  createdAt: any;
  updatedAt?: any;
  deletedAt?: any;
};

export type RequestType =
  | 'TASK_REQUEST'
  | 'SCOPE_REQUEST'
  | 'ACTIVITY_SCOPE'
  | 'QC_REQUEST'
  | 'CABLING_REQUEST'
  | 'TERMINATION_REQUEST'
  | 'SURVEYOR_TASK'
  | 'HANDOVER_REQUEST'
  | 'CONCRETE_REQUEST'
  | 'LOGISTICS_REQUEST'
  | 'PLANT_REQUEST'
  | 'STAFF_REQUEST';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'scheduled';

export type ActivityStatus = 'LOCKED' | 'OPEN' | 'DONE' | 'HANDOFF_SENT';

export type ScopePolicy = 'NORMAL' | 'NONE';

export type CanonicalUnit = {
  canonical: string;
  setBy: string;
  setAt: any;
};

export type ScopeValue = {
  value: number;
  unit: string;
  setBy: string;
  setAt: any;
};

export type QCValue = {
  value?: number;
  unit?: string;
  completedAt?: any;
  completedBy?: string;
  status?: 'not_requested' | 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'rejected';
  lastRequestId?: string;
  lastUpdatedAt?: any;
  scheduledAt?: any;
};

export type ProgressEntry = {
  id?: string;
  supervisorId: string;
  enteredAt: any;
  raw: {
    value: number;
    unit: string;
  };
  normalized: {
    value: number;
    unit: string;
  };
  note?: string;
  source?: 'manual' | 'import' | 'sync';
};

export type InitTaskActivityParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
  siteId: string;
  masterAccountId: string;
  createdBy: string;
};

export type SubmitProgressParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
  supervisorId: string;
  value: number;
  unit: string;
  canonicalUnit: string;
  note?: string;
};

export type QCRequestParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
  requestedBy: string;
  siteId: string;
  masterAccountId: string;
  activityName: string;
};

export type QCValidationParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
  qcValue: number;
  qcUnit: string;
  canonicalUnit: string;
  validatedBy: string;
};

export type ClearInputParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
};

export type ProgressCalcParams = {
  scopeValue?: number;
  cumulativeProgress: number;
};

export type StatusParams = {
  taskId: string;
  subMenuKey: string;
  activityId: string;
};

export type CompletedTodayLock = {
  isLocked: boolean;
  lockType?: 'QC_INTERACTION' | 'TIME_LOCK';
  lockedAt?: any;
  lockedValue?: number;
  lockedUnit?: string;
  lockDate?: string;
  qcApprovedValue?: number;
  qcApprovedUnit?: string;
};

export type ActivityDetail = {
  id: string;
  name: string;
  status: ActivityStatus;
  scopePolicy: ScopePolicy;
  scopeValue?: ScopeValue;
  canonicalUnit?: CanonicalUnit;
  supervisorInputValue?: number;
  supervisorInputUnit?: string;
  supervisorInputAt?: any;
  supervisorInputBy?: string;
  supervisorInputLocked?: boolean;
  completedTodayLock?: CompletedTodayLock;
  cumulativeProgress: number;
  progressPercentage: number;
  qc?: QCValue;
  qcValue?: number;
  createdAt?: any;
  updatedAt?: any;
};

export type SurveyorTaskStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CLOSED';

export type SurveyorTask = {
  id?: string;
  taskId: string;
  siteId: string;
  createdByUserId: string;
  assignedSurveyorUserId?: string;
  status: SurveyorTaskStatus;
  pvArea: string;
  blockNumber: string;
  rowNr?: string;
  columnNr?: string;
  notes?: string;
  linkedImageIds?: string[];
  archived?: boolean;
  createdAt: any;
  updatedAt?: any;
};

export type SurveyorImageType = 'BASEMAP_OVERLAY' | 'DETAIL' | 'OTHER';

export type SurveyorImage = {
  id?: string;
  imageId: string;
  siteId: string;
  pvArea?: string;
  blockNumber?: string;
  rowNr?: string;
  columnNr?: string;
  sourceTaskId: string;
  imageUrl: string;
  storagePath: string;
  imageType: SurveyorImageType;
  description?: string;
  createdByUserId: string;
  createdAt: any;
  isActive: boolean;
  version?: number;
  replacesImageId?: string;
};

export type ImageShareStatus = 'PENDING' | 'VIEWED' | 'DOWNLOADED';

export type SharedImage = {
  id?: string;
  shareId: string;
  siteId: string;
  imageId: string;
  imageUrl: string;
  fileName: string;
  fileType: string;
  sharedByUserId: string;
  sharedByUserName: string;
  sharedToUserId: string;
  sharedToUserName: string;
  message?: string;
  status: ImageShareStatus;
  sharedAt: any;
  viewedAt?: any;
  downloadedAt?: any;
};

export type Attachment = {
  id: string;
  fileName: string;
  fileType: 'image' | 'document';
  mimeType: string;
  downloadUrl: string;
  storagePath: string;
  uploadedAt: any;
  uploadedBy: string;
  size?: number;
};

export type Subcontractor = {
  id?: string;
  name: string;
  legalEntityName?: string;
  contactPerson?: string;
  contactNumber?: string;
  adminEmail?: string;
  address?: string;
  companyRegistrationNr?: string;
  vatNumber?: string;
  linkedSites?: string[];
  linkedProjects?: string[];
  isCrossHire: boolean;
  crossHireName?: string;
  masterAccountId: string;
  siteId?: string;
  companyId?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  notes?: string;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
};

export type Employee = {
  id?: string;
  name: string;
  role: string;
  contact: string;
  email?: string;
  employeeIdNumber?: string;
  citizenshipCountry?: string;
  siteId: string;
  masterAccountId: string;
  companyId?: string;
  type?: 'employee' | 'subcontractor';
  subcontractorCompany?: string;
  employerName?: string;
  employerId?: string;
  employerType: 'company' | 'subcontractor';
  isCrossHire?: boolean;
  crossHireName?: string;
  inductionStatus: boolean;
  inductionDate?: any;
  inductionNotes?: string;
  attachments?: Attachment[];
  medicalExpiryDate?: any;
  licenseExpiryDate?: any;
  competencyExpiryDate?: any;
  pdpExpiryDate?: any;
  createdAt: any;
  updatedAt?: any;
};

export type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: any;
  completedBy?: string;
  order: number;
};

export type DailyChecklistEntry = {
  id?: string;
  assetId: string;
  assetType: string;
  date: string; // ISO date (YYYY-MM-DD)
  operatorId: string;
  operatorName: string;
  checklist: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  isFullyCompleted: boolean;
  notes?: string;
  siteId?: string;
  siteName?: string;
  masterAccountId: string;
  companyId?: string;
  submittedAt: any;
  createdAt: any;
  updatedAt?: any;
};

export type AllocationStatus = 'UNALLOCATED' | 'ALLOCATED' | 'IN_TRANSIT';

export type CurrentAllocation = {
  siteId: string;
  siteName?: string;
  allocatedAt: any;
  allocatedBy: string;
  pvArea?: string;
  blockArea?: string;
  requestId?: string;
  notes?: string;
};

export type AllocationHistoryEntry = {
  siteId: string;
  siteName?: string;
  allocatedAt: any;
  allocatedBy: string;
  deallocatedAt?: any;
  deallocatedBy?: string;
  notes?: string;
};

export type OperatorHistory = {
  operatorId: string;
  operatorName: string;
  operatorContact?: string;
  assignedAt: any;
  removedAt?: any;
  assignedBy: string;
  removedBy?: string;
  reason?: string; // Reason for operator change
};

export type PlantAssetTimesheet = {
  id?: string;
  assetId: string;
  date: string; // ISO date (YYYY-MM-DD)
  meterType?: 'HOUR_METER' | 'ODOMETER'; // Type of meter reading
  openHours: number; // Opening hour meter reading
  closeHours: number; // Closing hour meter reading
  totalHours: number; // Calculated (close - open)
  operatorId: string; // Current operator who entered
  operatorName: string; // Operator name for display
  logBreakdown: boolean; // Log breakdown for the day
  scheduledMaintenance: boolean; // Scheduled maintenance performed
  rainDay?: boolean; // Rain day flag
  strikeDay?: boolean; // Strike day flag
  hasAttachment?: boolean; // Has attachment flag
  inclementWeather: boolean; // Weather-related downtime
  weatherNotes?: string; // Weather details if applicable
  siteId?: string; // Current work site
  siteName?: string; // Site display name
  pvArea?: string; // PV area if applicable
  blockNumber?: string; // Block number if applicable
  notes?: string; // General notes
  masterAccountId: string;
  companyId?: string;
  verified?: boolean;
  verifiedAt?: any;
  verifiedBy?: string;
  hasAdjustment?: boolean;
  adjustmentId?: string;
  isAdjustment?: boolean;
  originalEntryId?: string;
  createdAt: any;
  updatedAt: any;
};

export type OperatorTimesheet = {
  id?: string;
  operatorId: string; // Employee ID
  operatorName: string; // Employee name
  date: string; // ISO date (YYYY-MM-DD)
  startTime: string; // HH:MM format
  stopTime: string; // HH:MM format
  lunchBreak: boolean; // Lunch break taken
  noLunchBreak?: boolean;
  totalManHours: number; // Calculated hours
  normalHours?: number;
  overtimeHours?: number;
  sundayHours?: number;
  publicHolidayHours?: number;
  siteId?: string; // Work site
  siteName?: string; // Site display name
  notes?: string; // Optional notes
  masterAccountId: string;
  companyId?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: any; // Submission time
  approvedBy?: string; // Approver ID
  approvedAt?: any; // Approval time
  approvalNotes?: string; // Approval/rejection notes
  verified?: boolean;
  verifiedAt?: any;
  verifiedBy?: string;
  hasAdjustment?: boolean;
  adjustmentId?: string;
  isAdjustment?: boolean;
  originalEntryId?: string;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  agreedNotes?: string;
  hasAgreedHours?: boolean;
  agreedTimesheetId?: string;
  createdAt: any;
  updatedAt: any;
};

export type AgreedTimesheet = {
  id: string;
  originalTimesheetId: string;
  timesheetType: 'operator' | 'plant_asset';
  date: string;
  operatorId?: string;
  operatorName?: string;
  assetId?: string;
  assetType?: string;
  originalHours: number;
  agreedHours: number;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  originalNormalHours?: number;
  originalOvertimeHours?: number;
  originalSundayHours?: number;
  originalPublicHolidayHours?: number;
  hoursDifference: number;
  originalNotes?: string;
  adminNotes?: string;
  siteId?: string;
  siteName?: string;
  masterAccountId: string;
  companyId?: string;
  subcontractorId?: string;
  subcontractorName?: string;
  status: 'approved_for_billing' | 'disputed' | 'rejected';
  agreedAt: any;
  agreedBy: string;
  approvedForBillingAt?: any;
  approvedForBillingBy?: string;
  createdAt: any;
  updatedAt: any;
};

export type PlantAssetOperatorHistory = {
  id?: string;
  assetId: string; // Plant asset ID
  assetType: string; // Asset type
  assetSiteId: string; // Asset site ID
  previousOperatorId?: string; // Previous operator ID
  previousOperatorName?: string; // Previous operator name
  newOperatorId: string; // New operator ID
  newOperatorName: string; // New operator name
  changeDate: any; // When change occurred
  changeReason: string; // Reason for change
  changedBy: string; // User who made change
  changedByName: string; // Name of user
  notes?: string; // Additional notes
  masterAccountId: string;
  companyId?: string;
  createdAt: any;
};

export type PlantAsset = {
  id?: string;
  assetId: string;
  type: string;
  typeId?: string;
  groupId?: string;
  location?: string;
  assignedJob?: string;
  assignedSite?: string;
  plantNumber?: string;
  registrationNumber?: string;
  subcontractor?: string;
  crossHire?: string;
  currentOperator?: string;
  currentOperatorId?: string;
  ownerName?: string;
  ownerId?: string;
  ownerType: 'company' | 'subcontractor';
  ownerProvince?: string;
  ownerAddress?: string;
  isCrossHire?: boolean;
  crossHireName?: string;
  salaryPayer?: string;
  operatorHistory?: OperatorHistory[];
  siteId?: string | null;
  masterAccountId: string;
  companyId?: string;
  allocationStatus: AllocationStatus;
  currentAllocation?: CurrentAllocation;
  allocationHistory?: AllocationHistoryEntry[];
  allocatedPvArea?: string;
  allocatedBlockNumber?: string;
  allocationDate?: any;
  breakdownStatus?: boolean;
  breakdownTimestamp?: any;
  inductionStatus: boolean;
  inductionDate?: any;
  onboardingDate?: any;
  inductionNotes?: string;
  attachments?: Attachment[];
  checklist?: ChecklistItem[];
  offHireDate?: any;
  offHireTimestamp?: any;
  offHireSubmittedBy?: string;
  dryRate?: number;
  wetRate?: number;
  dailyRate?: number;
  ratesSetAt?: any;
  ratesSetBy?: string;
  archived?: boolean;
  archivedAt?: any;
  archivedBy?: string;
  isAvailableForVAS?: boolean;
  availability?: 'available' | 'allocated' | 'maintenance';
  createdAt: any;
  updatedAt?: any;
};

export type Asset = {
  id?: string;
  assetName: string;
  assetType: string;
  serialNumber?: string;
  location?: string;
  assignedJob?: string;
  siteId: string;
  masterAccountId: string;
  inductionStatus?: boolean;
  inductionDate?: any;
  inductionNotes?: string;
  attachments?: Attachment[];
  checklist?: ChecklistItem[];
  createdAt: any;
  updatedAt?: any;
};

export type OnboardingMessage = {
  id?: string;
  siteId: string;
  masterAccountId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  message: string;
  type: 'EXIT_MEDICAL' | 'GENERAL' | 'EXPIRY_WARNING';
  employeeName?: string;
  read: boolean;
  createdAt: any;
};

export type HandoverRequest = {
  id?: string;
  type: 'HANDOVER_REQUEST';
  requestType?: 'SURVEYOR_REQUEST' | 'CABLING_REQUEST' | 'TERMINATION_REQUEST' | 'HANDOVER_REQUEST' | 'QC_REQUEST' | 'PLANT_REQUEST' | 'LOGISTICS_REQUEST' | 'STAFF_REQUEST';
  fromSupervisorId: string;
  toSupervisorId?: string;
  fromTaskId?: string;
  toTaskId?: string;
  activityId: string;
  activityName: string;
  subMenuKey: string;
  subMenuName?: string;
  pvArea: string;
  blockNumber: string;
  rowNr?: string;
  columnNr?: string;
  siteId: string;
  masterAccountId?: string;
  status: RequestStatus | 'RESOLVED_BY_PLANNER';
  noteFromSender?: string;
  noteFromPlanner?: string;
  handoverMode: 'SUPERVISOR_TO_SUPERVISOR' | 'PLANNER_APPOINTMENT';
  appointedSupervisorId?: string;
  appointedTaskId?: string;
  targetUserRole?: UserRole;
  linkedImageIds?: string[];
  createdAt: any;
  updatedAt?: any;
};

export type OperatorAssetHours = {
  id?: string;
  operatorId: string;
  operatorName: string;
  assetId: string;
  assetType: string;
  assetSiteId: string;
  date: string;
  openHours: string;
  closingHours: string;
  totalHours: number;
  siteId?: string;
  siteName?: string;
  masterAccountId: string;
  notes?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt: any;
  approvedAt?: any;
  approvedBy?: string;
  rejectionReason?: string;
  isRainDay?: boolean;
  isStrikeDay?: boolean;
  isBreakdown?: boolean;
  createdAt: any;
  updatedAt?: any;
};

export type FaceTemplate = {
  id?: string;
  userId: string;
  userName: string;
  encryptedEmbedding: string;
  encryptionSalt: string;
  enrolledAt: any;
  enrolledBy: string;
  version: number;
  isActive: boolean;
  masterAccountId: string;
  companyId?: string;
  siteId?: string;
  createdAt: any;
  updatedAt?: any;
};

export type ActivityBaseBlockType = 'STANDARD_COMPLETED_TODAY' | 'GRID_TYPE_ROW_PROGRESS';

export type ActivityMicroModule = 
  | 'HANDOVER_CARDS'
  | 'QC_REQUEST'
  | 'CONCRETE_REQUEST'
  | 'CABLING_REQUEST'
  | 'TERMINATION_REQUEST'
  | 'SURVEYOR_REQUEST'
  | 'PLANT_REQUEST'
  | 'MATERIALS_REQUEST'
  | 'STAFF_REQUEST';

export type GridNamingConvention = 'ALPHA' | 'NUMERIC';

export type FlexibleColumnConfig = {
  column: string;
  rows: number;
};

export type GridConfiguration = {
  pvAreaId?: string;
  pvAreaName?: string;
  blockAreaId?: string;
  blockAreaName?: string;
  scopeValue?: number;
  scopeUnit?: string;
  totalRows: number;
  totalColumns: number;
  flexibleColumns?: FlexibleColumnConfig[];
  rowNamingConvention: GridNamingConvention;
  columnNamingConvention: GridNamingConvention;
  reverseRowOrder?: boolean;
  reverseColumnOrder?: boolean;
};

export type HandoverTarget = 
  | 'Surveyor'
  | 'Cabling'
  | 'Termination'
  | 'Inverters'
  | 'Mechanical'
  | 'Commissioning'
  | 'Drilling';

export type RequestCardsConfig = {
  plant?: { enabled: boolean };
  staff?: { enabled: boolean };
  materials?: { enabled: boolean };
};

export type ActivityModuleConfig = {
  baseBlockType: ActivityBaseBlockType;
  microModules: {
    [key in ActivityMicroModule]?: {
      enabled: boolean;
      placement: 'inside' | 'above' | 'between';
      handoverTarget?: HandoverTarget;
      requestCardsConfig?: RequestCardsConfig;
    };
  };
  gridConfig?: GridConfiguration;
  boqQuantity?: number;
  boqUnit?: string;
};

export type FaceClockAttempt = {
  id?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  siteId: string;
  siteName?: string;
  companyId?: string;
  masterAccountId: string;
  eventType: 'clock-in' | 'clock-out';
  method: 'face';
  timestampClient: string;
  timestampServer?: any;
  gps: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  distanceFromSiteKm: number;
  matchScore: number | null;
  livenessPassed: boolean;
  verificationState: 'verified' | 'rejected' | 'pending';
  rejectionReason?: 'out_of_zone' | 'liveness_failed' | 'face_mismatch' | 'gps_accuracy_poor' | 'no_template' | 'other';
  deviceInfo: {
    deviceId: string;
    appVersion: string;
    platform: string;
  };
  offlineMode: boolean;
  syncedToServer: boolean;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
};

export type GridCellProgress = {
  id?: string;
  activityId: string;
  activityName: string;
  taskId: string;
  siteId: string;
  masterAccountId: string;
  pvAreaId: string;
  pvAreaName: string;
  blockAreaId: string;
  blockAreaName: string;
  row: string;
  rowIndex: number;
  column: string;
  columnIndex: number;
  supervisorId: string;
  supervisorName: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedValue?: number;
  targetValue?: number;
  unit?: string;
  progressPercentage: number;
  lastUpdatedAt?: any;
  completedAt?: any;
  notes?: string;
  isLocked?: boolean;
  lockType?: 'TIME_LOCK' | 'QC_INTERACTION';
  lockedAt?: any;
  lockDate?: string;
  createdAt: any;
  updatedAt?: any;
};

export type TimesheetWorkflowStatus = 'pending_eph' | 'in_negotiation' | 'approved_for_billing' | 'rejected';



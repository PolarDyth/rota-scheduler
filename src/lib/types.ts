export type Hour = number;

export type Slot = number;

export type SpecialisedRole = 'lingerie' | 'bureau' | 'vm' | 'isf' | 'tsm';

export type Department =
  | 'menswear'
  | 'womenswear'
  | 'kidswear'
  | 'home'
  | 'beauty'
  | 'any';

export type JobId =
  | 'tills'
  | 'hosting'
  | 'clickCollect'
  | 'repro'
  | 'standards'
  | 'delivery'
  | 'fittingMens'
  | 'fittingWomens'
  | 'lingerie'
  | 'bureau'
  | 'vm'
  | 'isf'
  | 'break'
  | 'off'
  | 'idle';

export interface BreakPeriod {
  start: string;
  end: string;
}

export interface Employee {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  breaks: BreakPeriod[];
  specialisedRole?: SpecialisedRole;
  specialisedPreferred?: boolean;
  department: Department;
  pdfTags: string[];
}

export interface DeliveryConfig {
  enabled: boolean;
  headcount: number;
}

export interface StaffingRule {
  id: string;
  job: JobId;
  start: string;
  end: string;
  count: number;
}

export interface ScheduleInput {
  employees: Employee[];
  hours: Hour[];
  staffing: StaffingRule[];
  priorityOrder?: JobId[];
  maxRoleBlock?: number;
}

export type Schedule = Record<string, Partial<Record<Slot, JobId>>>;

export type ScheduleWarningKind =
  | 'understaffed'
  | 'unassigned'
  | 'shortShift'
  | 'overlap'
  | 'breakShifted'
  | 'breakCovered';

export interface ScheduleWarning {
  hour: Hour;
  kind: ScheduleWarningKind;
  message: string;
  employeeIds?: string[];
}

export interface ScheduleResult {
  schedule: Schedule;
  warnings: ScheduleWarning[];
  coverage: Record<Hour, Partial<Record<JobId, number>>>;
}

export interface ExtractedRota {
  date?: string;
  dayName?: string;
  employees: Employee[];
  rawWarnings: string[];
}

export interface StoreHours {
  open: number;
  close: number;
}

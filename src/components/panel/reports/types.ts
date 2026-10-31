export interface ReportBucket {
  key: string;
  label: string;
  start: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  pending: number;
  confirmed: number;
}

export interface ReportData {
  range: { from: string; to: string; days: number };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
    untimedRequests: number;
    newClients: number;
    returningClients: number;
  };
  daily: ReportBucket[];
  weekly: ReportBucket[];
  monthly: ReportBucket[];
  byMeetingType: { IN_PERSON: number; ONLINE: number };
  bySource: { WEBSITE: number; PANEL: number };
}

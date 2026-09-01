export type ContactRow = {
  id: number;
  name: string;
  title: string;
  organization: string;
  email: string;
  raw?: Record<string, any>;
  verification?: VerificationResult;
};

export type VerificationStatus = "valid" | "invalid" | "risky" | "unknown";

export type VerificationResult = {
  email: string;
  syntax: boolean;
  domain: boolean | null;
  mx: boolean | null;
  disposable: boolean;
  role: boolean;
  smtp: "accepted" | "rejected" | "unknown";
  catch_all: boolean | null;
  spf?: boolean | null;
  dmarc?: boolean | null;
  provider?: string | null;
  suggested_email?: string | null;
  status: VerificationStatus;
  reason: string;
};

export type ParsedPayload = {
  rows: ContactRow[];
  duplicates: number;
  emptyEmails: number;
  sourceRows: number;
  headers?: string[];
};

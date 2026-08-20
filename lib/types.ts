export type ContactRow = {
  id: number;
  name: string;
  title: string;
  organization: string;
  email: string;
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
  status: VerificationStatus;
  reason: string;
};

export type ParsedPayload = {
  rows: ContactRow[];
  duplicates: number;
  emptyEmails: number;
  sourceRows: number;
};

"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import type { ContactRow, ParsedPayload, VerificationResult, VerificationStatus } from "../lib/types";

const BATCH_SIZE = 250;
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const Shield = () => <span className="shield-mark" aria-hidden="true">✓</span>;
const statusLabel = (status?: VerificationStatus) => status ? status[0].toUpperCase() + status.slice(1) : "Pending";

type StoredUpload = {
  upload_id: string;
  deletion_token: string;
  expires_at: string;
};

const csvCell = (value: string) => {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
};

export default function CleanerApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseInfo, setParseInfo] = useState<Omit<ParsedPayload, "rows"> | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [filter, setFilter] = useState<"all" | VerificationStatus>("all");
  const [includeRisky, setIncludeRisky] = useState(false);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [storeCopy, setStoreCopy] = useState(true);
  const [storedUpload, setStoredUpload] = useState<StoredUpload | null>(null);
  const [storageMessage, setStorageMessage] = useState("");

  const stats = useMemo(() => {
    const values = { valid: 0, invalid: 0, risky: 0, unknown: 0, pending: 0 };
    rows.forEach(({ verification }) => verification ? values[verification.status]++ : values.pending++);
    return values;
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter(({ verification }) => {
    if (filter === "all") return true;
    return verification?.status === filter;
  }), [rows, filter]);

  const visibleRows = useMemo(() => filteredRows.slice(0, 500), [filteredRows]);

  const hasResults = completed > 0;
  const progress = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const exportCount = stats.valid + (includeRisky ? stats.risky : 0) + (includeUnknown ? stats.unknown : 0);

  const deleteStoredCopy = async (silent = false) => {
    if (!storedUpload) return;
    try {
      const response = await fetch(`${API_URL}/api/uploads/${storedUpload.upload_id}`, {
        method: "DELETE",
        headers: { "X-Delete-Token": storedUpload.deletion_token },
      });
      if (!response.ok && response.status !== 404) throw new Error("Delete failed");
      setStoredUpload(null);
      if (!silent) setStorageMessage("The stored CSV copy was deleted.");
    } catch {
      if (!silent) setStorageMessage("The stored copy could not be deleted right now. It remains covered by the configured retention policy.");
    }
  };

  const storeCsv = async (file: File) => {
    const body = new FormData();
    body.append("file", file, file.name);
    const response = await fetch(`${API_URL}/api/uploads`, { method: "POST", body });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(detail?.detail || "Secure CSV storage is unavailable.");
    }
    const upload = await response.json() as StoredUpload;
    setStoredUpload(upload);
    const expiry = new Date(upload.expires_at).toLocaleString();
    setStorageMessage(`Encrypted copy stored privately and scheduled to expire after ${expiry}. You can delete it sooner.`);
  };

  const parseFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file.");
      return;
    }
    setError("");
    setParsing(true);
    setRows([]);
    setCompleted(0);
    setFileName(file.name);
    setRawFile(file);
    setStorageMessage("");
    if (storedUpload) await deleteStoredCopy(true);

    try {
      // Keep the worker at a stable, same-origin public URL. Using import.meta.url
      // here is rewritten to a file:// base by vinext's server/client build.
      const worker = new Worker("/csv.worker.js");
      const text = await file.text();
      const result = await new Promise<ParsedPayload>((resolve, reject) => {
        worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.payload);
        worker.onerror = () => reject(new Error("The CSV could not be read."));
        worker.postMessage({ text });
      });
      worker.terminate();
      if (!result.rows.length) throw new Error("No email addresses were found in this CSV.");
      if (result.rows.length > 50_000) throw new Error("This version supports up to 50,000 unique email addresses per file.");
      setRows(result.rows);
      setParseInfo({
        duplicates: result.duplicates,
        emptyEmails: result.emptyEmails,
        sourceRows: result.sourceRows,
        headers: result.headers,
      });
      if (storeCopy) {
        try {
          await storeCsv(file);
        } catch (storageError) {
          setStorageMessage(storageError instanceof Error ? `${storageError.message} The list was still parsed locally.` : "Secure storage is unavailable. The list was still parsed locally.");
        }
      }
    } catch (caught) {
      setFileName("");
      setRawFile(null);
      setError(caught instanceof Error ? caught.message : "The CSV could not be read.");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => parseFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    parseFile(event.dataTransfer.files?.[0]);
  };

  const verify = async () => {
    if (!rows.length || verifying) return;
    setError("");
    setVerifying(true);
    setCompleted(0);
    setRows((current) => current.map((row) => ({ ...row, verification: undefined })));
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let accumulatedRows: ContactRow[] = rows.map((row) => ({ ...row, verification: undefined }));
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const batch = rows.slice(start, start + BATCH_SIZE);
        const response = await fetch(`${API_URL}/api/verify-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: batch.map(({ email }) => email) }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(response.status === 429 ? "The verifier is busy. Wait a moment and try again." : "The verification service returned an error.");
        }
        const data = await response.json() as { results: VerificationResult[] };
        const byEmail = new Map(data.results.map((result) => [result.email, result]));

        accumulatedRows = accumulatedRows.map((row) => byEmail.has(row.email) ? { ...row, verification: byEmail.get(row.email) } : row);
        setRows(accumulatedRows);
        setCompleted(Math.min(start + batch.length, rows.length));
      }

      if (storedUpload) {
        const validOnly = accumulatedRows.filter((r) => r.verification?.status === "valid");
        const cleanText = generateCsv(validOnly);
        fetch(`${API_URL}/api/uploads/${storedUpload.upload_id}/clean`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Delete-Token": storedUpload.deletion_token,
          },
          body: JSON.stringify({ csv_content: cleanText }),
        }).catch(() => { });
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        const msg = (caught as Error).message;
        setError(msg && !msg.includes("Failed to fetch") ? msg : `Couldn’t reach the verification service at ${API_URL}. Please ensure the FastAPI backend is running on port 8000.`);
      }
    } finally {
      setVerifying(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();
  const reset = async () => {
    abortRef.current?.abort();
    await deleteStoredCopy(true);
    setRows([]);
    setRawFile(null);
    setFileName("");
    setParseInfo(null);
    setCompleted(0);
    setError("");
    setStorageMessage("");
    setFilter("all");
  };

  const generateCsv = (targetRows: ContactRow[]) => {
    const baseHeaders = parseInfo?.headers && parseInfo.headers.length ? parseInfo.headers : ["Name", "Title", "Organization", "Email"];
    const exportHeaders = [...baseHeaders, "Status", "Reason"];

    const headerLine = exportHeaders.map(csvCell).join(",");
    const dataLines = targetRows.map((row) => {
      const lineValues = baseHeaders.map((h) => {
        const hNorm = h.trim().toLowerCase().replace(/[\W_]+/g, "");
        if (hNorm.includes("email") || hNorm === "mail") {
          return row.email;
        }
        if (row.raw && row.raw[h] !== undefined) {
          return String(row.raw[h]);
        }
        if (hNorm.includes("name")) return row.name;
        if (hNorm.includes("title") || hNorm.includes("role") || hNorm.includes("position")) return row.title;
        if (hNorm.includes("org") || hNorm.includes("company")) return row.organization;
        return "";
      });

      lineValues.push(row.verification?.status || "valid");
      lineValues.push(row.verification?.reason || "Mailbox accepted");

      return lineValues.map(csvCell).join(",");
    });

    return [headerLine, ...dataLines].join("\r\n");
  };

  const downloadClean = () => {
    if (!hasResults) {
      setError("Please click 'Verify addresses' to verify your list before downloading.");
      return;
    }

    const allowed = new Set<VerificationStatus>(["valid"]);
    if (includeRisky) allowed.add("risky");
    if (includeUnknown) allowed.add("unknown");

    const cleanRows = rows.filter((row) => row.verification && allowed.has(row.verification.status));

    if (!cleanRows.length) {
      setError("No contacts match your selected filter (valid" + (includeRisky ? " + risky" : "") + (includeUnknown ? " + unknown" : "") + ").");
      return;
    }

    const csv = generateCsv(cleanRows);
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.csv$/i, "") || "contacts"}-clean.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <SiteHeader />

      <section className={`hero ${rows.length ? "hero-compact" : ""}`} id="top">
        <h1>A cleaner list.<br /><em>A clearer send.</em></h1>
        <p className="hero-copy">Understand every address, remove decisive failures, and download a campaign-ready CSV with clear controls for optional short-term storage.</p>

        {!rows.length ? (
          <div className="workspace-card">
            <div className={`upload-panel ${dragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <div className="upload-icon" aria-hidden="true"><span>{parsing ? "…" : "↑"}</span></div>
              <h2>{parsing ? "Reading your list" : "Drop your contact list here"}</h2>
              <p>{parsing ? "Normalizing and removing duplicates…" : "or choose a CSV from your computer"}</p>
              <label className="storage-choice" htmlFor="store-copy" aria-label="Keep an encrypted CSV copy with a 24-hour retention target"><input id="store-copy" type="checkbox" checked={storeCopy} onChange={(event) => setStoreCopy(event.target.checked)} disabled={parsing} /><span><strong>Keep an encrypted short-term copy</strong><small>Optional · 24-hour retention target · Delete anytime</small></span></label>
              <button className="choose-button" type="button" onClick={() => inputRef.current?.click()} disabled={parsing}>Choose CSV file</button>
              <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={onFileChange} aria-label="Choose CSV file" />
              <small>CSV up to 50,000 rows · Parsing and deduplication happen in your browser</small>
            </div>
            <aside className="result-preview" aria-label="Verification preview">
              <div className="preview-top"><span>What you’ll get</span><span className="live-label"><i /> Live results</span></div>
              <div className="sample-row"><div className="avatar">AS</div><div><strong>Alex Smith</strong><span>alex@northstar.co</span></div><b className="valid-tag">Valid</b></div>
              <div className="check-grid"><div><span>Syntax</span><b>Pass</b></div><div><span>Domain</span><b>Active</b></div><div><span>MX records</span><b>Found</b></div><div><span>Mailbox</span><b>Accepted</b></div></div>
              <div className="decision-line"><span className="">✓</span><div><strong>Safe to keep</strong><span>This address is ready for your next send.</span></div></div>
            </aside>
          </div>
        ) : (
          <section className="dashboard" aria-live="polite">
            <header className="dashboard-head">
              <div className="file-heading"><span className="file-icon" aria-hidden="true"><span className="file-sheet"><i /><i /><i /></span></span><div><strong>{fileName}</strong><span>{rows.length.toLocaleString()} unique addresses{parseInfo?.duplicates ? ` · ${parseInfo.duplicates.toLocaleString()} duplicates removed` : ""}</span></div></div>
              <div className="head-actions"><button className="text-button" type="button" onClick={reset}>Replace file</button>{!hasResults && <button className="primary-button" type="button" onClick={verify} disabled={verifying}>{verifying ? "Verifying…" : "Verify addresses"}</button>}</div>
            </header>

            <div className="stat-grid">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span>Total</span><strong>{rows.length.toLocaleString()}</strong></button>
              <button className={filter === "valid" ? "active valid" : "valid"} onClick={() => setFilter("valid")}><span>Valid</span><strong>{stats.valid.toLocaleString()}</strong></button>
              <button className={filter === "invalid" ? "active invalid" : "invalid"} onClick={() => setFilter("invalid")}><span>Invalid</span><strong>{stats.invalid.toLocaleString()}</strong></button>
              <button className={filter === "risky" ? "active risky" : "risky"} onClick={() => setFilter("risky")}><span>Risky</span><strong>{stats.risky.toLocaleString()}</strong></button>
              <button className={filter === "unknown" ? "active unknown" : "unknown"} onClick={() => setFilter("unknown")}><span>Unknown</span><strong>{stats.unknown.toLocaleString()}</strong></button>
            </div>

            {(verifying || hasResults) && <div className="progress-block"><div className="progress-copy"><span>{verifying ? `Verifying batch ${Math.ceil(completed / BATCH_SIZE) + 1} of ${Math.ceil(rows.length / BATCH_SIZE)}` : "Verification complete"}</span><b>{progress}%</b></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div>{verifying && <button onClick={cancel} type="button">Cancel</button>}</div>}

            <div className="table-wrap" tabIndex={0} aria-label="Verification results table">
              <table><thead><tr><th>Name</th><th>Title</th><th>Organization</th><th>Email</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>{visibleRows.map((row) => <tr key={row.id}><td>{row.name || "—"}</td><td>{row.title || "—"}</td><td>{row.organization || "—"}</td><td className="email-cell">{row.email}</td><td><span className={`status-tag ${row.verification?.status || "pending"}`}>{statusLabel(row.verification?.status)}</span></td><td className="reason-cell">{row.verification?.reason || "Waiting to verify"}</td></tr>)}</tbody>
              </table>
              {filteredRows.length > 20 && <p className="table-note">Showing {visibleRows.length.toLocaleString()} matching rows (scroll to view all). Your complete list of {rows.length.toLocaleString()} rows remains available for export.</p>}
            </div>

            {hasResults && !verifying && (
              <footer className="export-bar">
                <div>
                  <strong>Build your clean list</strong>
                  <span>Valid addresses are included automatically.</span>
                </div>
                <label><input type="checkbox" checked={includeRisky} onChange={(e) => setIncludeRisky(e.target.checked)} /> Include risky</label>
                <label><input type="checkbox" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} /> Include unknown</label>
                <button className="download-button" type="button" onClick={downloadClean} disabled={!exportCount}>
                  Download {exportCount.toLocaleString()} Clean Rows ↓
                </button>
              </footer>
            )}
          </section>
        )}

        {error && <div className="error-banner" role="alert"><span>!</span>{error}</div>}
        {storageMessage && <div className="storage-banner" role="status"><Shield />{storageMessage}</div>}
        {!rows.length && <div className="trust-row"><span><Shield /> Browser-based parsing</span><span><Shield /> Optional encrypted storage</span><span><Shield /> Clear deletion control</span></div>}
      </section>

      <section className="how-section" id="how-it-works">
        <span className="section-kicker">Private by design</span>
        <h2>Know what happens<br />at every step.</h2>
        <div className="steps-grid"><article><span>01</span><h3>Parse locally</h3><p>Your CSV is read and deduplicated in a background worker inside your browser.</p></article><article><span>02</span><h3>Store by choice</h3><p>Encrypted short-term storage is optional, private, and paired with an immediate delete control.</p></article><article><span>03</span><h3>Verify briefly</h3><p>Small email batches enter temporary server memory for DNS and available mailbox checks.</p></article><article><span>04</span><h3>Export clearly</h3><p>Your clean four-column CSV is created in the browser with your chosen result categories.</p></article></div>
      </section>

      <section className="status-section" id="status-guide">
        <div className="status-intro"><span className="section-kicker">Honest results</span><h2>Clear signals.<br />No false certainty.</h2><p>Every address lands in a practical group, with the reason shown beside it. Unknown never means automatically valid.</p></div>
        <div className="status-guide-grid">
          <article className="guide-valid"><span /><div><h3 className="valid">Valid</h3><p>The mailbox accepted the verification request. A strong candidate for your clean export.</p></div></article>
          <article className="guide-invalid"><span /><div><h3 className="invalid">Invalid</h3><p>The syntax, domain, or mailbox failed a decisive check. Remove it from the send.</p></div></article>
          <article className="guide-risky"><span /><div><h3 className="risky">Risky</h3><p>It may receive mail, but role-based or disposable patterns can lower list quality.</p></div></article>
          <article className="guide-unknown"><span /><div><h3 className="unknown">Unknown</h3><p>The provider blocked the check or timed out. This does not confirm the mailbox exists.</p></div></article>
        </div>
      </section>

      <section className="resources-section">
        <div className="resources-heading"><span className="section-kicker">Learn before you send</span><h2>Better lists need better decisions.</h2><p>Use original, practical guides to interpret verification results and protect sender quality.</p></div>
        <div className="resource-grid">
          <Link href="/email-verification-guide"><span>Verification</span><h3>How verification actually works</h3><p>Understand syntax, DNS, MX, SMTP, catch-all, and unknown results.</p><b>Read guide →</b></Link>
          <Link href="/deliverability-guide"><span>Deliverability</span><h3>A valid address is only the beginning</h3><p>Connect list quality with authentication, relevance, volume, and complaints.</p><b>Read guide →</b></Link>
          <Link href="/guides"><span>Learning center</span><h3>Explore every Clearlist guide</h3><p>Learn about bounces, authentication, shared inboxes, and catch-all domains.</p><b>View all guides →</b></Link>
        </div>
      </section>

      <section className="final-cta" aria-label="Start cleaning a list"><div><span>Ready when you are</span><h2>Turn a messy list into a cleaner send.</h2></div><a href="#top">Clean a CSV <span aria-hidden="true">↑</span></a></section>
      <SiteFooter />
    </main>
  );
}

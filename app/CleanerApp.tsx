"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { ContactRow, ParsedPayload, VerificationResult, VerificationStatus } from "../lib/types";

const BATCH_SIZE = 250;
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const Shield = () => <span className="shield-mark" aria-hidden="true">✓</span>;
const statusLabel = (status?: VerificationStatus) => status ? status[0].toUpperCase() + status.slice(1) : "Pending";

const csvCell = (value: string) => {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
};

export default function CleanerApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<ContactRow[]>([]);
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

  const stats = useMemo(() => {
    const values = { valid: 0, invalid: 0, risky: 0, unknown: 0, pending: 0 };
    rows.forEach(({ verification }) => verification ? values[verification.status]++ : values.pending++);
    return values;
  }, [rows]);

  const visibleRows = useMemo(() => rows.filter(({ verification }) => {
    if (filter === "all") return true;
    return verification?.status === filter;
  }).slice(0, 100), [rows, filter]);

  const hasResults = completed > 0;
  const progress = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const exportCount = stats.valid + (includeRisky ? stats.risky : 0) + (includeUnknown ? stats.unknown : 0);

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

    try {
      const worker = new Worker(new URL("../workers/csv.worker.ts", import.meta.url), { type: "module" });
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
      setParseInfo({ duplicates: result.duplicates, emptyEmails: result.emptyEmails, sourceRows: result.sourceRows });
    } catch (caught) {
      setFileName("");
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
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const batch = rows.slice(start, start + BATCH_SIZE);
        const response = await fetch(`${API_URL}/api/verify-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: batch.map(({ email }) => email) }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 429 ? "The verifier is busy. Wait a moment and try again." : "The verification service returned an error.");
        const data = await response.json() as { results: VerificationResult[] };
        const byEmail = new Map(data.results.map((result) => [result.email, result]));
        setRows((current) => current.map((row) => byEmail.has(row.email) ? { ...row, verification: byEmail.get(row.email) } : row));
        setCompleted(Math.min(start + batch.length, rows.length));
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError(`Couldn’t reach the verification service at ${API_URL}. Start the FastAPI backend, then try again.`);
      }
    } finally {
      setVerifying(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();
  const reset = () => {
    abortRef.current?.abort();
    setRows([]);
    setFileName("");
    setParseInfo(null);
    setCompleted(0);
    setError("");
    setFilter("all");
  };

  const download = () => {
    const allowed = new Set<VerificationStatus>(["valid"]);
    if (includeRisky) allowed.add("risky");
    if (includeUnknown) allowed.add("unknown");
    const cleanRows = rows.filter((row) => row.verification && allowed.has(row.verification.status));
    const csv = ["Name,Title,Organization,Email", ...cleanRows.map((row) => [row.name, row.title, row.organization, row.email].map(csvCell).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.csv$/i, "") || "contacts"}-clean.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <nav className="nav-shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Clearlist home"><span className="brand-mark"><span /></span><span>clearlist</span></a>
        <div className="nav-actions"><a href="#how-it-works">How it works</a><span className="privacy-pill"><Shield /> Privacy first</span></div>
      </nav>

      <section className={`hero ${rows.length ? "hero-compact" : ""}`} id="top">
        <div className="eyebrow"><span /> No sign-up. No storage. No surprises.</div>
        <h1>A cleaner list.<br /><em>A clearer send.</em></h1>
        <p className="hero-copy">Verify every address, remove the dead weight, and download a campaign-ready CSV — without your contact list ever being stored.</p>

        {!rows.length ? (
          <div className="workspace-card">
            <div className={`upload-panel ${dragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <div className="upload-icon" aria-hidden="true"><span>{parsing ? "…" : "↑"}</span></div>
              <h2>{parsing ? "Reading your list" : "Drop your contact list here"}</h2>
              <p>{parsing ? "Normalizing and removing duplicates…" : "or choose a CSV from your computer"}</p>
              <button className="choose-button" type="button" onClick={() => inputRef.current?.click()} disabled={parsing}>Choose CSV file</button>
              <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={onFileChange} aria-label="Choose CSV file" />
              <small>CSV up to 50,000 rows · Your file stays in this browser</small>
            </div>
            <aside className="result-preview" aria-label="Verification preview">
              <div className="preview-top"><span>What you’ll get</span><span className="live-label"><i /> Live results</span></div>
              <div className="sample-row"><div className="avatar">AS</div><div><strong>Alex Smith</strong><span>alex@northstar.co</span></div><b className="valid-tag">Valid</b></div>
              <div className="check-grid"><div><span>Syntax</span><b>Pass</b></div><div><span>Domain</span><b>Active</b></div><div><span>MX records</span><b>Found</b></div><div><span>Mailbox</span><b>Accepted</b></div></div>
              <div className="decision-line"><span className="decision-icon">✓</span><div><strong>Safe to keep</strong><span>This address is ready for your next send.</span></div></div>
            </aside>
          </div>
        ) : (
          <section className="dashboard" aria-live="polite">
            <header className="dashboard-head">
              <div className="file-heading"><span className="file-icon">CSV</span><div><strong>{fileName}</strong><span>{rows.length.toLocaleString()} unique addresses{parseInfo?.duplicates ? ` · ${parseInfo.duplicates.toLocaleString()} duplicates removed` : ""}</span></div></div>
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

            <div className="table-wrap">
              <table><thead><tr><th>Name</th><th>Title</th><th>Organization</th><th>Email</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>{visibleRows.map((row) => <tr key={row.id}><td>{row.name || "—"}</td><td>{row.title || "—"}</td><td>{row.organization || "—"}</td><td className="email-cell">{row.email}</td><td><span className={`status-tag ${row.verification?.status || "pending"}`}>{statusLabel(row.verification?.status)}</span></td><td className="reason-cell">{row.verification?.reason || "Waiting to verify"}</td></tr>)}</tbody>
              </table>
              {rows.length > 100 && <p className="table-note">Showing the first 100 matching rows. Your complete list remains available for export.</p>}
            </div>

            {hasResults && !verifying && <footer className="export-bar"><div><strong>Build your clean list</strong><span>Valid addresses are included automatically.</span></div><label><input type="checkbox" checked={includeRisky} onChange={(e) => setIncludeRisky(e.target.checked)} /> Include risky</label><label><input type="checkbox" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} /> Include unknown</label><button className="download-button" type="button" onClick={download} disabled={!exportCount}>Download {exportCount.toLocaleString()} clean rows ↓</button></footer>}
          </section>
        )}

        {error && <div className="error-banner" role="alert"><span>!</span>{error}</div>}
        {!rows.length && <div className="trust-row"><span><Shield /> Processed in memory</span><span><Shield /> Nothing saved to a database</span><span><Shield /> Export happens in your browser</span></div>}
      </section>

      <section className="how-section" id="how-it-works">
        <span className="section-kicker">Private by design</span>
        <h2>Your contacts are yours.<br />We keep it that way.</h2>
        <div className="steps-grid"><article><span>01</span><h3>Open locally</h3><p>Your CSV is parsed and deduplicated in a background worker inside your browser.</p></article><article><span>02</span><h3>Verify briefly</h3><p>Only small email batches enter temporary server memory for DNS and mailbox checks.</p></article><article><span>03</span><h3>Leave no trace</h3><p>Your clean four-column CSV is created here. Close the tab and the session disappears.</p></article></div>
      </section>
      <footer className="site-footer"><a className="brand" href="#top"><span className="brand-mark"><span /></span><span>clearlist</span></a><p>Private email verification, without the database.</p></footer>
    </main>
  );
}

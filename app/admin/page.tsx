"use client";

import { useEffect, useState, useMemo } from "react";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

type AdminStats = {
  total_uploads: number;
  active_uploads: number;
  total_storage_bytes: number;
  total_messages: number;
  storage_enabled: boolean;
  database_enabled: boolean;
};

type UploadRecord = {
  id: string;
  uploadId: string;
  objectKey: string;
  sizeBytes: number;
  status: string;
  cleanStatus?: string;
  cleanSizeBytes?: number;
  createdAt: string;
  expiresAt: string;
};

type ContactMessage = {
  id: string;
  messageId: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  submittedAt: string;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (isoString: string) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  // Dashboard state
  const [activeTab, setActiveTab] = useState<"uploads" | "messages">("uploads");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Check saved session on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem("clearlist_admin_token");
    if (savedToken) {
      setToken(savedToken);
      verifyAndLoad(savedToken);
    }
  }, []);

  const verifyAndLoad = async (key: string) => {
    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/verify`, {
        method: "POST",
        headers: { "X-Admin-Token": key },
      });
      if (!res.ok) {
        throw new Error("Invalid admin key. Please check your credentials.");
      }
      sessionStorage.setItem("clearlist_admin_token", key);
      setIsAuthenticated(true);
      await loadDashboardData(key);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate");
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (key: string) => {
    try {
      const [statsRes, uploadsRes, messagesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: { "X-Admin-Token": key } }),
        fetch(`${API_URL}/api/admin/uploads`, { headers: { "X-Admin-Token": key } }),
        fetch(`${API_URL}/api/admin/messages`, { headers: { "X-Admin-Token": key } }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (uploadsRes.ok) setUploads(await uploadsRes.json());
      if (messagesRes.ok) setMessages(await messagesRes.json());
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    verifyAndLoad(token.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem("clearlist_admin_token");
    setToken("");
    setIsAuthenticated(false);
    setStats(null);
    setUploads([]);
    setMessages([]);
  };

  const downloadFile = async (uploadId: string, type: "original" | "clean") => {
    setDownloadingId(`${uploadId}-${type}`);
    setActionMessage(null);
    try {
      const endpoint = `${API_URL}/api/admin/uploads/${uploadId}/download-${type}`;
      const res = await fetch(endpoint, {
        headers: { "X-Admin-Token": token },
      });
      if (!res.ok) throw new Error(`Failed to download ${type} CSV`);
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${uploadId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setActionMessage({ text: `Downloaded ${type} CSV successfully.`, type: "success" });
    } catch (err: any) {
      setActionMessage({ text: err.message || "Download failed", type: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteUpload = async (uploadId: string) => {
    if (!confirm(`Are you sure you want to delete upload "${uploadId}" from Backblaze B2 and Firestore?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/uploads/${uploadId}`, {
        method: "DELETE",
        headers: { "X-Admin-Token": token },
      });
      if (!res.ok) throw new Error("Failed to delete upload");
      setActionMessage({ text: `Upload ${uploadId} deleted successfully.`, type: "success" });
      setUploads((prev) => prev.filter((u) => u.uploadId !== uploadId));
      if (stats) {
        setStats({ ...stats, total_uploads: stats.total_uploads - 1 });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || "Deletion failed", type: "error" });
    }
  };

  const filteredUploads = useMemo(() => {
    if (!searchQuery.trim()) return uploads;
    const q = searchQuery.toLowerCase();
    return uploads.filter(
      (u) =>
        u.uploadId.toLowerCase().includes(q) ||
        u.status?.toLowerCase().includes(q) ||
        u.createdAt?.toLowerCase().includes(q)
    );
  }, [uploads, searchQuery]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px", width: "100%", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span className="section-kicker" style={{ display: "inline-block", marginBottom: "8px" }}>Management Console</span>
            <h1 style={{ fontSize: "32px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Clearlist Admin Panel</h1>
          </div>
          {isAuthenticated && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => loadDashboardData(token)}
                style={{ padding: "8px 16px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer" }}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{ padding: "8px 16px", borderRadius: "8px", background: "#ef444422", border: "1px solid #ef444444", color: "#f87171", cursor: "pointer" }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Login Gate */}
        {!isAuthenticated ? (
          <div style={{ maxWidth: "440px", margin: "60px auto", padding: "32px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Admin Access Required</h2>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>
              Enter your server <code style={{ color: "var(--accent)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>ADMIN_SECRET_KEY</code> to access the management dashboard.
            </p>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "8px" }}>Secret Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter admin secret key..."
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "inherit", fontSize: "14px", outline: "none" }}
                  required
                />
              </div>
              {authError && (
                <div style={{ padding: "10px 14px", background: "#ef444422", border: "1px solid #ef444455", borderRadius: "8px", color: "#f87171", fontSize: "13px", marginBottom: "20px" }}>
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="primary-button"
                style={{ width: "100%", padding: "12px", borderRadius: "8px" }}
              >
                {loading ? "Authenticating..." : "Unlock Dashboard"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            {/* Action Message Banner */}
            {actionMessage && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  background: actionMessage.type === "success" ? "#10b98122" : "#ef444422",
                  border: `1px solid ${actionMessage.type === "success" ? "#10b98155" : "#ef444455"}`,
                  color: actionMessage.type === "success" ? "#34d399" : "#f87171",
                  fontSize: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{actionMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setActionMessage(null)}
                  style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Overview Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              <div style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total CSV Uploads</span>
                <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>{stats?.total_uploads ?? 0}</div>
              </div>
              <div style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Files</span>
                <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px", color: "#10b981" }}>{stats?.active_uploads ?? 0}</div>
              </div>
              <div style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Storage Used</span>
                <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px", color: "#38bdf8" }}>
                  {formatBytes(stats?.total_storage_bytes ?? 0)}
                </div>
              </div>
              <div style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact Messages</span>
                <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px", color: "#a855f7" }}>{stats?.total_messages ?? 0}</div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", marginBottom: "24px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("uploads")}
                style={{
                  padding: "12px 20px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "uploads" ? "2px solid var(--accent, #6366f1)" : "2px solid transparent",
                  color: activeTab === "uploads" ? "var(--foreground)" : "var(--muted)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "15px",
                }}
              >
                Stored CSV Files ({uploads.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("messages")}
                style={{
                  padding: "12px 20px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "messages" ? "2px solid var(--accent, #6366f1)" : "2px solid transparent",
                  color: activeTab === "messages" ? "var(--foreground)" : "var(--muted)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "15px",
                }}
              >
                Contact Inquiries ({messages.length})
              </button>
            </div>

            {/* TAB 1: CSV UPLOADS */}
            {activeTab === "uploads" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                  <input
                    type="text"
                    placeholder="Search by upload ID or status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "10px 16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "inherit",
                      fontSize: "14px",
                      minWidth: "280px",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Showing {filteredUploads.length} of {uploads.length} uploads
                  </span>
                </div>

                <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Upload ID</th>
                        <th>Original Size</th>
                        <th>Cleaned Size</th>
                        <th>Uploaded At</th>
                        <th>Expires At</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Download & Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUploads.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                            No CSV uploads found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredUploads.map((u) => (
                          <tr key={u.uploadId}>
                            <td>
                              <code style={{ fontSize: "12px", color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                                {u.uploadId}
                              </code>
                            </td>
                            <td>{formatBytes(u.sizeBytes)}</td>
                            <td>{u.cleanSizeBytes ? formatBytes(u.cleanSizeBytes) : <span style={{ color: "var(--muted)" }}>On-demand</span>}</td>
                            <td style={{ fontSize: "13px" }}>{formatDate(u.createdAt)}</td>
                            <td style={{ fontSize: "13px", color: "var(--muted)" }}>{formatDate(u.expiresAt)}</td>
                            <td>
                              <span className={`status-tag ${u.status === "stored" ? "valid" : "invalid"}`}>
                                {u.status || "stored"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                <button
                                  type="button"
                                  title="Download raw original CSV file from Backblaze B2"
                                  onClick={() => downloadFile(u.uploadId, "original")}
                                  disabled={downloadingId === `${u.uploadId}-original`}
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    borderRadius: "6px",
                                    background: "rgba(56,189,248,0.15)",
                                    border: "1px solid rgba(56,189,248,0.3)",
                                    color: "#38bdf8",
                                    cursor: "pointer",
                                  }}
                                >
                                  {downloadingId === `${u.uploadId}-original` ? "..." : "Original"}
                                </button>
                                <button
                                  type="button"
                                  title="Download final cleanup CSV file"
                                  onClick={() => downloadFile(u.uploadId, "clean")}
                                  disabled={downloadingId === `${u.uploadId}-clean`}
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    borderRadius: "6px",
                                    background: "rgba(16,185,129,0.15)",
                                    border: "1px solid rgba(16,185,129,0.3)",
                                    color: "#34d399",
                                    cursor: "pointer",
                                  }}
                                >
                                  {downloadingId === `${u.uploadId}-clean` ? "..." : "Cleanup"}
                                </button>
                                <button
                                  type="button"
                                  title="Delete CSV from B2 & Firestore"
                                  onClick={() => deleteUpload(u.uploadId)}
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    borderRadius: "6px",
                                    background: "rgba(239,68,68,0.15)",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                    color: "#f87171",
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: CONTACT MESSAGES */}
            {activeTab === "messages" && (
              <div>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--muted)" }}>
                    No contact form messages have been submitted yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "16px" }}>
                    {messages.map((m) => (
                      <div key={m.id || m.messageId} style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                          <div>
                            <strong style={{ fontSize: "16px", display: "block" }}>{m.name}</strong>
                            <a href={`mailto:${m.email}`} style={{ color: "var(--accent, #38bdf8)", fontSize: "13px" }}>
                              {m.email}
                            </a>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>{formatDate(m.submittedAt)}</span>
                        </div>
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Topic: </span>
                          <strong style={{ fontSize: "13px" }}>{m.topic || "General"}</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap", color: "var(--foreground)" }}>
                          {m.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

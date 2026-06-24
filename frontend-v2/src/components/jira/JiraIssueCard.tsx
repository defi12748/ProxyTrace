/* ======================================================
   JiraIssueCard — fetches and displays a Jira ticket
   via GET /jira/issues/{issue_key}
   ====================================================== */
import { useState, useEffect } from "react";
import {
  ExternalLink,
  User,
  Tag,
  Clock,
  AlertCircle,
  Loader2,
  Ticket,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { JiraIssue } from "../../api/types";

interface JiraIssueCardProps {
  issueKey: string;
  onFetch: (issueKey: string) => Promise<JiraIssue>;
}

function jiraStatusBadgeColor(status: string): "green" | "blue" | "rose" | "purple" {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return "green";
  if (s.includes("progress") || s.includes("review")) return "blue";
  if (s.includes("block") || s.includes("fail")) return "rose";
  return "purple";
}

function jiraPriorityBadgeColor(priority: string | null): "rose" | "amber" | "blue" | "gray" {
  if (!priority) return "gray";
  const p = priority.toLowerCase();
  if (p === "highest" || p === "critical") return "rose";
  if (p === "high") return "amber";
  if (p === "medium") return "blue";
  return "gray";
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <span style={{ color: "var(--text-muted)", flexShrink: 0, minWidth: "60px" }}>{label}</span>
      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export function JiraIssueCard({ issueKey, onFetch }: JiraIssueCardProps) {
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIssue(null);

    onFetch(issueKey)
      .then((data) => {
        if (!cancelled) setIssue(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Jira issue");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [issueKey, onFetch]);

  return (
    <Card>
      <CardHeader>
        <div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: "2px",
            }}
          >
            Jira
          </div>
          <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Linked Issue</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--purple-text)",
              background: "var(--purple-dim)",
              padding: "2px 8px",
              borderRadius: "var(--radius-lg)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {issueKey}
          </span>
        </div>
      </CardHeader>

      <CardBody>
        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            <span>Fetching from Jira…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              background: "var(--rose-dim)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <AlertCircle size={14} style={{ color: "var(--rose-text)", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--rose-text)" }}>
                Could not load issue
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--rose-text)", opacity: 0.8 }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Issue data */}
        {issue && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Summary */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "6px",
                }}
              >
                <Ticket size={13} style={{ color: "var(--purple)", flexShrink: 0 }} />
                <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
                  Summary
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                }}
              >
                {issue.summary}
              </p>
            </div>

            {/* Badges row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {issue.status && (
                <Badge color={jiraStatusBadgeColor(issue.status)}>
                  {issue.status}
                </Badge>
              )}
              {issue.priority && (
                <Badge color={jiraPriorityBadgeColor(issue.priority)}>
                  ↑ {issue.priority}
                </Badge>
              )}
              {issue.issue_type && (
                <Badge color="blue">
                  {issue.issue_type}
                </Badge>
              )}
            </div>

            {/* Meta info */}
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-raised)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
              }}
            >
              <InfoRow icon={<User size={12} />} label="Assignee" value={issue.assignee} />
              <InfoRow icon={<User size={12} />} label="Reporter" value={issue.reporter} />
              <InfoRow icon={<Tag size={12} />} label="Type" value={issue.issue_type} />
              <InfoRow icon={<Clock size={12} />} label="Updated" value={issue.updated ? new Date(issue.updated).toLocaleDateString() : null} />
            </div>

            {/* Description preview */}
            {issue.description && (
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  Description
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  } as React.CSSProperties}
                >
                  {issue.description}
                </p>
              </div>
            )}

            {/* External link */}
            {issue.url && (
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--blue-text)",
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-raised)",
                  transition: "all var(--transition)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--blue-dim)";
                  e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-raised)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <ExternalLink size={12} />
                Open in Jira
              </a>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

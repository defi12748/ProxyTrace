import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/* Matches dotrack Pagination.js exactly — purple active page, #DEE0E7 default borders */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  function getPages(): (number | "…")[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) end = Math.min(4, totalPages - 1);
    if (currentPage >= totalPages - 2) start = Math.max(2, totalPages - 3);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }

  const btnBase: React.CSSProperties = {
    height: "28px",
    minWidth: "26px",
    padding: "0 8px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    background: "var(--bg-base)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all var(--transition)",
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>

        {/* Previous */}
        <button
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            ...btnBase,
            gap: "4px",
            color: currentPage > 1 ? "var(--text-secondary)" : "var(--text-muted)",
            borderColor: currentPage > 1 ? "var(--border-strong)" : "var(--border)",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={13} />
          <span>Previous</span>
        </button>

        {/* Page numbers */}
        {getPages().map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} style={{ ...btnBase, cursor: "default", color: "var(--text-muted)", border: "1px solid var(--border)" }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={{
                ...btnBase,
                background: currentPage === p ? "var(--purple-dim)" : "var(--bg-base)",
                borderColor: currentPage === p ? "var(--purple)" : "var(--border)",
                color: currentPage === p ? "var(--purple-text)" : "var(--text-muted)",
                fontWeight: currentPage === p ? 700 : 500,
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            ...btnBase,
            gap: "4px",
            color: currentPage < totalPages ? "var(--text-secondary)" : "var(--text-muted)",
            borderColor: currentPage < totalPages ? "var(--border-strong)" : "var(--border)",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
          }}
        >
          <span>Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

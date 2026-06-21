import { useState } from "react";
import { Brain, MessageSquare, Terminal } from "lucide-react";

interface LLMInspectorProps {
  payload: any;
}

export function LLMInspector({ payload }: LLMInspectorProps) {
  const [activeTab, setActiveTab] = useState<"system" | "user" | "response">("response");

  const messages = Array.isArray(payload?.params?.messages) ? payload.params.messages : [];
  const systemMsg = messages.find((m: any) => m.role === "system")?.content || "No system prompt recorded";
  const userMsg = messages.find((m: any) => m.role === "user")?.content || "No user prompt recorded";
  
  // Extract response text (similar to how extractResponseText works in utils)
  let responseText = "No response text found";
  try {
    const parts = payload?.response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      responseText = parts[0].text || JSON.stringify(payload?.response, null, 2);
    } else if (payload?.response) {
      responseText = JSON.stringify(payload.response, null, 2);
    }
  } catch (e) {
    // fallback
  }

  return (
    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--purple-text)" }}>
        LLM Reasoning
      </div>
      
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}>
          <button
            onClick={() => setActiveTab("response")}
            style={{
              flex: 1, padding: "8px", border: "none", background: activeTab === "response" ? "var(--bg-surface)" : "transparent",
              color: activeTab === "response" ? "var(--purple-text)" : "var(--text-muted)",
              borderBottom: activeTab === "response" ? "2px solid var(--purple)" : "2px solid transparent",
              fontWeight: 600, fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <Brain size={12} /> Response
          </button>
          <button
            onClick={() => setActiveTab("user")}
            style={{
              flex: 1, padding: "8px", border: "none", background: activeTab === "user" ? "var(--bg-surface)" : "transparent",
              color: activeTab === "user" ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeTab === "user" ? "2px solid var(--border-strong)" : "2px solid transparent",
              fontWeight: 600, fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <MessageSquare size={12} /> User Prompt
          </button>
          <button
            onClick={() => setActiveTab("system")}
            style={{
              flex: 1, padding: "8px", border: "none", background: activeTab === "system" ? "var(--bg-surface)" : "transparent",
              color: activeTab === "system" ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeTab === "system" ? "2px solid var(--border-strong)" : "2px solid transparent",
              fontWeight: 600, fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <Terminal size={12} /> System Prompt
          </button>
        </div>
        
        {/* Content */}
        <div style={{ padding: "12px", maxHeight: "300px", overflowY: "auto", fontSize: "12px", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {activeTab === "system" && <div style={{ color: "var(--text-secondary)" }}>{systemMsg}</div>}
          {activeTab === "user" && <div style={{ color: "var(--text-primary)" }}>{userMsg}</div>}
          {activeTab === "response" && (
            <div dangerouslySetInnerHTML={{ 
              __html: responseText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                // Highlight JSON-like project_key router decisions
                .replace(/("project_key":\s*"[^"]+")/g, '<span style="background: rgba(167,139,250,0.15); color: var(--purple); font-weight: bold; padding: 0 4px; border-radius: 2px;">$1</span>')
                // Highlight Confidence
                .replace(/("confidence":\s*[0-9.]+)/g, '<span style="color: var(--amber); font-weight: bold;">$1</span>')
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

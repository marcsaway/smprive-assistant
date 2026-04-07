import { useState, useRef, useEffect } from "react";

const DEFAULT_KNOWLEDGE = `=== SM PRIVÉ — BASE DE CONNAISSANCES / KNOWLEDGE BASE ===

[Remplacez ce texte par vos propres informations. / Replace this text with your own information.]

--- HORAIRES / HOURS ---
Les heures d'ouverture sont de 9h à 17h, du lundi au vendredi.
Opening hours are 9am to 5pm, Monday to Friday.

--- CONGÉS ET ABSENCES / LEAVE & ABSENCES ---
Pour toute absence, informez votre responsable au minimum 2 heures avant votre prise de poste.
For any absence, notify your manager at least 2 hours before your shift.

--- PAIEMENT / PAYMENT ---
Les salaires sont versés le dernier vendredi de chaque mois.
Salaries are paid on the last Friday of each month.

--- URGENCES / EMERGENCIES ---
En cas d'urgence, appelez le responsable au numéro affiché en salle de pause.
In case of emergency, call the manager at the number posted in the break room.`;

const SYSTEM_PROMPT = (kb) => `You are the internal AI assistant for SM Privé. Your only job is to answer employee questions based strictly on the knowledge base provided below.

Rules:
- Answer ONLY using information found in the knowledge base.
- If the answer is not in the knowledge base, say: "Je n'ai pas cette information dans ma base de données. Veuillez contacter votre responsable. / I don't have this information in my database. Please contact your manager."
- Detect the language the employee writes in (French or English) and respond in that same language. If both are used, respond in both.
- Be concise, warm, and professional.
- Never invent or assume information not present below.

=== KNOWLEDGE BASE ===
${kb}
=== END OF KNOWLEDGE BASE ===`;

export default function App() {
  const [view, setView] = useState("chat");
  const [knowledge, setKnowledge] = useState(DEFAULT_KNOWLEDGE);
  const [savedKnowledge, setSavedKnowledge] = useState(DEFAULT_KNOWLEDGE);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Bonjour! Je suis l'assistant de SM Privé. Comment puis-je vous aider aujourd'hui?\n\nHello! I'm the SM Privé staff assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadKnowledge();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadKnowledge = async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        if (data.knowledge) {
          setKnowledge(data.knowledge);
          setSavedKnowledge(data.knowledge);
        }
      }
    } catch (e) {
      console.log("Using default knowledge.");
    }
    setInitialLoaded(true);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT(savedKnowledge),
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data.content?.find((b) => b.type === "text")?.text || "Erreur / Error.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Une erreur s'est produite. / An error occurred." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const saveKnowledge = async () => {
    setSaveStatus("Sauvegarde...");
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge }),
      });
      if (res.ok) {
        setSavedKnowledge(knowledge);
        setSaveStatus("✓ Sauvegardé / Saved");
      } else {
        setSavedKnowledge(knowledge);
        setSaveStatus("✓ Sauvegardé (local)");
      }
    } catch (e) {
      setSavedKnowledge(knowledge);
      setSaveStatus("✓ Sauvegardé (local)");
    }
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Bonjour! Je suis l'assistant de SM Privé. Comment puis-je vous aider aujourd'hui?\n\nHello! I'm the SM Privé staff assistant. How can I help you today?",
    }]);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext)) {
      setUploadStatus("⚠ Format non supporté. Utilisez PDF, Word ou TXT.");
      setTimeout(() => setUploadStatus(""), 4000);
      return;
    }
    setUploadStatus(`📄 Lecture de "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          const separator = `\n\n--- DOCUMENT: ${file.name.toUpperCase()} ---\n`;
          setKnowledge((prev) => prev + separator + data.text);
          setUploadStatus(`✓ "${file.name}" ajouté! Cliquez Sauvegarder. / Added! Click Save.`);
        } else {
          setUploadStatus("⚠ Impossible de lire ce fichier.");
        }
      } else {
        setUploadStatus("⚠ Erreur lors de la lecture du fichier.");
      }
    } catch (e) {
      setUploadStatus("⚠ Erreur de connexion.");
    }
    setTimeout(() => setUploadStatus(""), 5000);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  return (
    <div style={styles.root}>
      <div style={styles.bgPattern} />
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.logoArea}>
            <div style={styles.logoMark}>SM</div>
            <div>
              <div style={styles.logoName}>SM Privé</div>
              <div style={styles.logoSub}>Assistant du Personnel</div>
            </div>
          </div>
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(view === "chat" ? styles.tabActive : {}) }} onClick={() => setView("chat")}>💬 Chat</button>
            <button style={{ ...styles.tab, ...(view === "admin" ? styles.tabActive : {}) }} onClick={() => setView("admin")}>⚙️ Base de données</button>
          </div>
        </div>

        {view === "chat" && (
          <div style={styles.chatContainer}>
            <div style={styles.messageList}>
              {messages.map((m, i) => (
                <div key={i} style={{ ...styles.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "assistant" && <div style={styles.avatar}>AI</div>}
                  <div style={{ ...styles.bubble, ...(m.role === "user" ? styles.bubbleUser : styles.bubbleBot) }}>
                    {m.content.split("\n").map((line, j) => (
                      <span key={j}>{line}{j < m.content.split("\n").length - 1 && <br />}</span>
                    ))}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
                  <div style={styles.avatar}>AI</div>
                  <div style={{ ...styles.bubble, ...styles.bubbleBot }}>
                    <span style={styles.dots}><span>● </span><span>● </span><span>●</span></span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div style={styles.inputBar}>
              <textarea style={styles.input} placeholder="Posez votre question... / Ask your question..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} rows={1} />
              <button style={styles.sendBtn} onClick={sendMessage} disabled={loading || !input.trim()}>➤</button>
            </div>
            <div style={styles.clearRow}>
              <button style={styles.clearBtn} onClick={clearChat}>Nouvelle conversation / New chat</button>
            </div>
          </div>
        )}

        {view === "admin" && (
          <div style={styles.adminContainer}>
            <div style={styles.adminHeader}>
              <div>
                <div style={styles.adminTitle}>Base de connaissances / Knowledge Base</div>
                <div style={styles.adminSub}>
                  Tapez, collez ou uploadez des documents PDF/Word/TXT.<br />
                  Type, paste, or upload PDF/Word/TXT documents.
                </div>
              </div>
              <div style={styles.saveBtnArea}>
                {saveStatus && <span style={styles.saveStatus}>{saveStatus}</span>}
                <button style={styles.saveBtn} onClick={saveKnowledge}>💾 Sauvegarder / Save</button>
              </div>
            </div>

            <div
              style={{ ...styles.uploadZone, ...(isDragging ? styles.uploadZoneDragging : {}) }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files[0])} />
              <div style={styles.uploadIcon}>📎</div>
              <div style={styles.uploadText}>
                Glissez un fichier ici ou cliquez pour uploader<br />
                <span style={styles.uploadSub}>PDF, Word (.docx), ou TXT — Drop or click to upload</span>
              </div>
            </div>

            {uploadStatus && <div style={styles.uploadStatus}>{uploadStatus}</div>}

            <textarea style={styles.kbEditor} value={knowledge} onChange={(e) => setKnowledge(e.target.value)} spellCheck={false} placeholder="Entrez vos informations ici..." />
            <div style={styles.adminHint}>
              💡 Organisez avec des sections — NOM DE SECTION —. Après chaque changement, cliquez Sauvegarder. / After each change, click Save.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0e0c; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #4a3f2f; border-radius: 2px; }
        textarea { resize: none; }
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-5px);opacity:1} }
      `}</style>
    </div>
  );
}

const styles = {
  root: { fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#0f0e0c", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative" },
  bgPattern: { position: "fixed", inset: 0, backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(139,101,57,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(101,80,45,0.06) 0%, transparent 50%)`, pointerEvents: "none" },
  shell: { width: "100%", maxWidth: "720px", background: "#1a1712", border: "1px solid #2e2820", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "85vh", maxHeight: "90vh", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", position: "relative", zIndex: 1 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #2e2820", background: "#161410", flexWrap: "wrap", gap: "12px" },
  logoArea: { display: "flex", alignItems: "center", gap: "12px" },
  logoMark: { width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #8b6539, #6b4e2a)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: "12px", fontWeight: "600", color: "#f0e6d3", letterSpacing: "1px" },
  logoName: { fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", fontWeight: "600", color: "#e8dcc8" },
  logoSub: { fontSize: "11px", color: "#6b5e4a", marginTop: "1px" },
  tabs: { display: "flex", gap: "6px" },
  tab: { padding: "7px 14px", borderRadius: "8px", border: "1px solid #2e2820", background: "transparent", color: "#6b5e4a", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: "#2e2820", color: "#c9a96e", borderColor: "#4a3f2f" },
  chatContainer: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
  messageList: { flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: "10px" },
  avatar: { width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #5a4530, #3d2f1e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "500", color: "#c9a96e", flexShrink: 0, border: "1px solid #2e2820" },
  bubble: { maxWidth: "72%", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", lineHeight: "1.6", wordBreak: "break-word" },
  bubbleBot: { background: "#221e18", color: "#d4c4a8", border: "1px solid #2e2820", borderBottomLeftRadius: "4px" },
  bubbleUser: { background: "linear-gradient(135deg, #6b4e2a, #4a3520)", color: "#f0e6d3", border: "1px solid #8b6539", borderBottomRightRadius: "4px" },
  dots: { display: "inline-flex", gap: "2px", fontSize: "16px", color: "#c9a96e" },
  inputBar: { display: "flex", gap: "10px", padding: "16px 20px 8px", borderTop: "1px solid #2e2820", alignItems: "flex-end" },
  input: { flex: 1, background: "#221e18", border: "1px solid #2e2820", borderRadius: "10px", padding: "12px 14px", color: "#e8dcc8", fontSize: "14px", fontFamily: "'DM Sans', sans-serif", outline: "none", lineHeight: "1.5", maxHeight: "120px", overflowY: "auto" },
  sendBtn: { width: "44px", height: "44px", borderRadius: "10px", background: "linear-gradient(135deg, #8b6539, #6b4e2a)", border: "none", color: "#f0e6d3", fontSize: "16px", cursor: "pointer", flexShrink: 0 },
  clearRow: { padding: "8px 20px 16px", display: "flex", justifyContent: "center" },
  clearBtn: { background: "none", border: "none", color: "#4a3f2f", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  adminContainer: { flex: 1, display: "flex", flexDirection: "column", padding: "20px", gap: "12px", overflow: "hidden" },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" },
  adminTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", color: "#e8dcc8", fontWeight: "600" },
  adminSub: { fontSize: "12px", color: "#6b5e4a", marginTop: "4px", lineHeight: "1.5" },
  saveBtnArea: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 },
  saveStatus: { fontSize: "12px", color: "#8b6539", fontWeight: "500" },
  saveBtn: { padding: "9px 18px", borderRadius: "8px", background: "linear-gradient(135deg, #8b6539, #6b4e2a)", border: "none", color: "#f0e6d3", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: "500" },
  uploadZone: { border: "2px dashed #2e2820", borderRadius: "10px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", transition: "all 0.2s", background: "#161410" },
  uploadZoneDragging: { borderColor: "#8b6539", background: "#1e1a14" },
  uploadIcon: { fontSize: "22px", flexShrink: 0 },
  uploadText: { fontSize: "13px", color: "#6b5e4a", lineHeight: "1.6" },
  uploadSub: { fontSize: "11px", color: "#4a3f2f" },
  uploadStatus: { fontSize: "13px", color: "#c9a96e", padding: "8px 12px", background: "#1e1a14", borderRadius: "8px", border: "1px solid #2e2820" },
  kbEditor: { flex: 1, background: "#0f0e0c", border: "1px solid #2e2820", borderRadius: "10px", padding: "16px", color: "#c4b49a", fontSize: "13px", fontFamily: "monospace", lineHeight: "1.7", outline: "none", overflowY: "auto", minHeight: "150px" },
  adminHint: { fontSize: "12px", color: "#4a3f2f", padding: "10px 14px", background: "#161410", borderRadius: "8px", border: "1px solid #2a2318", lineHeight: "1.5" },
};

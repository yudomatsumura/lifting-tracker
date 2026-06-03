import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "lifting-records-v1";
const SHARED_KEY = "lifting-leaderboard-v1";

const BALL_EMOJI = "⚽";

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export default function App() {
  const [tab, setTab] = useState("record");
  const [name, setName] = useState(() => localStorage.getItem("lifting-name") || "");
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem("lifting-name"));
  const [count, setCount] = useState("");
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [shared, setShared] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [inputName, setInputName] = useState("");
  const countRef = useRef(null);

  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const todayKey = new Date().toISOString().slice(0, 10);
  const best = records.length ? Math.max(...records.map(r => r.count)) : 0;
  const todayRecord = records.find(r => r.date === todayKey);

  const loadShared = async () => {
    try {
      const result = await window.storage.list("lb:", true);
      if (!result) return;
      const entries = await Promise.all(
        result.keys.map(async (k) => {
          try {
            const d = await window.storage.get(k, true);
            return d ? JSON.parse(d.value) : null;
          } catch { return null; }
        })
      );
      setShared(
        entries
          .filter(Boolean)
          .sort((a, b) => b.best - a.best)
          .slice(0, 20)
      );
    } catch {}
  };

  useEffect(() => { loadShared(); }, []);

  const handleSetName = () => {
    if (!inputName.trim()) return;
    localStorage.setItem("lifting-name", inputName.trim());
    setName(inputName.trim());
    setNameSet(true);
  };

  const handleSubmit = async () => {
    const num = parseInt(count, 10);
    if (!num || num < 1) return;
    setSubmitting(true);
    const rec = { date: todayKey, count: num, ts: Date.now() };
    const updated = [rec, ...records.filter(r => r.date !== todayKey)].sort((a, b) => b.ts - a.ts);
    setRecords(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const newBestVal = num > best;
    if (newBestVal) setNewBest(true);

    // Push to shared leaderboard
    const myBest = Math.max(num, best);
    try {
      await window.storage.set(`lb:${name}`, JSON.stringify({ name, best: myBest, date: todayKey }), true);
    } catch {}
    await loadShared();
    setCount("");
    setSubmitting(false);
    setTimeout(() => setNewBest(false), 2000);
  };

  const streak = (() => {
    let s = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const k = d.toISOString().slice(0, 10);
      if (records.find(r => r.date === k)) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();

  const myRank = shared.findIndex(e => e.name === name) + 1;

  if (!nameSet) {
    return (
      <div style={styles.setup}>
        <div style={styles.setupCard}>
          <div style={styles.bigBall}>⚽</div>
          <h1 style={styles.setupTitle}>リフティング記録帳</h1>
          <p style={styles.setupSub}>まずはニックネームを設定してください</p>
          <input
            style={styles.nameInput}
            placeholder="例：ケンジ、田中、Taro..."
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSetName()}
            maxLength={12}
          />
          <button style={styles.setupBtn} onClick={handleSetName}>はじめる →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>⚽ リフティング記録</span>
          <span style={styles.playerTag}>{name}</span>
        </div>
        <nav style={styles.nav}>
          {["record", "history", "ranking"].map(t => (
            <button
              key={t}
              style={{ ...styles.navBtn, ...(tab === t ? styles.navBtnActive : {}) }}
              onClick={() => { setTab(t); if (t === "ranking") loadShared(); }}
            >
              {t === "record" ? "記録する" : t === "history" ? "履歴" : "ランキング"}
            </button>
          ))}
        </nav>
      </header>

      <main style={styles.main}>
        {tab === "record" && (
          <div style={styles.section}>
            <p style={styles.dateLabel}>{today}</p>

            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <span style={styles.statVal}><AnimatedNumber value={best} /></span>
                <span style={styles.statLabel}>自己最高</span>
              </div>
              <div style={{ ...styles.statCard, background: "#fff9f0", borderColor: "#f5a623" }}>
                <span style={{ ...styles.statVal, color: "#f5a623" }}>
                  {streak > 0 ? `🔥 ${streak}` : "0"}
                </span>
                <span style={styles.statLabel}>連続日数</span>
              </div>
              <div style={{ ...styles.statCard, background: "#f0fff4", borderColor: "#22c55e" }}>
                <span style={{ ...styles.statVal, color: "#22c55e" }}>
                  {myRank > 0 ? `#${myRank}` : "-"}
                </span>
                <span style={styles.statLabel}>ランク</span>
              </div>
            </div>

            {todayRecord && (
              <div style={styles.todayBadge}>
                ✅ 今日は <strong>{todayRecord.count}回</strong> 記録済み
              </div>
            )}

            <div style={styles.inputArea}>
              <label style={styles.inputLabel}>今日の回数を入力</label>
              <div style={styles.inputRow}>
                <input
                  ref={countRef}
                  type="number"
                  min="1"
                  max="99999"
                  placeholder="0"
                  value={count}
                  onChange={e => setCount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  style={styles.countInput}
                />
                <span style={styles.kai}>回</span>
              </div>
              <button
                style={{ ...styles.submitBtn, opacity: (!count || submitting) ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={!count || submitting}
              >
                {submitting ? "保存中..." : "記録する ⚽"}
              </button>
            </div>

            {newBest && (
              <div style={styles.burst}>
                🎉 新記録達成！おめでとう！
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>記録履歴</h2>
            {records.length === 0 ? (
              <p style={styles.empty}>まだ記録がありません</p>
            ) : (
              <div style={styles.histList}>
                {records.slice(0, 30).map((r, i) => {
                  const isBest = r.count === best;
                  const dt = new Date(r.date);
                  const label = dt.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
                  return (
                    <div key={r.ts} style={{ ...styles.histItem, ...(i === 0 ? styles.histItemFirst : {}) }}>
                      <span style={styles.histDate}>{label}</span>
                      <span style={styles.histCount}>
                        {isBest && <span style={styles.crown}>👑</span>}
                        {r.count.toLocaleString()}回
                      </span>
                      <div style={styles.histBar}>
                        <div style={{ ...styles.histBarFill, width: `${Math.round((r.count / best) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "ranking" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏆 友達ランキング</h2>
            <p style={styles.rankSub}>記録を保存すると自動でランキングに反映されます</p>
            {shared.length === 0 ? (
              <p style={styles.empty}>まだデータがありません。記録を保存してみよう！</p>
            ) : (
              <div style={styles.rankList}>
                {shared.map((e, i) => {
                  const isMe = e.name === name;
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={e.name} style={{ ...styles.rankItem, ...(isMe ? styles.rankItemMe : {}) }}>
                      <span style={styles.rankPos}>{medals[i] || `${i + 1}`}</span>
                      <span style={styles.rankName}>{e.name}{isMe ? " (あなた)" : ""}</span>
                      <span style={styles.rankBest}>{e.best.toLocaleString()}回</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={styles.refreshBtn} onClick={loadShared}>🔄 更新</button>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0f1e", color: "#f0f4ff", fontFamily: "'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" },
  header: { background: "linear-gradient(135deg, #0d1b3e 0%, #1a2f6b 100%)", borderBottom: "2px solid #2a4aad", position: "sticky", top: 0, zIndex: 10 },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px 8px" },
  logo: { fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" },
  playerTag: { background: "#2a4aad", color: "#90b8ff", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 },
  nav: { display: "flex", gap: 0 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#7090d0", padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", borderBottom: "3px solid transparent", transition: "all .2s" },
  navBtnActive: { color: "#fff", borderBottomColor: "#4d8cff" },
  main: { flex: 1, padding: "20px 16px 40px", maxWidth: 480, margin: "0 auto", width: "100%" },
  section: { display: "flex", flexDirection: "column", gap: 18 },
  dateLabel: { color: "#8099cc", fontSize: 13, margin: 0, textAlign: "center" },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  statCard: { background: "#0d1f4a", border: "1.5px solid #2a4aad", borderRadius: 14, padding: "14px 8px", textAlign: "center", display: "flex", flexDirection: "column", gap: 4 },
  statVal: { fontSize: 26, fontWeight: 900, color: "#4d8cff", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#7090d0", fontWeight: 600 },
  todayBadge: { background: "#0d2b1a", border: "1px solid #22c55e", borderRadius: 10, padding: "10px 14px", color: "#6ee7a0", fontSize: 14, textAlign: "center" },
  inputArea: { background: "#0d1f4a", border: "1.5px solid #2a4aad", borderRadius: 18, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" },
  inputLabel: { color: "#a0c0ff", fontSize: 14, fontWeight: 600 },
  inputRow: { display: "flex", alignItems: "baseline", gap: 8 },
  countInput: { width: 140, fontSize: 52, fontWeight: 900, color: "#fff", background: "transparent", border: "none", borderBottom: "3px solid #4d8cff", outline: "none", textAlign: "center", padding: "0 4px" },
  kai: { fontSize: 22, color: "#7090d0", fontWeight: 700 },
  submitBtn: { background: "linear-gradient(135deg, #2a6fff, #4d8cff)", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 800, padding: "14px 36px", cursor: "pointer", transition: "all .2s", letterSpacing: 1 },
  burst: { background: "linear-gradient(135deg, #f5a623, #ff6b35)", borderRadius: 14, padding: "16px", textAlign: "center", fontSize: 18, fontWeight: 800, color: "#fff", animation: "none" },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 },
  empty: { color: "#7090d0", textAlign: "center", padding: "40px 0" },
  histList: { display: "flex", flexDirection: "column", gap: 8 },
  histItem: { background: "#0d1f4a", borderRadius: 12, padding: "12px 16px", display: "grid", gridTemplateColumns: "80px 1fr", gridTemplateRows: "auto auto", gap: "4px 12px", alignItems: "center" },
  histItemFirst: { border: "1.5px solid #4d8cff" },
  histDate: { color: "#8099cc", fontSize: 13, fontWeight: 600 },
  histCount: { color: "#fff", fontSize: 18, fontWeight: 800, textAlign: "right" },
  crown: { marginRight: 4 },
  histBar: { gridColumn: "1 / -1", height: 4, background: "#1a2f6b", borderRadius: 2, overflow: "hidden" },
  histBarFill: { height: "100%", background: "linear-gradient(90deg, #2a6fff, #4d8cff)", borderRadius: 2, transition: "width .6s ease" },
  rankSub: { color: "#7090d0", fontSize: 13, margin: 0 },
  rankList: { display: "flex", flexDirection: "column", gap: 8 },
  rankItem: { background: "#0d1f4a", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 },
  rankItemMe: { border: "1.5px solid #4d8cff", background: "#0d234a" },
  rankPos: { fontSize: 22, width: 32, textAlign: "center" },
  rankName: { flex: 1, fontWeight: 700, fontSize: 15, color: "#e0ecff" },
  rankBest: { fontWeight: 900, fontSize: 18, color: "#4d8cff" },
  refreshBtn: { background: "#0d1f4a", border: "1px solid #2a4aad", color: "#7090d0", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "center" },

  // Setup screen
  setup: { minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  setupCard: { background: "#0d1f4a", border: "2px solid #2a4aad", borderRadius: 24, padding: "40px 32px", maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  bigBall: { fontSize: 64, lineHeight: 1 },
  setupTitle: { margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" },
  setupSub: { margin: 0, color: "#7090d0", fontSize: 14 },
  nameInput: { width: "100%", boxSizing: "border-box", background: "#0a0f1e", border: "2px solid #2a4aad", borderRadius: 12, color: "#fff", fontSize: 18, fontWeight: 700, padding: "12px 16px", outline: "none", textAlign: "center" },
  setupBtn: { background: "linear-gradient(135deg, #2a6fff, #4d8cff)", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 800, padding: "14px 36px", cursor: "pointer", width: "100%" },
};
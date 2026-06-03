import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://gjrtwnjobcfdpuhnvbgl.supabase.co";
const SUPABASE_KEY = "sb_publishable_O8F2wts9p5lf40S03cXYKg_C6IxLx66";
const LOCAL_KEY = "lifting-records-v1";
const NAME_KEY = "lifting-name";

async function dbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

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
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem(NAME_KEY));
  const [inputName, setInputName] = useState("");
  const [count, setCount] = useState("");
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
  });
  const [ranking, setRanking] = useState([]);
  const [todayAll, setTodayAll] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const todayKey = new Date().toISOString().slice(0, 10);
  const best = records.length ? Math.max(...records.map(r => r.count)) : 0;
  const todayRecord = records.find(r => r.date === todayKey);

  const loadRanking = async () => {
    try {
      const data = await dbFetch(`records?select=name,count,date&order=count.desc`);
      const map = {};
      for (const r of data) {
        if (!map[r.name] || r.count > map[r.name].count) map[r.name] = r;
      }
      setRanking(Object.values(map).sort((a, b) => b.count - a.count).slice(0, 20));
    } catch (e) { console.error(e); }
  };

  const loadTodayAll = async () => {
    try {
      const data = await dbFetch(`records?select=name,count,created_at&date=eq.${todayKey}&order=count.desc`);
      // 同じ人が複数回記録してたら最高値だけ残す
      const map = {};
      for (const r of data) {
        if (!map[r.name] || r.count > map[r.name].count) map[r.name] = r;
      }
      setTodayAll(Object.values(map).sort((a, b) => b.count - a.count));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadRanking(); loadTodayAll(); }, []);

  const handleSetName = () => {
    if (!inputName.trim()) return;
    localStorage.setItem(NAME_KEY, inputName.trim());
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
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    if (num > best) setNewBest(true);
    try {
      await dbFetch("records", { method: "POST", body: JSON.stringify({ name, count: num, date: todayKey }) });
      await loadRanking();
      await loadTodayAll();
    } catch (e) { console.error(e); }
    setCount("");
    setSubmitting(false);
    setTimeout(() => setNewBest(false), 2500);
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

  const myRank = ranking.findIndex(e => e.name === name) + 1;

  if (!nameSet) {
    return (
      <div style={s.setup}>
        <div style={s.setupCard}>
          <div style={{fontSize:64}}>⚽</div>
          <h1 style={s.setupTitle}>リフティング記録帳</h1>
          <p style={s.setupSub}>まずはニックネームを設定してください</p>
          <input
            style={s.nameInput}
            placeholder="例：ケンジ、田中、Taro..."
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSetName()}
            maxLength={12}
          />
          <button style={s.setupBtn} onClick={handleSetName}>はじめる →</button>
        </div>
      </div>
    );
  }

  const tabs = ["record", "today", "history", "ranking"];
  const tabLabels = { record:"記録する", today:"今日", history:"履歴", ranking:"ランキング" };

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.logo}>⚽ リフティング記録</span>
          <span style={s.playerTag}>{name}</span>
        </div>
        <nav style={s.nav}>
          {tabs.map(t => (
            <button
              key={t}
              style={{...s.navBtn, ...(tab===t?s.navBtnActive:{})}}
              onClick={() => {
                setTab(t);
                if (t === "ranking") loadRanking();
                if (t === "today") loadTodayAll();
              }}
            >
              {tabLabels[t]}
            </button>
          ))}
        </nav>
      </header>

      <main style={s.main}>

        {/* 記録する */}
        {tab === "record" && (
          <div style={s.section}>
            <p style={s.dateLabel}>{today}</p>
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <span style={s.statVal}><AnimatedNumber value={best} /></span>
                <span style={s.statLabel}>自己最高</span>
              </div>
              <div style={{...s.statCard, background:"#fff9f0", borderColor:"#f5a623"}}>
                <span style={{...s.statVal, color:"#f5a623"}}>{streak>0?`🔥${streak}`:"0"}</span>
                <span style={s.statLabel}>連続日数</span>
              </div>
              <div style={{...s.statCard, background:"#f0fff4", borderColor:"#22c55e"}}>
                <span style={{...s.statVal, color:"#22c55e"}}>{myRank>0?`#${myRank}`:"-"}</span>
                <span style={s.statLabel}>ランク</span>
              </div>
            </div>
            {todayRecord && (
              <div style={s.todayBadge}>✅ 今日は <strong>{todayRecord.count}回</strong> 記録済み</div>
            )}
            <div style={s.inputArea}>
              <label style={s.inputLabel}>今日の回数を入力</label>
              <div style={s.inputRow}>
                <input
                  type="number" min="1" max="99999" placeholder="0"
                  value={count}
                  onChange={e => setCount(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleSubmit()}
                  style={s.countInput}
                />
                <span style={s.kai}>回</span>
              </div>
              <button
                style={{...s.submitBtn, opacity:(!count||submitting)?0.5:1}}
                onClick={handleSubmit}
                disabled={!count||submitting}
              >
                {submitting?"保存中...":"記録する ⚽"}
              </button>
            </div>
            {newBest && <div style={s.burst}>🎉 新記録達成！おめでとう！</div>}
          </div>
        )}

        {/* 今日の記録 */}
        {tab === "today" && (
          <div style={s.section}>
            <div style={s.todayHeader}>
              <h2 style={s.sectionTitle}>📅 今日の記録</h2>
              <span style={s.todayDate}>{today}</span>
            </div>
            <p style={s.rankSub}>今日練習したみんなの記録です</p>

            {todayAll.length === 0 ? (
              <div style={s.emptyBox}>
                <div style={{fontSize:40, marginBottom:8}}>⚽</div>
                <p style={{margin:0, color:"#7090d0"}}>まだ誰も記録していません</p>
                <p style={{margin:"4px 0 0", color:"#506090", fontSize:12}}>最初に記録してみよう！</p>
              </div>
            ) : (
              <div style={s.rankList}>
                {todayAll.map((e, i) => {
                  const isMe = e.name === name;
                  const medals = ["🥇","🥈","🥉"];
                  const myBestCount = records.length ? Math.max(...records.map(r => r.count)) : 0;
                  const theirBest = ranking.find(r => r.name === e.name)?.count || e.count;
                  const isPersonalBest = e.count >= theirBest;
                  return (
                    <div key={e.name} style={{...s.rankItem, ...(isMe?s.rankItemMe:{})}}>
                      <span style={s.rankPos}>{medals[i]||`${i+1}`}</span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", alignItems:"center", gap:6}}>
                          <span style={s.rankName}>{e.name}{isMe?" (あなた)":""}</span>
                          {isPersonalBest && <span style={s.prBadge}>PR</span>}
                        </div>
                      </div>
                      <span style={s.rankBest}>{e.count.toLocaleString()}回</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={s.refreshBtn} onClick={loadTodayAll}>🔄 更新</button>
          </div>
        )}

        {/* 履歴 */}
        {tab === "history" && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>記録履歴</h2>
            {records.length === 0 ? (
              <p style={s.empty}>まだ記録がありません</p>
            ) : (
              <div style={s.histList}>
                {records.slice(0, 30).map((r, i) => {
                  const isBest = r.count === best;
                  const dt = new Date(r.date);
                  const label = dt.toLocaleDateString("ja-JP", {month:"short", day:"numeric", weekday:"short"});
                  return (
                    <div key={r.ts} style={{...s.histItem, ...(i===0?s.histItemFirst:{})}}>
                      <span style={s.histDate}>{label}</span>
                      <span style={s.histCount}>{isBest&&<span>👑</span>}{r.count.toLocaleString()}回</span>
                      <div style={s.histBar}>
                        <div style={{...s.histBarFill, width:`${Math.round((r.count/best)*100)}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ランキング */}
        {tab === "ranking" && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>🏆 友達ランキング</h2>
            <p style={s.rankSub}>全期間の自己ベストで競います</p>
            {ranking.length === 0 ? (
              <p style={s.empty}>まだデータがありません</p>
            ) : (
              <div style={s.rankList}>
                {ranking.map((e, i) => {
                  const isMe = e.name === name;
                  const medals = ["🥇","🥈","🥉"];
                  return (
                    <div key={e.name} style={{...s.rankItem, ...(isMe?s.rankItemMe:{})}}>
                      <span style={s.rankPos}>{medals[i]||`${i+1}`}</span>
                      <span style={s.rankName}>{e.name}{isMe?" (あなた)":""}</span>
                      <span style={s.rankBest}>{e.count.toLocaleString()}回</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={s.refreshBtn} onClick={loadRanking}>🔄 更新</button>
          </div>
        )}

      </main>
    </div>
  );
}

const s = {
  root: { minHeight:"100vh", background:"#0a0f1e", color:"#f0f4ff", fontFamily:"'Helvetica Neue',sans-serif", display:"flex", flexDirection:"column", boxSizing:"border-box" },
  header: { background:"linear-gradient(135deg,#0d1b3e,#1a2f6b)", borderBottom:"2px solid #2a4aad", position:"sticky", top:0, zIndex:10 },
  headerInner: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px 6px" },
  logo: { fontSize:16, fontWeight:800, letterSpacing:1, color:"#fff" },
  playerTag: { background:"#2a4aad", color:"#90b8ff", padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  nav: { display:"flex" },
  navBtn: { flex:1, background:"none", border:"none", color:"#7090d0", padding:"8px 0", fontSize:11, fontWeight:600, cursor:"pointer", borderBottom:"3px solid transparent" },
  navBtnActive: { color:"#fff", borderBottomColor:"#4d8cff" },
  main: { flex:1, padding:"16px 12px 40px", width:"100%", boxSizing:"border-box", maxWidth:480, margin:"0 auto" },
  section: { display:"flex", flexDirection:"column", gap:14 },
  dateLabel: { color:"#8099cc", fontSize:12, margin:0, textAlign:"center" },
  statsRow: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 },
  statCard: { background:"#0d1f4a", border:"1.5px solid #2a4aad", borderRadius:12, padding:"12px 4px", textAlign:"center", display:"flex", flexDirection:"column", gap:4, minWidth:0 },
  statVal: { fontSize:22, fontWeight:900, color:"#4d8cff", lineHeight:1 },
  statLabel: { fontSize:10, color:"#7090d0", fontWeight:600 },
  todayBadge: { background:"#0d2b1a", border:"1px solid #22c55e", borderRadius:10, padding:"10px 12px", color:"#6ee7a0", fontSize:13, textAlign:"center" },
  inputArea: { background:"#0d1f4a", border:"1.5px solid #2a4aad", borderRadius:16, padding:"20px 16px", display:"flex", flexDirection:"column", gap:12, alignItems:"center", boxSizing:"border-box", width:"100%" },
  inputLabel: { color:"#a0c0ff", fontSize:13, fontWeight:600 },
  inputRow: { display:"flex", alignItems:"baseline", gap:6 },
  countInput: { width:120, fontSize:44, fontWeight:900, color:"#fff", background:"transparent", border:"none", borderBottom:"3px solid #4d8cff", outline:"none", textAlign:"center", padding:"0 4px", minWidth:0, boxSizing:"border-box" },
  kai: { fontSize:20, color:"#7090d0", fontWeight:700 },
  submitBtn: { background:"linear-gradient(135deg,#2a6fff,#4d8cff)", border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:800, padding:"13px 0", cursor:"pointer", width:"100%", letterSpacing:1 },
  burst: { background:"linear-gradient(135deg,#f5a623,#ff6b35)", borderRadius:14, padding:"14px", textAlign:"center", fontSize:16, fontWeight:800, color:"#fff" },
  todayHeader: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  todayDate: { color:"#7090d0", fontSize:12 },
  emptyBox: { background:"#0d1f4a", border:"1.5px solid #2a4aad", borderRadius:14, padding:"32px 16px", textAlign:"center" },
  prBadge: { background:"#f5a623", color:"#000", fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:6 },
  sectionTitle: { fontSize:17, fontWeight:800, color:"#fff", margin:0 },
  empty: { color:"#7090d0", textAlign:"center", padding:"40px 0" },
  histList: { display:"flex", flexDirection:"column", gap:8 },
  histItem: { background:"#0d1f4a", borderRadius:12, padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr auto", gridTemplateRows:"auto auto", gap:"4px 8px", alignItems:"center", boxSizing:"border-box" },
  histItemFirst: { border:"1.5px solid #4d8cff" },
  histDate: { color:"#8099cc", fontSize:12, fontWeight:600 },
  histCount: { color:"#fff", fontSize:16, fontWeight:800, textAlign:"right", whiteSpace:"nowrap" },
  histBar: { gridColumn:"1/-1", height:4, background:"#1a2f6b", borderRadius:2, overflow:"hidden" },
  histBarFill: { height:"100%", background:"linear-gradient(90deg,#2a6fff,#4d8cff)", borderRadius:2 },
  rankSub: { color:"#7090d0", fontSize:12, margin:0 },
  rankList: { display:"flex", flexDirection:"column", gap:8 },
  rankItem: { background:"#0d1f4a", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, boxSizing:"border-box", minWidth:0 },
  rankItemMe: { border:"1.5px solid #4d8cff", background:"#0d234a" },
  rankPos: { fontSize:20, width:28, textAlign:"center", flexShrink:0 },
  rankName: { flex:1, fontWeight:700, fontSize:14, color:"#e0ecff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 },
  rankBest: { fontWeight:900, fontSize:16, color:"#4d8cff", flexShrink:0, whiteSpace:"nowrap" },
  refreshBtn: { background:"#0d1f4a", border:"1px solid #2a4aad", color:"#7090d0", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:600, alignSelf:"center" },
  setup: { minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", padding:20, boxSizing:"border-box" },
  setupCard: { background:"#0d1f4a", border:"2px solid #2a4aad", borderRadius:24, padding:"36px 24px", maxWidth:360, width:"100%", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:14, boxSizing:"border-box" },
  setupTitle: { margin:0, fontSize:22, fontWeight:900, color:"#fff" },
  setupSub: { margin:0, color:"#7090d0", fontSize:13 },
  nameInput: { width:"100%", boxSizing:"border-box", background:"#0a0f1e", border:"2px solid #2a4aad", borderRadius:12, color:"#fff", fontSize:16, fontWeight:700, padding:"12px 14px", outline:"none", textAlign:"center" },
  setupBtn: { background:"linear-gradient(135deg,#2a6fff,#4d8cff)", border:"none", borderRadius:12, color:"#fff", fontSize:15, fontWeight:800, padding:"13px 0", cursor:"pointer", width:"100%" },
};
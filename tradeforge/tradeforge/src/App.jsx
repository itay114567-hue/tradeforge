import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ComposedChart, Scatter, ScatterChart
} from "recharts";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values from https://supabase.com/dashboard
const SUPABASE_URL    = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON   = "YOUR_SUPABASE_ANON_KEY";

// ─── STRIPE CONFIG ────────────────────────────────────────────────────────────
// Your Stripe Publishable Key (safe to expose in frontend)
const STRIPE_PUB_KEY  = "pk_live_YOUR_STRIPE_PUBLISHABLE_KEY";
// Your backend URL (Supabase Edge Function or Node server) that creates Checkout Sessions
const BACKEND_URL     = "https://YOUR_PROJECT_ID.supabase.co/functions/v1";

// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────
const PLANS = {
  free:    { label:"Free Tier",   chartAnalyses:2,  aiMessages:3,  price:0 },
  monthly: { label:"Pro Monthly", chartAnalyses:999, aiMessages:999, price:20 },
  annual:  { label:"Pro Annual",  chartAnalyses:999, aiMessages:999, price:200 },
};

// ─── SUPABASE CLIENT (minimal, no SDK needed) ─────────────────────────────────
const sb = {
  headers: () => ({ "Content-Type":"application/json", "apikey": SUPABASE_ANON, "Authorization":"Bearer "+SUPABASE_ANON }),
  authHeaders: (token) => ({ "Content-Type":"application/json", "apikey": SUPABASE_ANON, "Authorization":"Bearer "+token }),

  async getSession() {
    const stored = localStorage.getItem("tp_session");
    if(!stored) return null;
    try {
      const s = JSON.parse(stored);
      if(s.expires_at && Date.now()/1000 > s.expires_at - 60) {
        // Refresh token
        const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method:"POST", headers:this.headers(),
          body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        if(!r.ok){ localStorage.removeItem("tp_session"); return null; }
        const ns = await r.json();
        localStorage.setItem("tp_session", JSON.stringify(ns));
        return ns;
      }
      return s;
    } catch(_){ localStorage.removeItem("tp_session"); return null; }
  },

  async signInWithGoogle() {
    const redirectTo = window.location.origin + window.location.pathname;
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  },

  async handleOAuthCallback() {
    const hash = window.location.hash;
    if(!hash.includes("access_token")) return null;
    const params = new URLSearchParams(hash.slice(1));
    const session = {
      access_token:  params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      expires_at:    Math.floor(Date.now()/1000) + parseInt(params.get("expires_in")||"3600"),
      user: { email: params.get("email") },
    };
    // Get full user info
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: this.authHeaders(session.access_token) });
      if(r.ok){ const u = await r.json(); session.user = u; }
    } catch(_){}
    localStorage.setItem("tp_session", JSON.stringify(session));
    window.history.replaceState(null,"",window.location.pathname);
    return session;
  },

  async signOut(token) {
    try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers: this.authHeaders(token) }); } catch(_){}
    localStorage.removeItem("tp_session");
  },

  async getUsage(userId, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usage?user_id=eq.${userId}&select=*`, { headers: this.authHeaders(token) });
    if(!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  },

  async upsertUsage(userId, token, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usage`, {
      method:"POST",
      headers: { ...this.authHeaders(token), "Prefer":"resolution=merge-duplicates" },
      body: JSON.stringify({ user_id:userId, ...data }),
    });
    return r.ok;
  },
};

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth(){ return useContext(AuthCtx); }

function AuthProvider({ children }){
  const [session,  setSession]  = useState(undefined); // undefined = loading
  const [usage,    setUsage]    = useState({ chart_analyses:0, ai_messages:0, plan:"free" });
  const [paywallFor, setPaywallFor] = useState(null); // "chart"|"chat"

  const refreshUsage = useCallback(async (sess) => {
    if(!sess) return;
    const u = await sb.getUsage(sess.user.id, sess.access_token);
    if(u) setUsage({ chart_analyses: u.chart_analyses||0, ai_messages: u.ai_messages||0, plan: u.plan||"free" });
    else  setUsage({ chart_analyses:0, ai_messages:0, plan:"free" });
  },[]);

  useEffect(()=>{
    (async()=>{
      // Handle OAuth redirect
      const fromOAuth = await sb.handleOAuthCallback();
      const sess = fromOAuth || await sb.getSession();
      setSession(sess);
      if(sess) await refreshUsage(sess);
    })();
  },[]);

  const signIn  = () => sb.signInWithGoogle();
  const signOut = async () => { if(session) await sb.signOut(session.access_token); setSession(null); };

  const canUse = (feature) => {
    const plan = PLANS[usage.plan] || PLANS.free;
    if(feature === "chart") return usage.chart_analyses < plan.chartAnalyses;
    if(feature === "chat")  return usage.ai_messages   < plan.aiMessages;
    return true;
  };

  const recordUse = async (feature) => {
    if(!session) return;
    const next = feature==="chart"
      ? { chart_analyses: (usage.chart_analyses||0)+1 }
      : { ai_messages:    (usage.ai_messages||0)+1   };
    setUsage(u=>({...u,...next}));
    await sb.upsertUsage(session.user.id, session.access_token, { ...next, plan: usage.plan });
  };

  const checkAndUse = (feature, onAllowed) => {
    if(!session){ setPaywallFor("login"); return; }
    if(!canUse(feature)){ setPaywallFor(feature); return; }
    onAllowed();
  };

  return (
    <AuthCtx.Provider value={{ session, usage, signIn, signOut, canUse, recordUse, checkAndUse, paywallFor, setPaywallFor, refreshUsage }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen(){
  const { signIn } = useAuth();
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,gap:28}}>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{width:56,height:56,borderRadius:14,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>📊</div>
        <div className="mono" style={{fontSize:26,fontWeight:700,color:C.text,marginBottom:6}}>Trade<span style={{color:C.accent}}>Proof</span></div>
        <div style={{color:C.textMuted,fontSize:13,maxWidth:340,lineHeight:1.7}}>Professional trading analytics powered by AI. Sign in to start your free analysis.</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:340,display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[
            {icon:"📈",text:"AI Chart Analysis with Smart Money methodology"},
            {icon:"🤖",text:"AI Chat for trading strategy insights"},
            {icon:"📋",text:"Full performance analytics & reporting"},
          ].map(({icon,text})=>(
            <div key={text} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"6px 0"}}>
              <span style={{fontSize:14,marginTop:1}}>{icon}</span>
              <span style={{color:C.textDim,fontSize:12,lineHeight:1.5}}>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={signIn} style={{
          width:"100%",padding:"11px 0",borderRadius:10,border:`1px solid ${C.borderLight}`,
          background:"white",color:"#1a1a1a",cursor:"pointer",fontSize:13,fontWeight:600,
          fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          transition:"opacity .15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l6-6C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.8 1.1 8 2.9l6-6C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.7-5l-6.3-5.3C29.5 35.3 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.4L5.6 34C9 40 16 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.3 5.3C41 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
          Continue with Google
        </button>
        <div style={{color:C.textMuted,fontSize:10,textAlign:"center",lineHeight:1.6}}>Free tier: 2 chart analyses & 3 AI messages/month.<br/>No credit card required.</div>
      </div>
    </div>
  );
}

// ─── PAYWALL MODAL ────────────────────────────────────────────────────────────
function PaywallModal(){
  const { paywallFor, setPaywallFor, session, usage } = useAuth();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(false);
  if(!paywallFor || paywallFor==="login") return null;

  const featureLabel = paywallFor==="chart" ? "Chart Analyses" : "AI Messages";
  const featureUsed  = paywallFor==="chart" ? usage.chart_analyses : usage.ai_messages;
  const featureLimit = PLANS.free[paywallFor==="chart"?"chartAnalyses":"aiMessages"];

  const subscribe = async () => {
    if(!session) return;
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/create-checkout`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+session.access_token },
        body: JSON.stringify({ billing_cycle: billingCycle, user_id: session.user.id }),
      });
      const { url } = await r.json();
      if(url) window.location.href = url;
    } catch(e) { alert("Error: "+e.message); }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setPaywallFor(null)}>
      <div style={{background:C.panel,border:`1px solid ${C.borderLight}`,borderRadius:18,padding:28,maxWidth:420,width:"100%",boxShadow:"0 24px 80px #00000090"}} onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:32,marginBottom:8}}>🔒</div>
          <div style={{color:C.text,fontSize:17,fontWeight:700,marginBottom:6}}>Free Tier Limit Reached</div>
          <div style={{color:C.textMuted,fontSize:12,lineHeight:1.7}}>You've used <strong style={{color:C.yellow}}>{featureUsed}/{featureLimit}</strong> free {featureLabel}.<br/>Upgrade to Pro for unlimited access.</div>
        </div>

        {/* Billing toggle */}
        <div style={{display:"flex",background:C.bg,borderRadius:10,padding:4,marginBottom:18,border:`1px solid ${C.border}`}}>
          {["monthly","annual"].map(c=>(
            <button key={c} onClick={()=>setBillingCycle(c)} style={{
              flex:1,padding:"8px 0",borderRadius:7,border:"none",cursor:"pointer",
              background:billingCycle===c?C.accentDim:"transparent",
              color:billingCycle===c?C.accent:C.textMuted,
              fontSize:12,fontWeight:billingCycle===c?700:400,fontFamily:"'Inter',sans-serif",
              transition:"all .15s",
            }}>
              {c==="monthly"?"Monthly — $20/mo":"Annual — $200/yr"}
              {c==="annual"&&<span style={{marginLeft:5,background:C.greenDim,color:C.green,borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,border:`1px solid ${C.greenBorder}`}}>save 17%</span>}
            </button>
          ))}
        </div>

        {/* Features */}
        <div style={{background:C.panel2,borderRadius:10,padding:"12px 14px",marginBottom:18}}>
          {[
            "Unlimited AI Chart Analyses",
            "Unlimited AI Chat Messages",
            "All Analytics Tabs",
            "Priority AI Response",
          ].map(f=>(
            <div key={f} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0"}}>
              <span style={{color:C.green,fontSize:13}}>✓</span>
              <span style={{color:C.textDim,fontSize:12}}>{f}</span>
            </div>
          ))}
        </div>

        <button onClick={subscribe} disabled={loading} style={{
          width:"100%",padding:"12px 0",borderRadius:10,border:"none",
          background:loading?C.accentDim:`linear-gradient(135deg, ${C.accent}, ${C.accentAlt})`,
          color:"white",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",
          fontFamily:"'Inter',sans-serif",transition:"opacity .15s",
        }}>{loading?"Redirecting to Stripe...":"Upgrade to Pro →"}</button>
        <button onClick={()=>setPaywallFor(null)} style={{width:"100%",marginTop:8,padding:"8px 0",background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── BILLING PAGE ─────────────────────────────────────────────────────────────
function BillingPage(){
  const { session, usage, signOut, setPaywallFor } = useAuth();
  const user = session?.user;
  const plan = PLANS[usage.plan] || PLANS.free;
  const isPro = usage.plan !== "free";

  const StatBar=({used,max,label})=>{
    const pct = max>=999 ? 100 : Math.min((used/max)*100,100);
    const color = pct>=90?C.red:pct>=60?C.yellow:C.green;
    return (
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{color:C.textDim,fontSize:12}}>{label}</span>
          <span className="mono" style={{color:C.text,fontSize:12}}>{max>=999?"∞":used+"/"+max}</span>
        </div>
        <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:color,borderRadius:3,transition:"width .4s"}}/>
        </div>
      </div>
    );
  };

  return (
    <div style={{maxWidth:560,margin:"0 auto",padding:24,display:"flex",flexDirection:"column",gap:16}}>
      {/* User card */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,display:"flex",alignItems:"center",gap:14}}>
        {user?.user_metadata?.avatar_url
          ? <img src={user.user_metadata.avatar_url} alt="" style={{width:46,height:46,borderRadius:10,border:`1px solid ${C.border}`}}/>
          : <div style={{width:46,height:46,borderRadius:10,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>👤</div>
        }
        <div style={{flex:1}}>
          <div style={{color:C.text,fontSize:15,fontWeight:600}}>{user?.user_metadata?.full_name||user?.email||"User"}</div>
          <div style={{color:C.textMuted,fontSize:12,marginTop:2}}>{user?.email}</div>
        </div>
        <button onClick={signOut} style={{padding:"6px 13px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Sign Out</button>
      </div>

      {/* Plan card */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
        <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600,marginBottom:10}}>Plan</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div>
            <div style={{color:C.text,fontSize:17,fontWeight:700}}>{plan.label}</div>
            <div style={{color:C.textMuted,fontSize:11,marginTop:2}}>{isPro?`$${plan.price}/yr or /mo — Active`:"Free — limited usage"}</div>
          </div>
          {isPro
            ? <div style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,borderRadius:8,padding:"5px 12px",color:C.green,fontSize:12,fontWeight:700}}>Active ✓</div>
            : <button onClick={()=>setPaywallFor("upgrade")} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.accentBorder}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Upgrade →</button>
          }
        </div>
        <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600,marginBottom:10}}>Usage This Month</div>
        <StatBar used={usage.chart_analyses} max={plan.chartAnalyses} label="Chart Analyses"/>
        <StatBar used={usage.ai_messages}    max={plan.aiMessages}    label="AI Chat Messages"/>
      </div>

      {!isPro&&(
        <div style={{background:C.panel,border:`1px solid ${C.accentBorder}`,borderRadius:14,padding:20}}>
          <div style={{color:C.accent,fontSize:13,fontWeight:700,marginBottom:12}}>⚡ Upgrade to Pro</div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {[
              {cycle:"monthly",price:"$20/mo",sub:""},
              {cycle:"annual", price:"$200/yr",sub:"save $40"},
            ].map(({cycle,price,sub})=>(
              <button key={cycle} onClick={()=>setPaywallFor("upgrade")} style={{
                flex:1,padding:"10px 0",borderRadius:9,border:`1px solid ${C.accentBorder}`,
                background:C.accentDim,color:C.accent,cursor:"pointer",fontFamily:"'Inter',sans-serif",
                display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              }}>
                <span style={{fontSize:13,fontWeight:700}}>{price}</span>
                {sub&&<span style={{fontSize:10,color:C.green}}>{sub}</span>}
              </button>
            ))}
          </div>
          <div style={{color:C.textMuted,fontSize:11}}>Unlimited analyses, AI messages, and all features.</div>
        </div>
      )}
    </div>
  );
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#07080c",
  panel: "#0d0f17",
  panel2: "#11141e",
  panelHover: "#141720",
  border: "#1e2235",
  borderLight: "#252a3d",
  accent: "#7c6cfa",
  accentAlt: "#5b4fe8",
  accentDim: "#7c6cfa14",
  accentBorder: "#7c6cfa30",
  accentGlow: "#7c6cfa22",
  green: "#22d3a4",
  greenDim: "#22d3a414",
  greenBorder: "#22d3a430",
  red: "#f05252",
  redDim: "#f0525214",
  yellow: "#f0a92e",
  yellowDim: "#f0a92e14",
  blue: "#4a9eff",
  blueDim: "#4a9eff14",
  purple: "#c084fc",
  text: "#e2e6f3",
  textMuted: "#4a5170",
  textDim: "#7880a0",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;font-size:14px;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:${C.panel};}
  ::-webkit-scrollbar-thumb{background:${C.borderLight};border-radius:2px;}
  ::-webkit-scrollbar-thumb:hover{background:${C.accent};}
  .mono{font-family:'JetBrains Mono',monospace;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
  .fade{animation:fadeUp .2s ease forwards;}
  input[type=number]::-webkit-inner-spin-button{opacity:.3;}
  input:focus{outline:1px solid ${C.accentBorder}!important;}
  .stat-card:hover{border-color:${C.borderLight}!important;background:${C.panelHover}!important;}
`;

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseTradingViewCSV(text) {
  const lines = text.trim().replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  if(lines.length<2) return {trades:[],warnings:[]};
  const parseRow = line => {
    const r=[]; let cur="",inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){r.push(cur.trim());cur="";}
      else{cur+=ch;}
    }
    r.push(cur.trim()); return r;
  };
  const headers = parseRow(lines[0]).map(h=>h.toLowerCase());
  const idx = name => headers.findIndex(h=>h.includes(name));
  const iType=idx("type"), iDate=headers.findIndex(h=>h.includes("date")),
        iTradeNo=idx("trade #"), iPrice=idx("price"),
        iPnl=headers.findIndex(h=>h.includes("net p&l")&&h.includes("usd")&&!h.includes("%")&&!h.includes("cum")),
        iFavUsd=headers.findIndex(h=>h.includes("favorable")&&h.includes("usd")&&!h.includes("%")),
        iAdvUsd=headers.findIndex(h=>h.includes("adverse")&&h.includes("usd")&&!h.includes("%"));
  const trades=[],warnings=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim()) continue;
    const cols=parseRow(lines[i]);
    const type=(cols[iType]||"").toLowerCase();
    if(!type.startsWith("exit")) continue;
    const pnl=parseFloat((cols[iPnl]||"").replace(/,/g,""));
    if(isNaN(pnl)){warnings.push(`Row ${i}: bad P&L`);continue;}
    const price=parseFloat((cols[iPrice]||"0").replace(/,/g,""));
    const dateStr=cols[iDate]||"";
    const signal=(cols[idx("signal")]||"").trim();
    const mfe=parseFloat((cols[iFavUsd]||"0").replace(/,/g,""))||0;
    const mae=Math.abs(parseFloat((cols[iAdvUsd]||"0").replace(/,/g,""))||0);
    const dt=dateStr?new Date(dateStr):null;
    trades.push({
      id:parseInt(cols[iTradeNo]||"0"), type:type.includes("short")?"short":"long",
      pnl, price, signal, mfe, mae,
      date:dateStr, dt,
      hour:dt?dt.getUTCHours():null,
      dow:dt?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()]:null,
      month:dt?`${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}`:null,
    });
  }
  if(!trades.length){
    for(let i=1;i<lines.length;i++){
      if(!lines[i].trim()) continue;
      const cols=parseRow(lines[i]);
      const pnl=parseFloat((cols[iPnl]||"").replace(/,/g,""));
      if(isNaN(pnl)||pnl===0) continue;
      const type=(cols[iType]||"").toLowerCase();
      const dateStr=cols[iDate]||"";
      const dt=dateStr?new Date(dateStr):null;
      trades.push({
        id:i, type:type.includes("short")?"short":"long",
        pnl, price:parseFloat((cols[iPrice]||"0").replace(/,/g,"")),
        date:dateStr, dt,
        hour:dt?dt.getUTCHours():null,
        dow:dt?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getUTCDay()]:null,
        month:dt?`${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}`:null,
        mfe:0, mae:0, signal:"",
      });
    }
  }
  return {trades,warnings};
}

// ─── STATS ENGINE ─────────────────────────────────────────────────────────────
function calcStats(trades, accountSize=100000) {
  if(!trades||!trades.length) return null;
  const pnls=trades.map(t=>t.pnl);
  const wins=trades.filter(t=>t.pnl>0), losses=trades.filter(t=>t.pnl<=0);
  const netProfit=pnls.reduce((a,b)=>a+b,0);
  const winRate=wins.length/trades.length;
  const avgWin=wins.length?wins.reduce((a,t)=>a+t.pnl,0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((a,t)=>a+t.pnl,0)/losses.length):0;
  const grossProfit=wins.reduce((a,t)=>a+t.pnl,0);
  const grossLoss=Math.abs(losses.reduce((a,t)=>a+t.pnl,0));
  const profitFactor=grossLoss>0?grossProfit/grossLoss:grossProfit>0?99:0;
  const expectancy=winRate*avgWin-(1-winRate)*avgLoss;
  const mean=netProfit/trades.length;
  const variance=pnls.reduce((a,p)=>a+(p-mean)**2,0)/trades.length;
  const stdDev=Math.sqrt(variance);
  const sharpe=stdDev>0?(mean/stdDev)*Math.sqrt(252):0;
  const downDev=Math.sqrt(losses.reduce((a,t)=>a+t.pnl**2,0)/(losses.length||1));
  const sortino=downDev>0?(mean/downDev)*Math.sqrt(252):0;

  let equity=0,peak=0,maxDD=0,maxDDPct=0;
  const equityCurve=trades.map(t=>{
    equity+=t.pnl; if(equity>peak)peak=equity;
    const dd=peak-equity;
    if(dd>maxDD){maxDD=dd;maxDDPct=peak>0?dd/peak:0;}
    return {equity,dd,pnl:t.pnl};
  });
  const calmar=maxDD>0?netProfit/maxDD:0;
  const omega=profitFactor;

  let cw=0,cl=0,mw=0,ml=0;
  for(const t of trades){
    if(t.pnl>0){cw++;cl=0;mw=Math.max(mw,cw);}else{cl++;cw=0;ml=Math.max(ml,cl);}
  }

  const monthly={};
  trades.forEach(t=>{
    const key=t.month||`M${Math.floor(trades.indexOf(t)/20)+1}`;
    if(!monthly[key])monthly[key]={pnl:0,count:0};
    monthly[key].pnl+=t.pnl; monthly[key].count++;
  });
  const monthlyArr=Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>({name:k,...v}));

  const byHour={};
  trades.forEach(t=>{
    if(t.hour===null)return;
    if(!byHour[t.hour])byHour[t.hour]={pnl:0,count:0,wins:0};
    byHour[t.hour].pnl+=t.pnl; byHour[t.hour].count++;
    if(t.pnl>0)byHour[t.hour].wins++;
  });
  const hourlyArr=Object.entries(byHour).sort(([a],[b])=>+a-+b)
    .map(([h,v])=>({hour:`${h}:00`,pnl:v.pnl,count:v.count,wr:v.wins/v.count}));

  const DOW_ORDER=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const byDow={};
  trades.forEach(t=>{
    if(!t.dow)return;
    if(!byDow[t.dow])byDow[t.dow]={pnl:0,count:0,wins:0};
    byDow[t.dow].pnl+=t.pnl; byDow[t.dow].count++;
    if(t.pnl>0)byDow[t.dow].wins++;
  });
  const dowArr=DOW_ORDER.filter(d=>byDow[d]).map(d=>({day:d,...byDow[d],wr:byDow[d].wins/byDow[d].count}));

  const minP=Math.min(...pnls),maxP=Math.max(...pnls);
  const BINS=24,bSize=(maxP-minP)/BINS||1;
  const hist=Array.from({length:BINS},(_,i)=>({
    x:+(minP+i*bSize).toFixed(0),
    count:pnls.filter(p=>p>=minP+i*bSize&&p<minP+(i+1)*bSize).length
  }));

  let pullbacks=[],inDD=false,ddStart=0;
  equityCurve.forEach(({equity:eq,dd})=>{
    if(dd>0&&!inDD){inDD=true;ddStart=eq+dd;}
    if(dd===0&&inDD){pullbacks.push(ddStart-(eq));inDD=false;}
  });
  const typicalPullback=pullbacks.length?pullbacks.reduce((a,b)=>a+b,0)/pullbacks.length:maxDD*0.4;

  let lossStreaks=[],cs=0;
  for(const t of trades){if(t.pnl<=0){cs++;}else{if(cs>1)lossStreaks.push(cs);cs=0;}}
  if(cs>1)lossStreaks.push(cs);
  const avgLossStreak=lossStreaks.length?lossStreaks.reduce((a,b)=>a+b,0)/lossStreaks.length:0;

  return {
    netProfit,winRate,profitFactor,expectancy,avgWin,avgLoss,
    grossProfit,grossLoss,maxDD,maxDDPct,stdDev,sharpe,sortino,calmar,omega,
    wins:wins.length,losses:losses.length,total:trades.length,mean,
    maxConsecWins:mw,maxConsecLoss:ml,
    equityCurve,monthlyArr,hourlyArr,dowArr,hist,
    typicalPullback,avgLossStreak,
    profitableMonths:monthlyArr.filter(m=>m.pnl>0).length,
    roi:netProfit/accountSize,
  };
}

// ─── MONTE CARLO ──────────────────────────────────────────────────────────────
function runMonteCarlo(trades, runs=1000) {
  const pnls=trades.map(t=>t.pnl);
  const finals=[],dds=[];
  const SAMPLE=40,step=Math.max(1,Math.floor(runs/SAMPLE));
  const samplePaths=[];
  for(let r=0;r<runs;r++){
    const sh=[...pnls].sort(()=>Math.random()-.5);
    let eq=0,pk=0,mdd=0;
    const path=sh.map(p=>{
      eq+=p; if(eq>pk)pk=eq;
      const dd=pk-eq; if(dd>mdd)mdd=dd;
      return eq;
    });
    finals.push(eq); dds.push(mdd);
    if(r%step===0) samplePaths.push(path);
  }
  finals.sort((a,b)=>a-b); dds.sort((a,b)=>a-b);
  return {
    p10:finals[Math.floor(runs*.1)], p25:finals[Math.floor(runs*.25)],
    p50:finals[Math.floor(runs*.5)], p75:finals[Math.floor(runs*.75)],
    p90:finals[Math.floor(runs*.9)],
    ddP50:dds[Math.floor(runs*.5)], ddP90:dds[Math.floor(runs*.9)],
    samplePaths, runs,
  };
}

function calcSurvival(trades, maxDD, runs=500) {
  const pnls=trades.map(t=>t.pnl);
  let survived=0;
  for(let r=0;r<runs;r++){
    const sh=[...pnls].sort(()=>Math.random()-.5);
    let eq=0,pk=0,ok=true;
    for(const p of sh){eq+=p;if(eq>pk)pk=eq;if(pk-eq>=maxDD){ok=false;break;}}
    if(ok)survived++;
  }
  return survived/runs;
}

// ─── PROP FIRM SIM ────────────────────────────────────────────────────────────
function simPropFirm(trades, cfg, runs=600) {
  const {accountSize,profitTarget,maxDD,maxDailyLoss,minDays,challengeCost,payoutSplit,minPayout}=cfg;
  const pnls=trades.map(t=>t.pnl);
  let passed=0,totalPayouts=0;
  const accountLog=[];

  for(let r=0;r<runs;r++){
    const sh=[...pnls].sort(()=>Math.random()-.5);
    let eq=0,pk=0,days=0,dayEq=0,dayPk=0,burned=false,success=false;
    for(let i=0;i<sh.length;i++){
      if(i>0&&i%2===0){days++;dayEq=0;dayPk=eq;}
      eq+=sh[i]; dayEq+=sh[i];
      if(eq>pk)pk=eq;
      if(pk-eq>=maxDD){burned=true;break;}
      if(maxDailyLoss&&dayPk-eq>=maxDailyLoss){burned=true;break;}
      if(eq>=profitTarget&&days>=minDays){success=true;break;}
    }
    if(!success){accountLog.push({passed:false,payouts:[],totalPayout:0});continue;}
    passed++;

    const sh2=[...pnls].sort(()=>Math.random()-.5);
    let feq=0,fpk=0,payouts=[],fburnedAt=null;
    for(let i=0;i<sh2.length;i++){
      feq+=sh2[i];
      if(feq>fpk)fpk=feq;
      if(fpk-feq>=maxDD*1.5){fburnedAt=feq;break;}
      if(feq>=minPayout){
        const p=feq*payoutSplit;
        payouts.push(p); totalPayouts+=p; feq=0; fpk=0;
      }
    }
    const tp=payouts.reduce((a,b)=>a+b,0);
    accountLog.push({passed:true,payouts,totalPayout:tp,burned:fburnedAt!==null});
  }

  const passedAccounts=accountLog.filter(a=>a.passed);
  const withPayout=passedAccounts.filter(a=>a.payouts.length>0);
  const avgPayout=withPayout.length?withPayout.reduce((a,ac)=>a+ac.totalPayout,0)/withPayout.length:0;
  const survivalRate=passedAccounts.length?passedAccounts.filter(a=>!a.burned).length/passedAccounts.length:0;
  const payoutReachRate=passedAccounts.length?withPayout.length/passedAccounts.length:0;

  const passScore=Math.min(cfg.passRate||passed/runs,1)*40;
  const payoutScore=payoutReachRate*30;
  const survivalScore=survivalRate*20;
  const avgPayoutScore=Math.min(avgPayout/(challengeCost*10),1)*10;
  const readiness=Math.round(passScore+payoutScore+survivalScore+avgPayoutScore);

  return {
    passRate:passed/runs, avgPayout, totalPayouts, survivalRate, payoutReachRate,
    accountLog, readiness, passed, runs,
  };
}

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmtD=(n,d=0)=>{if(n===undefined||n===null||isNaN(n))return"—";const digits=Math.max(0,Math.min(20,Math.floor(d)||0));const abs=Math.abs(n);const str=abs.toLocaleString("en-US",{maximumFractionDigits:digits});return(n<0?"-$":"$")+str;};
const fmtP=(n)=>(n*100).toFixed(1)+"%";
const fmtN=(n,d=2)=>n===undefined?"—":n.toFixed(d);

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
function Stat({label,value,sub,color,large,onClick,icon}){
  return(
    <div className="stat-card" onClick={onClick} style={{
      background:C.panel,
      border:`1px solid ${C.border}`,
      borderRadius:10,
      padding:large?"18px 20px":"13px 16px",
      cursor:onClick?"pointer":"default",
      transition:"all .15s ease",
      position:"relative",
      overflow:"hidden",
    }}>
      {icon&&<div style={{position:"absolute",top:10,right:12,fontSize:18,opacity:.2}}>{icon}</div>}
      <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".12em",fontWeight:500,marginBottom:5}}>{label}</div>
      <div className="mono" style={{fontSize:large?22:15,fontWeight:700,color:color||C.text,letterSpacing:"-.02em"}}>{value}</div>
      {sub&&<div style={{color:C.textMuted,fontSize:11,marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Panel({children,title,action,style}){
  return(
    <div style={{
      background:C.panel,
      border:`1px solid ${C.border}`,
      borderRadius:12,
      padding:"18px 20px",
      ...style
    }}>
      {(title||action)&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          {title&&<div style={{color:C.textDim,fontSize:10,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600}}>{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Badge({children,color,style}){
  const bg=color==="green"?C.greenDim:color==="red"?C.redDim:color==="yellow"?C.yellowDim:color==="blue"?C.blueDim:C.accentDim;
  const fg=color==="green"?C.green:color==="red"?C.red:color==="yellow"?C.yellow:color==="blue"?C.blue:C.accent;
  return(
    <span style={{background:bg,color:fg,border:`1px solid ${fg}30`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,letterSpacing:".08em",...style}}>
      {children}
    </span>
  );
}

function TabBar({tabs,active,onChange}){
  return(
    <div style={{display:"flex",gap:2,background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:4,flexWrap:"wrap"}}>
      {tabs.map(t=>(
        <button key={t} onClick={()=>onChange(t)} style={{
          padding:"7px 16px",borderRadius:7,border:"none",cursor:"pointer",
          fontFamily:"'Inter',sans-serif",
          background:active===t?C.accentDim:"transparent",
          color:active===t?C.accent:C.textMuted,
          fontSize:12,fontWeight:active===t?600:400,
          outline:active===t?`1px solid ${C.accentBorder}`:"none",
          transition:"all .15s",letterSpacing:active===t?".01em":0,
        }}>{t}</button>
      ))}
    </div>
  );
}

function Spinner(){
  return <div style={{width:14,height:14,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>
}

function Btn({children,onClick,variant,disabled,small}){
  const bg=variant==="red"?C.redDim:variant==="blue"?C.blueDim:variant==="ghost"?"transparent":C.accentDim;
  const bc=variant==="red"?C.red:variant==="blue"?C.blue:variant==="ghost"?C.border:C.accent;
  return(
    <button onClick={onClick} disabled={disabled} style={{
      display:"inline-flex",alignItems:"center",gap:6,
      padding:small?"6px 14px":"9px 20px",
      borderRadius:8,border:`1px solid ${bc}40`,
      background:bg,color:bc,cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?.45:1,fontSize:small?11:12,
      fontFamily:"'Inter',sans-serif",fontWeight:600,
      letterSpacing:".02em",transition:"all .15s",
    }}>{children}</button>
  );
}

function NumInput({label,value,onChange,step=100,min,style}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5,...style}}>
      <label style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontWeight:500}}>{label}</label>
      <input type="number" value={value} step={step} min={min}
        onChange={e=>onChange(+e.target.value)}
        style={{
          background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,
          padding:"8px 12px",color:C.text,fontSize:13,
          fontFamily:"'JetBrains Mono',monospace",width:"100%",
          transition:"border-color .15s",
        }}
      />
    </div>
  );
}

const CustomTooltip=({active,payload,label,fmt})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 8px 24px #00000060"}}>
      <div style={{color:C.textMuted,marginBottom:6,fontSize:11}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||C.text,fontWeight:600}} className="mono">
          {p.name}: {fmt?fmt(p.value):p.value}
        </div>
      ))}
    </div>
  );
};

function ScoreRing({score,size=80}){
  const r=32, circ=2*Math.PI*r;
  const pct=score/100;
  const color=score>=70?C.green:score>=50?C.yellow:C.red;
  return(
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke={C.border} strokeWidth="6"/>
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{transition:"stroke-dashoffset .8s ease"}}/>
      <text x="40" y="44" textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="JetBrains Mono">{score}</text>
    </svg>
  );
}

// ─── SUMMARY TAB ─────────────────────────────────────────────────────────────
function SummaryTab({trades,stats}){
  const strategyType=stats.winRate>=.65?"High Win Rate":stats.profitFactor>=2.5?"High PF":stats.avgWin/stats.avgLoss>=2?"High R:R":"Balanced";
  const score=Math.min(100,Math.round(
    (stats.profitFactor>=1.5?25:stats.profitFactor>=1?15:0)+
    (stats.winRate>=.55?20:stats.winRate>=.45?10:0)+
    (stats.sharpe>=1?20:stats.sharpe>=.5?10:0)+
    (stats.maxDDPct<=.1?20:stats.maxDDPct<=.2?10:0)+
    (stats.expectancy>0?15:0)
  ));
  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Hero row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
        <Stat large label="Net Profit" value={fmtD(stats.netProfit)} color={stats.netProfit>=0?C.green:C.red} icon="💰"/>
        <Stat large label="Win Rate" value={fmtP(stats.winRate)} color={stats.winRate>=.55?C.green:stats.winRate>=.45?C.yellow:C.red} icon="🎯"/>
        <Stat large label="Profit Factor" value={fmtN(stats.profitFactor)} color={stats.profitFactor>=1.5?C.green:stats.profitFactor>=1?C.yellow:C.red} icon="⚖️"/>
        <Stat large label="Expectancy" value={fmtD(stats.expectancy)} color={stats.expectancy>=0?C.green:C.red} icon="📐"/>
        <Stat label="Max Drawdown" value={fmtD(stats.maxDD)} sub={fmtP(stats.maxDDPct)} color={C.red}/>
        <Stat label="Avg Win" value={fmtD(stats.avgWin)} color={C.green}/>
        <Stat label="Avg Loss" value={fmtD(-stats.avgLoss)} color={C.red}/>
        <Stat label="W:L Ratio" value={fmtN(stats.avgWin/(stats.avgLoss||1))} color={stats.avgWin/stats.avgLoss>=1?C.green:C.yellow}/>
        <Stat label="Total Trades" value={stats.total}/>
        <Stat label="Sharpe" value={fmtN(stats.sharpe)} color={stats.sharpe>=1?C.green:stats.sharpe>=.5?C.yellow:C.red}/>
        <Stat label="Sortino" value={fmtN(stats.sortino)} color={stats.sortino>=1?C.green:C.yellow}/>
        <Stat label="Calmar" value={fmtN(stats.calmar)} color={stats.calmar>=.5?C.green:C.yellow}/>
        <Stat label="Gross Profit" value={fmtD(stats.grossProfit)} color={C.green}/>
        <Stat label="Gross Loss" value={fmtD(-stats.grossLoss)} color={C.red}/>
        <Stat label="Std Dev" value={fmtD(stats.stdDev)}/>
        <Stat label="Max Consec Wins" value={stats.maxConsecWins} color={C.green}/>
        <Stat label="Max Consec Loss" value={stats.maxConsecLoss} color={C.red}/>
        <Stat label="Omega" value={fmtN(stats.omega)} color={stats.omega>=1?C.green:C.red}/>
      </div>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Panel title="Equity Curve">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={stats.equityCurve}>
              <defs>
                <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent} stopOpacity={.3}/>
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
              <XAxis hide/>
              <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip fmt={fmtD}/>}/>
              <ReferenceLine y={0} stroke={C.borderLight}/>
              <Area type="monotone" dataKey="equity" name="Equity" stroke={C.accent} strokeWidth={2} fill="url(#eqg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Drawdown">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={stats.equityCurve}>
              <defs>
                <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.red} stopOpacity={.35}/>
                  <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
              <XAxis hide/>
              <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip fmt={fmtD}/>}/>
              <Area type="monotone" dataKey="dd" name="Drawdown" stroke={C.red} strokeWidth={2} fill="url(#ddg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Score + tags */}
      <Panel>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <ScoreRing score={score}/>
            <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em"}}>Strategy Score</div>
          </div>
          <div style={{flex:1,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start",paddingTop:4}}>
            {[
              {label:"Type",v:strategyType,c:C.accent},
              {label:"Wins / Losses",v:`${stats.wins}W / ${stats.losses}L`},
              {label:"Profitable Months",v:`${stats.profitableMonths}/${stats.monthlyArr.length}`},
              {label:"Typical Pullback",v:fmtD(stats.typicalPullback),c:C.yellow},
              {label:"Avg Loss Streak",v:fmtN(stats.avgLossStreak,1)+" trades",c:C.red},
              {label:"ROI",v:fmtP(stats.roi),c:stats.roi>=0?C.green:C.red},
            ].map(({label,v,c})=>(
              <div key={label} style={{
                background:C.panel2,
                border:`1px solid ${C.border}`,
                borderRadius:8,padding:"8px 14px",
              }}>
                <div style={{color:C.textMuted,fontSize:10,marginBottom:3,letterSpacing:".08em",textTransform:"uppercase"}}>{label}</div>
                <div className="mono" style={{color:c||C.text,fontWeight:700,fontSize:13}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── PERFORMANCE TAB ─────────────────────────────────────────────────────────
function PerformanceTab({trades,stats}){
  const [highlight,setHighlight]=useState(null);
  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel title="Monthly P&L">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.monthlyArr} margin={{top:4,right:4,left:0,bottom:0}}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="name" tick={{fill:C.textMuted,fontSize:10}} angle={-30} textAnchor="end" height={40} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} formatter={v=>[fmtD(v),"P&L"]}/>
            <ReferenceLine y={0} stroke={C.borderLight}/>
            <Bar dataKey="pnl" radius={[4,4,0,0]}>
              {stats.monthlyArr.map((e,i)=><Cell key={i} fill={e.pnl>=0?C.green:C.red} opacity={.9}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{marginTop:10,display:"flex",gap:6,alignItems:"center"}}>
          <Badge color="green">{stats.profitableMonths} profitable</Badge>
          <Badge color="red">{stats.monthlyArr.length-stats.profitableMonths} losing</Badge>
          <span style={{color:C.textMuted,fontSize:11,marginLeft:4}}>out of {stats.monthlyArr.length} months</span>
        </div>
      </Panel>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Panel title="P&L Distribution">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats.hist}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="x" tick={{fill:C.textMuted,fontSize:9}} tickFormatter={v=>fmtD(v)} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} labelFormatter={fmtD} formatter={v=>[v,"Trades"]}/>
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {stats.hist.map((e,i)=><Cell key={i} fill={e.x>=0?C.green:C.red} opacity={.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Stat label="Gross Profit" value={fmtD(stats.grossProfit)} color={C.green}/>
          <Stat label="Gross Loss" value={fmtD(-stats.grossLoss)} color={C.red}/>
          <Stat label="Avg Win" value={fmtD(stats.avgWin)} color={C.green}/>
          <Stat label="Avg Loss" value={fmtD(-stats.avgLoss)} color={C.red}/>
          <Stat label="Win / Loss Ratio" value={fmtN(stats.avgWin/(stats.avgLoss||1))}/>
        </div>
      </div>

      <Panel title="Trade Log">
        <div style={{maxHeight:260,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{position:"sticky",top:0,background:C.panel}}>
              <tr>{["#","Date","Dir","P&L","MFE","MAE"].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.textMuted,textAlign:h==="P&L"||h==="MFE"||h==="MAE"?"right":"left",borderBottom:`1px solid ${C.border}`,fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:".08em"}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {trades.map((t,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}18`,background:highlight===i?C.accentDim:"transparent",transition:"background .1s"}}
                  onMouseEnter={()=>setHighlight(i)} onMouseLeave={()=>setHighlight(null)}>
                  <td style={{padding:"6px 10px",color:C.textMuted}} className="mono">{t.id}</td>
                  <td style={{padding:"6px 10px",color:C.textDim,fontSize:11}}>{t.date?.slice(0,16)||"—"}</td>
                  <td style={{padding:"6px 10px"}}>
                    <Badge color={t.type==="long"?"green":"blue"}>{t.type.toUpperCase()}</Badge>
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",color:t.pnl>=0?C.green:C.red,fontWeight:700}} className="mono">{fmtD(t.pnl)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",color:C.green,fontSize:11}} className="mono">{t.mfe?fmtD(t.mfe):"—"}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",color:C.red,fontSize:11}} className="mono">{t.mae?fmtD(-t.mae):"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ─── RISK TAB ─────────────────────────────────────────────────────────────────
function RiskTab({trades,stats}){
  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:8}}>
        <Stat large label="Max Drawdown ($)" value={fmtD(stats.maxDD)} color={C.red}/>
        <Stat large label="Max Drawdown (%)" value={fmtP(stats.maxDDPct)} color={C.red}/>
        <Stat label="Typical Pullback" value={fmtD(stats.typicalPullback)} sub="Avg DD from equity peak" color={C.yellow}/>
        <Stat label="Loss Volatility" value={fmtD(stats.stdDev)} sub="Std deviation of trades"/>
        <Stat label="Max Consec Losses" value={stats.maxConsecLoss} color={C.red}/>
        <Stat label="Avg Loss Streak" value={fmtN(stats.avgLossStreak,1)+" trades"} color={C.yellow}/>
        <Stat label="Calmar Ratio" value={fmtN(stats.calmar)} color={stats.calmar>=1?C.green:C.yellow}/>
        <Stat label="Sharpe Ratio" value={fmtN(stats.sharpe)} color={stats.sharpe>=1?C.green:C.yellow}/>
      </div>

      <Panel title="Drawdown Over Time">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={stats.equityCurve}>
            <defs>
              <linearGradient id="ddg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.red} stopOpacity={.35}/>
                <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
            <XAxis hide/>
            <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
            <Tooltip content={<CustomTooltip fmt={fmtD}/>}/>
            <Area type="monotone" dataKey="dd" name="Drawdown" stroke={C.red} strokeWidth={2} fill="url(#ddg2)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="MFE vs MAE Scatter">
        <div style={{color:C.textMuted,fontSize:11,marginBottom:10}}>Each dot = one trade. Green = winner, Red = loser.</div>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{top:4,right:4,bottom:4,left:4}}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="mfe" name="MFE" tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72}/>
            <YAxis dataKey="mae" name="MAE" tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72}/>
            <Tooltip cursor={{strokeDasharray:"3 3"}} contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} formatter={(v,n)=>[fmtD(v),n]}/>
            <Scatter data={trades.map(t=>({mfe:t.mfe||0,mae:t.mae||0,pnl:t.pnl}))} fill={C.green}>
              {trades.map((t,i)=><Cell key={i} fill={t.pnl>=0?C.green:C.red} opacity={.65}/>)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

// ─── BACKTEST TAB ─────────────────────────────────────────────────────────────
function BacktestTab({trades,stats}){
  const [split,setSplit]=useState(70);
  const [mcRes,setMcRes]=useState(null);
  const [running,setRunning]=useState(false);
  const [survDD,setSurvDD]=useState(3000);
  const [survRes,setSurvRes]=useState(null);
  const [survRunning,setSurvRunning]=useState(false);

  const cutoff=Math.floor(trades.length*split/100);
  const isTrades=trades.slice(0,cutoff);
  const oosTrades=trades.slice(cutoff);
  const isStats=useMemo(()=>calcStats(isTrades),[isTrades]);
  const oosStats=useMemo(()=>oosTrades.length>5?calcStats(oosTrades):null,[oosTrades]);

  const runMC=()=>{setRunning(true);setTimeout(()=>{setMcRes(runMonteCarlo(trades,800));setRunning(false);},80);};
  const runSurv=()=>{setSurvRunning(true);setTimeout(()=>{setSurvRes(calcSurvival(trades,survDD,400));setSurvRunning(false);},80);};

  const delta=(is,oos,key,pct=false)=>{
    if(!is||!oos)return null;
    const d=oos[key]-is[key];
    return {d,ok:key==="maxDD"||key==="avgLoss"?d<=0:d>=-is[key]*.3};
  };

  const METRICS=[
    {key:"netProfit",label:"Net Profit",fmt:fmtD},
    {key:"winRate",label:"Win Rate",fmt:fmtP},
    {key:"profitFactor",label:"Profit Factor",fmt:v=>fmtN(v)},
    {key:"expectancy",label:"Expectancy",fmt:fmtD},
    {key:"maxDD",label:"Max Drawdown",fmt:fmtD},
    {key:"sharpe",label:"Sharpe",fmt:v=>fmtN(v)},
  ];

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel title="In-Sample / Out-of-Sample">
        <div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:C.textDim,fontSize:11}}>Split:</span>
          {[60,70,80,90].map(v=>(
            <button key={v} onClick={()=>setSplit(v)} style={{
              padding:"5px 13px",borderRadius:6,
              border:`1px solid ${split===v?C.accent:C.border}`,
              background:split===v?C.accentDim:"transparent",
              color:split===v?C.accent:C.textMuted,
              cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:split===v?600:400,
              transition:"all .15s",
            }}>{v}/{100-v}</button>
          ))}
        </div>
        {isStats&&(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={{padding:"7px 10px",color:C.textMuted,textAlign:"left",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase",letterSpacing:".08em"}}>Metric</th>
                <th style={{padding:"7px 10px",color:C.accent,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase"}}>In-Sample ({isTrades.length})</th>
                <th style={{padding:"7px 10px",color:C.yellow,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase"}}>Out-of-Sample ({oosTrades.length})</th>
                <th style={{padding:"7px 10px",color:C.textMuted,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase"}}>Δ Delta</th>
              </tr></thead>
              <tbody>
                {METRICS.map(({key,label,fmt})=>{
                  const d=delta(isStats,oosStats,key);
                  return(
                    <tr key={key} style={{borderBottom:`1px solid ${C.border}18`}}>
                      <td style={{padding:"8px 10px",color:C.textDim}}>{label}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.accent}} className="mono">{isStats?fmt(isStats[key]):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.yellow}} className="mono">{oosStats?fmt(oosStats[key]):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:d?d.ok?C.green:C.red:C.textMuted}} className="mono">
                        {d?`${d.d>=0?"+":""}${fmt(d.d)}`:"—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isStats&&oosStats&&(
          <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,
            background:oosStats.profitFactor>=isStats.profitFactor*.7?C.greenDim:C.redDim,
            border:`1px solid ${oosStats.profitFactor>=isStats.profitFactor*.7?C.green+"30":C.red+"40"}`}}>
            <span style={{color:oosStats.profitFactor>=isStats.profitFactor*.7?C.green:C.red,fontSize:12,fontWeight:600}}>
              {oosStats.profitFactor>=isStats.profitFactor*.7
                ?"✅ Strategy appears stable — OOS performance is consistent with IS"
                :"⚠️ Possible curve fitting — OOS degrades significantly vs IS"}
            </span>
          </div>
        )}
      </Panel>

      <Panel title="Monte Carlo Simulation"
        action={<Btn onClick={runMC} disabled={running} small>{running?<><Spinner/> Running...</>:"Run 800 Shuffles"}</Btn>}>
        <div style={{color:C.textMuted,fontSize:11,marginBottom:running?10:0}}>800 shuffled runs — equity paths & percentile bands</div>
        {mcRes&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:8}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {[["P10",mcRes.p10,C.red],["P25",mcRes.p25,C.yellow],["Median",mcRes.p50,C.green],["P75",mcRes.p75,C.green],["P90",mcRes.p90,C.green]].map(([l,v,c])=>(
                <Stat key={l} label={l+" Final"} value={fmtD(v)} color={c}/>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Stat label="Median Max DD" value={fmtD(mcRes.ddP50)} color={C.yellow}/>
              <Stat label="P90 Max DD" value={fmtD(mcRes.ddP90)} color={C.red}/>
            </div>
            <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}}>Sample Equity Paths</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                <XAxis hide/><YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke={C.borderLight}/>
                {mcRes.samplePaths.map((path,i)=>(
                  <Line key={i} data={path.map((eq,x)=>({x,eq}))} dataKey="eq" dot={false}
                    stroke={i%6===0?C.accent:C.accentBorder} strokeWidth={i%6===0?1.6:.4}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Survival Probability">
        <div style={{color:C.textMuted,fontSize:11,marginBottom:14}}>What's the chance this account survives a given max drawdown threshold?</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
          <NumInput label="Max DD Threshold ($)" value={survDD} onChange={setSurvDD} step={500} style={{width:190}}/>
          <Btn onClick={runSurv} disabled={survRunning}>{survRunning?<><Spinner/> Calculating...</>:"Calculate"}</Btn>
          {survRes!==null&&(
            <div style={{
              background:survRes>=.7?C.greenDim:survRes>=.5?C.yellowDim:C.redDim,
              border:`1px solid ${survRes>=.7?C.green+"30":survRes>=.5?C.yellow+"40":C.red+"40"}`,
              borderRadius:10,padding:"12px 20px",
            }}>
              <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em"}}>Survival Probability</div>
              <div className="mono" style={{color:survRes>=.7?C.green:survRes>=.5?C.yellow:C.red,fontSize:26,fontWeight:700,marginTop:2}}>{fmtP(survRes)}</div>
              <div style={{color:C.textMuted,fontSize:11,marginTop:4}}>
                {survRes>=.7?"✅ Safe — likely survives":survRes>=.5?"⚠️ Marginal — reduce risk":"❌ High blowup risk"}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ─── FILTERS TAB ─────────────────────────────────────────────────────────────
function FiltersTab({trades}){
  const [dir,setDir]=useState("all");
  const [selHour,setSelHour]=useState(null);
  const [selDow,setSelDow]=useState(null);

  const filtered=useMemo(()=>{
    let t=trades;
    if(dir!=="all") t=t.filter(x=>x.type===dir);
    if(selHour!==null) t=t.filter(x=>x.hour===selHour);
    if(selDow!==null) t=t.filter(x=>x.dow===selDow);
    return t;
  },[trades,dir,selHour,selDow]);

  const fStats=useMemo(()=>calcStats(filtered),[filtered]);

  const hourlyData=useMemo(()=>{
    const map={};
    trades.filter(t=>dir==="all"||t.type===dir).forEach(t=>{
      if(t.hour===null)return;
      if(!map[t.hour])map[t.hour]={hour:t.hour,pnl:0,count:0,wins:0};
      map[t.hour].pnl+=t.pnl; map[t.hour].count++;
      if(t.pnl>0)map[t.hour].wins++;
    });
    return Object.values(map).sort((a,b)=>a.hour-b.hour)
      .map(d=>({...d,label:`${d.hour}:00`,wr:d.wins/d.count,expectancy:d.pnl/d.count}));
  },[trades,dir]);

  const dowData=useMemo(()=>{
    const ORDER=["Mon","Tue","Wed","Thu","Fri"];
    const map={};
    trades.filter(t=>dir==="all"||t.type===dir).forEach(t=>{
      if(!t.dow)return;
      if(!map[t.dow])map[t.dow]={dow:t.dow,pnl:0,count:0,wins:0};
      map[t.dow].pnl+=t.pnl; map[t.dow].count++;
      if(t.pnl>0)map[t.dow].wins++;
    });
    return ORDER.filter(d=>map[d]).map(d=>({...map[d],wr:map[d].wins/map[d].count,expectancy:map[d].pnl/map[d].count}));
  },[trades,dir]);

  const reset=()=>{setSelHour(null);setSelDow(null);};

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{color:C.textDim,fontSize:12}}>Direction:</span>
          {["all","long","short"].map(d=>(
            <button key={d} onClick={()=>{setDir(d);reset();}} style={{
              padding:"6px 16px",borderRadius:7,
              border:`1px solid ${dir===d?C.accent:C.border}`,
              background:dir===d?C.accentDim:"transparent",
              color:dir===d?C.accent:C.textMuted,
              cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",
              fontWeight:dir===d?600:400,transition:"all .15s",textTransform:"capitalize",
            }}>{d==="all"?"All":d==="long"?"Long Only":"Short Only"}</button>
          ))}
          {(selHour!==null||selDow!==null)&&(
            <button onClick={reset} style={{
              marginLeft:"auto",padding:"5px 12px",borderRadius:6,
              border:`1px solid ${C.border}`,background:"transparent",
              color:C.textMuted,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",
            }}>✕ Clear Filters</button>
          )}
        </div>
      </Panel>

      {fStats&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          <Stat label="Net Profit" value={fmtD(fStats.netProfit)} color={fStats.netProfit>=0?C.green:C.red}/>
          <Stat label="Win Rate" value={fmtP(fStats.winRate)}/>
          <Stat label="Profit Factor" value={fmtN(fStats.profitFactor)} color={fStats.profitFactor>=1.5?C.green:C.yellow}/>
          <Stat label="Expectancy" value={fmtD(fStats.expectancy)} color={fStats.expectancy>=0?C.green:C.red}/>
          <Stat label="Trades" value={filtered.length} sub={`${fmtP(filtered.length/trades.length)} of total`}/>
          <Stat label="Max DD" value={fmtD(fStats.maxDD)} color={C.red}/>
        </div>
      )}

      <Panel title={`Expectancy by Hour${selHour!==null?` — ${selHour}:00`:""}`}>
        <div style={{color:C.textMuted,fontSize:11,marginBottom:10}}>Click a bar to filter by that hour</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyData} onClick={d=>d?.activePayload&&setSelHour(h=>h===d.activePayload[0].payload.hour?null:d.activePayload[0].payload.hour)}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} formatter={(v,n,p)=>[`${fmtD(v)} (${p.payload.count} trades)`,n]}/>
            <ReferenceLine y={0} stroke={C.borderLight}/>
            <Bar dataKey="expectancy" name="Exp/Trade" radius={[4,4,0,0]}>
              {hourlyData.map((e,i)=><Cell key={i} fill={e.hour===selHour?C.yellow:e.expectancy>=0?C.green:C.red} opacity={selHour!==null&&e.hour!==selHour?.35:1}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={`Expectancy by Day${selDow?` — ${selDow}`:""}`}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={dowData} onClick={d=>d?.activePayload&&setSelDow(dw=>dw===d.activePayload[0].payload.dow?null:d.activePayload[0].payload.dow)}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="dow" tick={{fill:C.textMuted,fontSize:12}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} formatter={(v,n,p)=>[`${fmtD(v)} (${p.payload.count} trades)`,n]}/>
            <ReferenceLine y={0} stroke={C.borderLight}/>
            <Bar dataKey="expectancy" name="Exp/Trade" radius={[4,4,0,0]}>
              {dowData.map((e,i)=><Cell key={i} fill={e.dow===selDow?C.yellow:e.expectancy>=0?C.green:C.red} opacity={selDow&&e.dow!==selDow?.35:1}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Best & Worst Segments">
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[...hourlyData].sort((a,b)=>b.expectancy-a.expectancy).slice(0,3).map(h=>(
            <div key={h.hour} style={{background:C.greenDim,border:`1px solid ${C.green}25`,borderRadius:8,padding:"10px 14px",flex:1,minWidth:130}}>
              <div style={{color:C.green,fontSize:10,textTransform:"uppercase",marginBottom:3,fontWeight:600}}>Best Hour</div>
              <div className="mono" style={{color:C.text,fontSize:16,fontWeight:700}}>{h.label}</div>
              <div style={{color:C.green,fontSize:12,marginTop:2}}>{fmtD(h.expectancy)}/trade · {h.count} trades</div>
            </div>
          ))}
          {[...hourlyData].sort((a,b)=>a.expectancy-b.expectancy).slice(0,2).map(h=>(
            <div key={h.hour} style={{background:C.redDim,border:`1px solid ${C.red}25`,borderRadius:8,padding:"10px 14px",flex:1,minWidth:130}}>
              <div style={{color:C.red,fontSize:10,textTransform:"uppercase",marginBottom:3,fontWeight:600}}>Worst Hour</div>
              <div className="mono" style={{color:C.text,fontSize:16,fontWeight:700}}>{h.label}</div>
              <div style={{color:C.red,fontSize:12,marginTop:2}}>{fmtD(h.expectancy)}/trade · {h.count} trades</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── PROP FIRM TAB ────────────────────────────────────────────────────────────
function PropFirmTab({trades}){
  const [cfg,setCfg]=useState({accountSize:50000,challengeCost:100,profitTarget:3000,maxDD:2000,maxDailyLoss:0,minDays:2,payoutSplit:.9,minPayout:500});
  const [res,setRes]=useState(null);
  const [running,setRunning]=useState(false);
  const [tab2,setTab2]=useState("Overview");

  const run=()=>{setRunning(true);setTimeout(()=>{setRes(simPropFirm(trades,cfg,600));setRunning(false);},150);};
  const set=(k,v)=>setCfg(c=>({...c,[k]:v}));
  const displayAccounts=res?.accountLog.slice(0,12)||[];

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel title="Prop Firm Configuration">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:10,marginBottom:14}}>
          <NumInput label="Account Size" value={cfg.accountSize} onChange={v=>set("accountSize",v)} step={10000}/>
          <NumInput label="Challenge Cost $" value={cfg.challengeCost} onChange={v=>set("challengeCost",v)} step={50}/>
          <NumInput label="Profit Target $" value={cfg.profitTarget} onChange={v=>set("profitTarget",v)} step={500}/>
          <NumInput label="Max Drawdown $" value={cfg.maxDD} onChange={v=>set("maxDD",v)} step={500}/>
          <NumInput label="Max Daily Loss $" value={cfg.maxDailyLoss} onChange={v=>set("maxDailyLoss",v)} step={100}/>
          <NumInput label="Min Trading Days" value={cfg.minDays} onChange={v=>set("minDays",v)} step={1}/>
          <NumInput label="Payout Split (0-1)" value={cfg.payoutSplit} onChange={v=>set("payoutSplit",v)} step={0.05}/>
          <NumInput label="Min Withdrawal $" value={cfg.minPayout} onChange={v=>set("minPayout",v)} step={100}/>
        </div>
        <Btn onClick={run} disabled={running}>{running?<><Spinner/> Simulating 600 runs...</>:"Run Prop Firm Analysis"}</Btn>
      </Panel>

      {res&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"stretch"}}>
            <div style={{
              background:res.readiness>=70?C.greenDim:res.readiness>=50?C.yellowDim:C.redDim,
              border:`1px solid ${res.readiness>=70?C.green+"30":res.readiness>=50?C.yellow+"40":C.red+"40"}`,
              borderRadius:12,padding:"18px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,minWidth:150,
            }}>
              <ScoreRing score={res.readiness}/>
              <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em",textAlign:"center"}}>Readiness</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,flex:1}}>
              <Stat label="Challenge Pass Rate" value={fmtP(res.passRate)} color={res.passRate>=.6?C.green:res.passRate>=.35?C.yellow:C.red} large/>
              <Stat label="Payout Reach Rate" value={fmtP(res.payoutReachRate)} color={res.payoutReachRate>=.7?C.green:C.yellow} large/>
              <Stat label="Funded Survival Rate" value={fmtP(res.survivalRate)} color={res.survivalRate>=.5?C.green:C.yellow}/>
              <Stat label="Avg Payout / Account" value={fmtD(res.avgPayout)} color={C.green}/>
            </div>
          </div>

          <Panel>
            <div style={{fontSize:13,color:C.textDim,lineHeight:1.7}}>
              {res.passRate>=.7&&res.payoutReachRate>=.7
                ?"✅ Strong candidate. High pass rate + strong payout reach — deploy with confidence."
                :res.passRate>=.5&&res.payoutReachRate>=.5
                ?"⚠️ Viable but marginal. Consider increasing account size or reducing per-trade risk."
                :res.passRate<.35
                ?"❌ Not ready. Pass rate too low — reduce risk per trade by 40–60% before attempting."
                :"⚠️ Passes challenges but struggles funded. Adjust max DD tolerance or reduce sizing."}
            </div>
          </Panel>

          <TabBar tabs={["Overview","Account Timeline","Payout Log"]} active={tab2} onChange={setTab2}/>

          {tab2==="Overview"&&(
            <div className="fade" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Panel title="Challenge Phase">
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[["Simulations Run",res.runs],["Passed Challenge",res.passed],["Failed / Burned",res.runs-res.passed],["Pass Rate",fmtP(res.passRate)],["Cost of Failures",fmtD((res.runs-res.passed)*cfg.challengeCost)]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}18`,paddingBottom:8}}>
                      <span style={{color:C.textMuted,fontSize:12}}>{l}</span>
                      <span className="mono" style={{fontSize:12}}>{v}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Funded Phase">
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[["Accounts Funded",res.passed],["Reached Payout",Math.round(res.payoutReachRate*res.passed)],["Survived Funded",Math.round(res.survivalRate*res.passed)],["Total Payouts (sim)",fmtD(res.totalPayouts)],["Avg Payout/Account",fmtD(res.avgPayout)],["ROI on Challenges",fmtP(res.totalPayouts/(res.runs*cfg.challengeCost))]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}18`,paddingBottom:8}}>
                      <span style={{color:C.textMuted,fontSize:12}}>{l}</span>
                      <span className="mono" style={{fontSize:12,color:l.includes("ROI")||l.includes("Payout")?C.green:C.text}}>{v}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {tab2==="Account Timeline"&&(
            <div className="fade" style={{display:"flex",flexDirection:"column",gap:6}}>
              {displayAccounts.map((acc,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                  <div className="mono" style={{color:C.textMuted,fontSize:12,width:24}}>#{i+1}</div>
                  <Badge color={acc.passed?"green":"red"}>{acc.passed?"FUNDED":"FAILED"}</Badge>
                  {acc.passed&&<Badge color={acc.burned?"red":"green"}>{acc.burned?"BURNED":"ACTIVE"}</Badge>}
                  {acc.passed&&(
                    <div style={{marginLeft:"auto",display:"flex",gap:16,alignItems:"center"}}>
                      <span style={{color:C.textMuted,fontSize:11}}>{acc.payouts.length} payout{acc.payouts.length!==1?"s":""}</span>
                      <span className="mono" style={{color:C.green,fontWeight:700}}>{fmtD(acc.totalPayout)}</span>
                    </div>
                  )}
                  {!acc.passed&&<span style={{marginLeft:"auto",color:C.red,fontSize:11}} className="mono">-{fmtD(cfg.challengeCost)}</span>}
                </div>
              ))}
              {res.accountLog.length>12&&<div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:8}}>... and {res.accountLog.length-12} more accounts</div>}
            </div>
          )}

          {tab2==="Payout Log"&&(
            <div className="fade">
              <Panel>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    {["Account","Payout #","Amount","Running Total"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",color:C.textMuted,textAlign:h==="Amount"||h==="Running Total"?"right":"left",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase",letterSpacing:".08em"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {res.accountLog.filter(a=>a.passed&&a.payouts.length).flatMap((acc,ai)=>acc.payouts.map((p,pi)=>({acc:ai+1,idx:pi+1,amount:p}))).reduce((rows,row)=>{const running=(rows[rows.length-1]?.running||0)+row.amount;return [...rows,{...row,running}];},[]).slice(0,40).map((row,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}18`}}>
                        <td style={{padding:"7px 10px",color:C.textDim}} className="mono">#{row.acc}</td>
                        <td style={{padding:"7px 10px",color:C.textMuted}}>Payout {row.idx}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:C.green,fontWeight:700}} className="mono">{fmtD(row.amount)}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:C.text}} className="mono">{fmtD(row.running)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OPTIMIZER TAB ────────────────────────────────────────────────────────────
function OptimizerTab({trades}){
  const [goal,setGoal]=useState("maxPayout");
  const [cfg,setCfg]=useState({accountSize:50000,challengeCost:100,profitTarget:3000,maxDD:2000,maxDailyLoss:0,minDays:2,payoutSplit:.9,minPayout:500});
  const [runs2,setRuns2]=useState(400);
  const [res,setRes]=useState(null);
  const [running,setRunning]=useState(false);
  const set=(k,v)=>setCfg(c=>({...c,[k]:v}));

  const runOpt=()=>{
    setRunning(true);
    setTimeout(()=>{
      const multipliers=[.2,.3,.4,.5,.6,.7,.8,.9,1.0,1.2,1.5];
      const results=multipliers.map(m=>{
        const scaled=trades.map(t=>({...t,pnl:t.pnl*m}));
        const r=simPropFirm(scaled,cfg,Math.floor(runs2/multipliers.length)+1);
        const score=goal==="maxPayout"?r.passRate*.5+r.payoutReachRate*.3+Math.min(r.avgPayout/5000,.2)
          :goal==="maxSurvival"?r.survivalRate*.5+r.passRate*.3+r.payoutReachRate*.2
          :r.passRate*.4+r.survivalRate*.3+r.payoutReachRate*.3;
        return {m,score,...r};
      });
      results.sort((a,b)=>b.score-a.score);
      setRes(results);
      setRunning(false);
    },200);
  };

  const bestM=res?.[0]?.m;

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel title="Optimization Goal">
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {[["maxPayout","Maximize Payouts"],["maxSurvival","Maximize Survival"],["balanced","Balanced"]].map(([v,l])=>(
            <button key={v} onClick={()=>setGoal(v)} style={{
              padding:"7px 18px",borderRadius:7,
              border:`1px solid ${goal===v?C.accent:C.border}`,
              background:goal===v?C.accentDim:"transparent",
              color:goal===v?C.accent:C.textMuted,
              cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:goal===v?600:400,
              transition:"all .15s",
            }}>{l}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:14}}>
          <NumInput label="Account Size" value={cfg.accountSize} onChange={v=>set("accountSize",v)} step={10000}/>
          <NumInput label="Challenge Cost" value={cfg.challengeCost} onChange={v=>set("challengeCost",v)} step={50}/>
          <NumInput label="Profit Target" value={cfg.profitTarget} onChange={v=>set("profitTarget",v)} step={500}/>
          <NumInput label="Max Drawdown" value={cfg.maxDD} onChange={v=>set("maxDD",v)} step={500}/>
          <NumInput label="Min Days" value={cfg.minDays} onChange={v=>set("minDays",v)} step={1}/>
          <NumInput label="Sim Runs" value={runs2} onChange={setRuns2} step={100}/>
        </div>
        <Btn onClick={runOpt} disabled={running}>{running?<><Spinner/> Optimizing...</>:"Run Optimizer"}</Btn>
      </Panel>

      {res&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Panel>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{background:C.accentDim,border:`1px solid ${C.accentBorder}`,borderRadius:10,padding:"14px 20px"}}>
                <div style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".1em"}}>Optimal Risk ×</div>
                <div className="mono" style={{color:C.accent,fontSize:30,fontWeight:700,marginTop:4}}>{bestM}×</div>
                <div style={{color:C.textDim,fontSize:11,marginTop:3}}>
                  {bestM<.5?"Reduce risk by "+(Math.round((1-bestM)*100))+"%":bestM>1?"Increase risk by "+(Math.round((bestM-1)*100))+"%":"Near current risk level"}
                </div>
              </div>
              <div style={{flex:1,color:C.textDim,fontSize:13,lineHeight:1.8}}>
                <div><span style={{color:C.green,fontWeight:600}}>Safe Zone:</span> {res.filter(r=>r.passRate>=.6).map(r=>r.m).join("×, ")||"None"}×</div>
                <div><span style={{color:C.yellow,fontWeight:600}}>Optimal Zone:</span> {bestM}× — best {goal==="maxPayout"?"payout prob":goal==="maxSurvival"?"survival":"balance"}</div>
                <div><span style={{color:C.red,fontWeight:600}}>Danger Zone:</span> above {res.find(r=>r.passRate<.3)?.m||"—"}× — pass rate &lt;30%</div>
              </div>
            </div>
          </Panel>

          <Panel title="Performance by Risk Multiplier">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={res}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:C.textMuted,fontSize:11}} tickFormatter={v=>v+"×"} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="l" tick={{fill:C.textMuted,fontSize:10}} tickFormatter={v=>fmtP(v)} width={50} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="r" orientation="right" tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={75} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:8,fontSize:12}} formatter={(v,n)=>[n.includes("Rate")||n.includes("Reach")||n.includes("Survival")?fmtP(v):fmtD(v),n]}/>
                <Bar yAxisId="r" dataKey="avgPayout" name="Avg Payout" fill={C.accentDim} stroke={C.accent} strokeWidth={1} radius={[3,3,0,0]}/>
                <Line yAxisId="l" type="monotone" dataKey="passRate" name="Pass Rate" stroke={C.green} strokeWidth={2} dot={{r:3,fill:C.green}}/>
                <Line yAxisId="l" type="monotone" dataKey="payoutReachRate" name="Payout Reach" stroke={C.yellow} strokeWidth={2} dot={{r:3,fill:C.yellow}}/>
                <Line yAxisId="l" type="monotone" dataKey="survivalRate" name="Survival Rate" stroke={C.blue} strokeWidth={2} dot={{r:3,fill:C.blue}}/>
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="All Results">
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>
                  {["Risk ×","Pass Rate","Payout Reach","Survival","Avg Payout","Score"].map(h=>(
                    <th key={h} style={{padding:"7px 10px",color:C.textMuted,textAlign:"right",borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {res.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}18`,background:r.m===bestM?C.accentDim:"transparent",transition:"background .1s"}}>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:r.m===bestM?700:400,color:r.m===bestM?C.accent:C.text}} className="mono">{r.m}×</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:r.passRate>=.6?C.green:r.passRate>=.35?C.yellow:C.red}} className="mono">{fmtP(r.passRate)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:r.payoutReachRate>=.7?C.green:C.yellow}} className="mono">{fmtP(r.payoutReachRate)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:r.survivalRate>=.5?C.green:C.yellow}} className="mono">{fmtP(r.survivalRate)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.green}} className="mono">{fmtD(r.avgPayout)}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",color:C.textDim}} className="mono">{r.score.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// ─── QUANTLAB TAB ─────────────────────────────────────────────────────────────
function QuantLabTab(){
  const [p,setP]=useState({wr:60,rr:1.5,risk:300,tpd:2,total:300,accountSize:50000,profitTarget:3000,maxDD:2000,payoutSplit:.9,minPayout:500,challengeCost:100});
  const [res,setRes]=useState(null);
  const [heatmap,setHeatmap]=useState(null);
  const [running,setRunning]=useState(false);
  const [hmRunning,setHmRunning]=useState(false);
  const set=(k,v)=>setP(x=>({...x,[k]:v}));

  const genTrades=(params)=>Array.from({length:params.total},(_,i)=>({
    id:i,pnl:Math.random()<params.wr/100?params.risk*params.rr:-params.risk,type:"long",
  }));

  const run=()=>{
    setRunning(true);
    setTimeout(()=>{
      const t=genTrades(p);
      const stats=calcStats(t);
      const mc=runMonteCarlo(t,600);
      const surv=calcSurvival(t,p.maxDD,300);
      const prop=simPropFirm(t,{accountSize:p.accountSize,profitTarget:p.profitTarget,maxDD:p.maxDD,maxDailyLoss:0,minDays:2,challengeCost:p.challengeCost,payoutSplit:p.payoutSplit,minPayout:p.minPayout},300);
      setRes({stats,mc,surv,prop});
      setRunning(false);
    },100);
  };

  const genHeatmap=()=>{
    setHmRunning(true);
    setTimeout(()=>{
      const WRS=[40,50,60,70,80],RRS=[1.0,1.5,2.0,2.5,3.0];
      const cells=[];
      for(const wr of WRS){
        for(const rr of RRS){
          const t=Array.from({length:200},()=>({id:0,pnl:Math.random()<wr/100?p.risk*rr:-p.risk,type:"long"}));
          const surv=calcSurvival(t,p.maxDD,80);
          const prop=simPropFirm(t,{accountSize:p.accountSize,profitTarget:p.profitTarget,maxDD:p.maxDD,maxDailyLoss:0,minDays:2,challengeCost:p.challengeCost,payoutSplit:p.payoutSplit,minPayout:p.minPayout},80);
          cells.push({wr,rr,surv,passRate:prop.passRate,avgPayout:prop.avgPayout});
        }
      }
      setHeatmap(cells);
      setHmRunning(false);
    },200);
  };

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Panel title="Synthetic Strategy Parameters">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:10,marginBottom:14}}>
          <NumInput label="Win Rate %" value={p.wr} onChange={v=>set("wr",v)} step={5}/>
          <NumInput label="Risk:Reward" value={p.rr} onChange={v=>set("rr",v)} step={0.5}/>
          <NumInput label="Risk/Trade $" value={p.risk} onChange={v=>set("risk",v)} step={50}/>
          <NumInput label="Trades/Day" value={p.tpd} onChange={v=>set("tpd",v)} step={1}/>
          <NumInput label="Total Trades" value={p.total} onChange={v=>set("total",v)} step={50}/>
          <NumInput label="Account Size" value={p.accountSize} onChange={v=>set("accountSize",v)} step={10000}/>
          <NumInput label="Profit Target" value={p.profitTarget} onChange={v=>set("profitTarget",v)} step={500}/>
          <NumInput label="Max Drawdown" value={p.maxDD} onChange={v=>set("maxDD",v)} step={500}/>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn onClick={run} disabled={running}>{running?<><Spinner/> Running...</>:"Run Simulation"}</Btn>
          <Btn onClick={genHeatmap} disabled={hmRunning} variant="blue">{hmRunning?<><Spinner/> Generating...</>:"Generate Blowup Heatmap"}</Btn>
        </div>
      </Panel>

      {res&&(
        <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:8}}>
            <Stat large label="Challenge Pass Rate" value={fmtP(res.prop.passRate)} color={res.prop.passRate>=.6?C.green:res.prop.passRate>=.35?C.yellow:C.red}/>
            <Stat large label="Funded Survival" value={fmtP(res.surv)} color={res.surv>=.5?C.green:C.red}/>
            <Stat label="Blowup Probability" value={fmtP(1-res.surv)} color={C.red}/>
            <Stat label="Avg Payout" value={fmtD(res.prop.avgPayout)} color={C.green}/>
            <Stat label="Net Profit (sim)" value={fmtD(res.stats.netProfit)} color={res.stats.netProfit>=0?C.green:C.red}/>
            <Stat label="Actual Win Rate" value={fmtP(res.stats.winRate)}/>
            <Stat label="Profit Factor" value={fmtN(res.stats.profitFactor)}/>
            <Stat label="Max Drawdown" value={fmtD(res.stats.maxDD)} color={C.red}/>
          </div>
          <Panel title="Monte Carlo Equity Paths">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                <XAxis hide/><YAxis tick={{fill:C.textMuted,fontSize:10}} tickFormatter={fmtD} width={72} axisLine={false} tickLine={false}/>
                <ReferenceLine y={0} stroke={C.borderLight}/>
                {res.mc.samplePaths.map((path,i)=>(
                  <Line key={i} data={path.map((eq,x)=>({x,eq}))} dataKey="eq" dot={false}
                    stroke={i%6===0?C.accent:C.accentBorder} strokeWidth={i%6===0?1.6:.4}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:10}}>
              {[["P10",res.mc.p10,C.red],["P25",res.mc.p25,C.yellow],["Median",res.mc.p50,C.green],["P75",res.mc.p75,C.green],["P90",res.mc.p90,C.green]].map(([l,v,c])=>(
                <Stat key={l} label={l} value={fmtD(v)} color={c}/>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {heatmap&&(
        <Panel title="Blowup Heatmap — Challenge Pass Rate by Win Rate × R:R">
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
              <thead><tr>
                <th style={{padding:"7px 12px",color:C.textMuted,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>WR \ R:R</th>
                {[1.0,1.5,2.0,2.5,3.0].map(rr=>(
                  <th key={rr} style={{padding:"7px 12px",color:C.textMuted,textAlign:"center",borderBottom:`1px solid ${C.border}`}}>{rr}×</th>
                ))}
              </tr></thead>
              <tbody>
                {[40,50,60,70,80].map(wr=>(
                  <tr key={wr}>
                    <td style={{padding:"9px 12px",color:C.textDim,fontWeight:700}} className="mono">{wr}%</td>
                    {[1.0,1.5,2.0,2.5,3.0].map(rr=>{
                      const cell=heatmap.find(c=>c.wr===wr&&c.rr===rr);
                      const s=cell?.passRate||0;
                      const bg=s>=.7?C.greenDim:s>=.4?C.yellowDim:C.redDim;
                      const color=s>=.7?C.green:s>=.4?C.yellow:C.red;
                      return(
                        <td key={rr} style={{padding:"9px 12px",textAlign:"center",background:bg,border:`1px solid ${C.border}15`}}>
                          <div className="mono" style={{color,fontWeight:700,fontSize:13}}>{fmtP(s)}</div>
                          <div style={{color:C.textMuted,fontSize:10,marginTop:2}}>{fmtD(cell?.avgPayout||0)} avg</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10,display:"flex",gap:16,fontSize:11,color:C.textMuted}}>
            <span><span style={{color:C.green}}>■</span> ≥70% pass rate</span>
            <span><span style={{color:C.yellow}}>■</span> 40–70%</span>
            <span><span style={{color:C.red}}>■</span> &lt;40%</span>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── UPLOAD SCREEN ────────────────────────────────────────────────────────────
function UploadScreen({onUpload}){
  const [dragging,setDragging]=useState(false);
  const [accountSize,setAccountSize]=useState(100000);
  const ref=useRef();

  const handle=file=>{
    if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      const {trades,warnings}=parseTradingViewCSV(e.target.result);
      onUpload({trades,warnings,accountSize,filename:file.name});
    };
    reader.readAsText(file);
  };

  const loadDemo=()=>{
    const t=Array.from({length:196},(_,i)=>({
      id:i+1,type:i%4===0?"short":"long",
      pnl:Math.random()<.58?Math.random()*800+200:-(Math.random()*500+150),
      price:21000+Math.random()*500,
      date:`2025-${String(Math.floor(i/15)+5).padStart(2,"0")}-${String((i%28)+1).padStart(2,"0")} 11:00`,
      dt:new Date(2025,Math.floor(i/15)+4,(i%28)+1,10+Math.floor(Math.random()*6)),
      hour:10+Math.floor(Math.random()*6),
      dow:["Mon","Tue","Wed","Thu","Fri"][Math.floor(Math.random()*5)],
      month:`2025-${String(Math.floor(i/15)+5).padStart(2,"0")}`,
      mfe:Math.random()*800,mae:Math.random()*400,signal:"Demo",
    }));
    onUpload({trades:t,warnings:[],accountSize,filename:"demo_strategy.csv"});
  };

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"78vh",gap:32}}>
      {/* Logo */}
      <div style={{textAlign:"center"}}>
        <div style={{
          display:"inline-flex",alignItems:"center",gap:10,
          background:C.panel,border:`1px solid ${C.border}`,
          borderRadius:16,padding:"14px 28px",marginBottom:20,
        }}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background:C.accentDim,border:`1px solid ${C.accentBorder}`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <span style={{fontSize:18}}>📊</span>
          </div>
          <div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:"-.02em"}}>
              Trade<span style={{color:C.accent}}>Proof</span>
            </div>
            <div style={{color:C.textMuted,fontSize:10,letterSpacing:".15em",textTransform:"uppercase",marginTop:1}}>Strategy Validator</div>
          </div>
        </div>
        <p style={{color:C.textDim,fontSize:14,lineHeight:1.7,maxWidth:420}}>
          Upload your TradingView CSV export and validate your strategy with Monte Carlo analysis, prop firm simulation, and in-depth performance metrics.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handle(e.dataTransfer.files[0]);}}
        onClick={()=>ref.current?.click()}
        style={{
          width:440,border:`1.5px dashed ${dragging?C.accent:C.border}`,
          borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",cursor:"pointer",gap:14,padding:"40px 24px",
          background:dragging?C.accentDim:C.panel,
          transition:"all .2s",
        }}
      >
        <div style={{
          width:52,height:52,borderRadius:14,
          background:dragging?C.accentDim:C.panel2,
          border:`1px solid ${dragging?C.accentBorder:C.borderLight}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:22,transition:"all .2s",
        }}>📂</div>
        <div style={{textAlign:"center"}}>
          <div style={{color:dragging?C.accent:C.text,fontSize:14,fontWeight:600,marginBottom:4}}>
            {dragging?"Drop your CSV here":"Drop CSV or click to browse"}
          </div>
          <div style={{color:C.textMuted,fontSize:12}}>TradingView → Strategy Tester → Export trades list</div>
        </div>
        <input ref={ref} type="file" accept=".csv" style={{display:"none"}} onChange={e=>handle(e.target.files[0])}/>
      </div>

      {/* Account size */}
      <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center"}}>
        <label style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".15em"}}>Account Size</label>
        <input type="number" value={accountSize} onChange={e=>setAccountSize(+e.target.value)} step={10000}
          style={{
            background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,
            padding:"12px 24px",color:C.text,fontSize:18,
            fontFamily:"'JetBrains Mono',monospace",width:220,textAlign:"center",
            transition:"border-color .15s",
          }}/>
      </div>

      {/* Feature pills */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",maxWidth:480}}>
        {["Monte Carlo","Prop Firm Sim","IS/OOS Split","Hour Analysis","Risk Metrics","QuantLab"].map(f=>(
          <span key={f} style={{
            background:C.panel,border:`1px solid ${C.border}`,
            borderRadius:20,padding:"5px 13px",fontSize:11,color:C.textDim,
          }}>{f}</span>
        ))}
      </div>

      <button onClick={loadDemo} style={{
        padding:"10px 24px",borderRadius:8,
        border:`1px solid ${C.border}`,background:"transparent",
        color:C.textMuted,cursor:"pointer",fontSize:12,
        fontFamily:"'Inter',sans-serif",fontWeight:500,
        transition:"all .15s",letterSpacing:".02em",
      }}>Load Demo Data (196 trades)</button>
    </div>
  );
}

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
function AIChatSection({dataset,stats}){
  const STORAGE_KEY="tradeproof_chat_sessions";
  const ACTIVE_KEY="tradeproof_chat_active";

  const loadSessions=()=>{
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){const parsed=JSON.parse(raw);if(parsed.length>0)return parsed;}
    }catch(_){}
    return [{id:1,title:"New Chat",messages:[]}];
  };

  const loadActiveId=()=>{
    try{
      const raw=localStorage.getItem(ACTIVE_KEY);
      if(raw){const id=JSON.parse(raw);return id;}
    }catch(_){}
    return 1;
  };

  const [sessions,setSessions]=useState(loadSessions);
  const [activeId,setActiveId]=useState(loadActiveId);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [thinking,setThinking]=useState(true);
  const [histOpen,setHistOpen]=useState(false);
  const bottomRef=useRef();
  const nextId=useRef(Math.max(...loadSessions().map(s=>s.id),1)+1);

  // Persist sessions whenever they change
  useEffect(()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(sessions));}catch(_){}
  },[sessions]);

  // Persist active session id
  useEffect(()=>{
    try{localStorage.setItem(ACTIVE_KEY,JSON.stringify(activeId));}catch(_){}
  },[activeId]);

  const activeSession=sessions.find(s=>s.id===activeId)||sessions[0];
  const messages=activeSession?.messages||[];

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,loading]);

  const updateMessages=(id,msgs)=>setSessions(prev=>prev.map(s=>s.id===id?{...s,messages:msgs}:s));

  const newChat=()=>{
    const id=nextId.current++;
    setSessions(prev=>[{id,title:"New Chat",messages:[]},...prev]);
    setActiveId(id);
    setHistOpen(false);
  };

  const deleteSession=(id,e)=>{
    e.stopPropagation();
    setSessions(prev=>{
      const next=prev.filter(s=>s.id!==id);
      if(next.length===0){
        const fresh={id:nextId.current++,title:"New Chat",messages:[]};
        setActiveId(fresh.id);
        return [fresh];
      }
      if(id===activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const clearAllHistory=()=>{
    if(!window.confirm("Clear all chat history?")) return;
    const fresh={id:nextId.current++,title:"New Chat",messages:[]};
    setSessions([fresh]);
    setActiveId(fresh.id);
    setHistOpen(false);
  };

  const buildSystem=()=>{
    let base=`You are TradeProof AI — an expert trading assistant specializing in NQ (Nasdaq) and ES (S&P 500) futures, ICT/Smart Money concepts (SMT, FVG, IFVG, MSS, liquidity sweeps), Pine Script v6, prop firm challenges (FTMO, TopStep, etc.), and systematic strategy development.
Be concise, precise, and use trading terminology naturally. When discussing Pine Script, provide working code. When discussing trade setups, always mention bias, entry, SL, and TP. Format responses with clear headers and bullet points where helpful.`;
    if(stats&&dataset){
      const s=stats;
      const stratType=s.winRate>=.65?"High Win Rate":s.profitFactor>=2.5?"High Profit Factor":s.avgWin/(s.avgLoss||1)>=2?"High R:R":"Balanced";
      base+=`\n\n## LOADED STRATEGY DATA (from user TradingView CSV)\nFile: ${dataset.filename}\nTotal Trades: ${s.total} (${s.wins}W / ${s.losses}L)\nNet Profit: $${s.netProfit.toFixed(0)}\nWin Rate: ${(s.winRate*100).toFixed(1)}%\nProfit Factor: ${s.profitFactor.toFixed(2)}\nExpectancy: $${s.expectancy.toFixed(0)}/trade\nAvg Win: $${s.avgWin.toFixed(0)} | Avg Loss: $${s.avgLoss.toFixed(0)} | W:L: ${(s.avgWin/(s.avgLoss||1)).toFixed(2)}\nMax DD: $${s.maxDD.toFixed(0)} (${(s.maxDDPct*100).toFixed(1)}%)\nSharpe: ${s.sharpe.toFixed(2)} | Sortino: ${s.sortino.toFixed(2)} | Calmar: ${s.calmar.toFixed(2)}\nMax Consec Wins: ${s.maxConsecWins} | Max Consec Losses: ${s.maxConsecLoss}\nProfitable Months: ${s.profitableMonths}/${s.monthlyArr.length}\nStrategy Type: ${stratType} | ROI: ${(s.roi*100).toFixed(1)}%\nWhen asked about "my strategy/trades/performance" answer based on this data with specific insights.`;
    }
    return base;
  };

  const { checkAndUse, recordUse, session:authSession, usage:authUsage, setPaywallFor } = useAuth();

  const send=async()=>{
    const text=input.trim(); if(!text||loading) return;
    if(!authSession){ setPaywallFor("login"); return; }
    const plan = PLANS[authUsage?.plan||"free"];
    if((authUsage?.ai_messages||0) >= plan.aiMessages){ setPaywallFor("chat"); return; }
    await recordUse("chat");
    const userMsg={role:"user",content:text};
    // Capture current messages, filter out any error messages before sending to API
    const currentMsgs=sessions.find(s=>s.id===activeId)?.messages||[];
    const cleanMsgs=currentMsgs.filter(m=>!m.error);
    const newMsgs=[...cleanMsgs,userMsg];
    const title=cleanMsgs.length===0?(text.length>35?text.slice(0,35)+"…":text):null;
    // Add user message to display (keep errors in display but not in API history)
    const displayMsgs=[...currentMsgs,userMsg];
    setSessions(prev=>prev.map(s=>s.id===activeId
      ?{...s,messages:displayMsgs,...(title?{title}:{})}
      :s));
    setInput(""); setLoading(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:1000,
          system:buildSystem(),
          messages:newMsgs.map(m=>({role:m.role,content:String(m.content)})),
        }),
      });
      const data=await res.json();
      if(data.error){
        // Save error as display-only (won't be sent to API next turn)
        setSessions(prev=>prev.map(s=>s.id===activeId
          ?{...s,messages:[...displayMsgs,{role:"assistant",content:"⚠️ API Error: "+data.error.message,error:true}]}
          :s));
      } else {
        const reply=data.content?.find(b=>b.type==="text")?.text||"No response.";
        setSessions(prev=>prev.map(s=>s.id===activeId
          ?{...s,messages:[...displayMsgs,{role:"assistant",content:reply}]}
          :s));
      }
    }catch(e){
      setSessions(prev=>prev.map(s=>s.id===activeId
        ?{...s,messages:[...displayMsgs,{role:"assistant",content:"⚠️ Network error: "+e.message,error:true}]}
        :s));
    }
    setLoading(false);
  };

  const formatMsg=(text)=>text.split("\n").map((line,i)=>{
    if(line.startsWith("### ")) return <div key={i} style={{color:C.text,fontWeight:700,fontSize:14,marginTop:10,marginBottom:4}}>{line.slice(4)}</div>;
    if(line.startsWith("## ")) return <div key={i} style={{color:C.accent,fontWeight:700,fontSize:15,marginTop:12,marginBottom:4}}>{line.slice(3)}</div>;
    if(line.startsWith("# ")) return <div key={i} style={{color:C.accent,fontWeight:700,fontSize:16,marginTop:12,marginBottom:6}}>{line.slice(2)}</div>;
    if(line.startsWith("- ")||line.startsWith("• ")) return <div key={i} style={{color:C.textDim,paddingLeft:16,marginBottom:3,display:"flex",gap:6,lineHeight:1.6}}><span style={{color:C.accent,flexShrink:0}}>›</span><span>{line.slice(2)}</span></div>;
    if(line.match(/^\d+\.\s/)) return <div key={i} style={{color:C.textDim,paddingLeft:16,marginBottom:3,lineHeight:1.6}}>{line}</div>;
    if(line.startsWith("```")||line==="```") return <div key={i} style={{height:4}}/>;
    if(line==="") return <div key={i} style={{height:6}}/>;
    if(line.startsWith("`")&&line.endsWith("`")&&line.length>2) return <code key={i} style={{background:C.panel2,color:C.green,padding:"2px 6px",borderRadius:4,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{line.slice(1,-1)}</code>;
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    return <div key={i} style={{color:C.textDim,marginBottom:2,lineHeight:1.6}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:C.text}}>{p.slice(2,-2)}</strong>:p)}</div>;
  }).filter(Boolean);

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Sessions sidebar */}
      {histOpen&&(
        <div style={{width:220,flexShrink:0,borderRight:`1px solid ${C.border}`,background:C.panel2,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{color:C.textDim,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:".1em"}}>Chat History</span>
            <div style={{display:"flex",gap:5}}>
              <button onClick={newChat} style={{background:C.accentDim,color:C.accent,border:`1px solid ${C.accentBorder}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:600}}>+ New</button>
              <button onClick={clearAllHistory} title="Clear all history" style={{background:"transparent",color:"#f05252",border:"1px solid #f0525240",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>🗑</button>
            </div>
          </div>
          <div style={{padding:"6px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{color:C.textMuted,fontSize:10}}>{sessions.length} conversation{sessions.length!==1?"s":""} saved</span>
            <span style={{color:C.textMuted,fontSize:10}}>{sessions.reduce((a,s)=>a+Math.ceil(s.messages.length/2),0)} total msgs</span>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {sessions.map(s=>(
              <div key={s.id} onClick={()=>{setActiveId(s.id);setHistOpen(false);}} style={{
                display:"flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:7,cursor:"pointer",marginBottom:2,
                background:s.id===activeId?C.accentDim:"transparent",
                border:`1px solid ${s.id===activeId?C.accentBorder:"transparent"}`,
                transition:"all .15s",
              }}>
                <span style={{fontSize:12}}>💬</span>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{color:s.id===activeId?C.accent:C.textDim,fontSize:12,fontWeight:s.id===activeId?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div>
                  <div style={{color:C.textMuted,fontSize:10,marginTop:1}}>{Math.ceil(s.messages.length/2)} msg{s.messages.length!==2?"s":""}</div>
                </div>
                <button onClick={e=>deleteSession(s.id,e)} style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13,padding:"0 2px",opacity:.5,flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Top bar */}
        <div style={{borderBottom:`1px solid ${C.border}`,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.panel,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setHistOpen(o=>!o)} style={{
              display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:7,
              border:`1px solid ${histOpen?C.accentBorder:C.border}`,
              background:histOpen?C.accentDim:"transparent",
              color:histOpen?C.accent:C.textMuted,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",
            }}>🕐 History <span style={{background:C.accentDim,color:C.accent,borderRadius:4,padding:"0 5px",fontSize:10,fontWeight:700,border:`1px solid ${C.accentBorder}`}}>{sessions.length}</span></button>
            <button onClick={newChat} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif"}}>+ New Chat</button>
            {messages.length>0&&<div style={{color:C.textMuted,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{activeSession.title}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {stats&&<div style={{background:C.greenDim,color:C.green,border:`1px solid ${C.greenBorder}`,borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:600}}>📊 Data Loaded</div>}
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:C.textMuted,fontSize:11}}>Thinking</span>
              <div onClick={()=>setThinking(t=>!t)} style={{width:34,height:18,borderRadius:9,cursor:"pointer",background:thinking?C.accent:C.border,display:"flex",alignItems:"center",padding:2,transition:"background .2s"}}>
                <div style={{width:14,height:14,borderRadius:7,background:"white",transform:thinking?"translateX(16px)":"translateX(0)",transition:"transform .2s"}}/>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 0"}}>
          {messages.length===0?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:20,padding:"0 20px"}}>
              <div style={{width:56,height:56,borderRadius:14,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🤖</div>
              <div style={{textAlign:"center"}}>
                <div style={{color:C.text,fontSize:17,fontWeight:600,marginBottom:6}}>TradeProof AI</div>
                <div style={{color:C.textMuted,fontSize:13,maxWidth:380,lineHeight:1.7}}>{stats?`Strategy loaded (${dataset.filename}). I can analyze your ${stats.total} trades, find patterns, suggest improvements, or generate Pine Script.`:"Ask me anything about NQ/ES, ICT, Pine Script, or prop firm strategies."}</div>
              </div>
              {stats&&(
                <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"center",maxWidth:440}}>
                  {[
                    {label:"Win Rate",val:(stats.winRate*100).toFixed(1)+"%",c:stats.winRate>=.55?C.green:stats.winRate>=.45?C.yellow:C.red},
                    {label:"Profit Factor",val:stats.profitFactor.toFixed(2),c:stats.profitFactor>=1.5?C.green:stats.profitFactor>=1?C.yellow:C.red},
                    {label:"Expectancy",val:"$"+stats.expectancy.toFixed(0),c:stats.expectancy>=0?C.green:C.red},
                    {label:"Max DD",val:"$"+stats.maxDD.toFixed(0),c:C.red},
                    {label:"Sharpe",val:stats.sharpe.toFixed(2),c:stats.sharpe>=1?C.green:C.yellow},
                  ].map(({label,val,c})=>(
                    <div key={label} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 11px",textAlign:"center"}}>
                      <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}}>{label}</div>
                      <div className="mono" style={{color:c,fontSize:13,fontWeight:700}}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"center",maxWidth:520}}>
                {(stats?[
                  "Analyze my strategy's strengths and weaknesses",
                  "Is my strategy ready for a prop firm challenge?",
                  "What's my biggest risk based on the data?",
                  "Generate a Pine Script strategy from my stats",
                ]:[
                  "Explain SMT divergence on NQ",
                  "How to code an IFVG in Pine Script v6",
                  "Best risk management for FTMO challenge",
                  "ICT killzone hours for NQ futures",
                ]).map(s=>(
                  <button key={s} onClick={()=>setInput(s)} style={{
                    padding:"7px 13px",borderRadius:8,border:`1px solid ${C.border}`,background:C.panel,
                    color:C.textDim,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",
                    transition:"all .15s",textAlign:"left",lineHeight:1.4,
                  }}>{s}</button>
                ))}
              </div>
            </div>
          ):(
            <div style={{maxWidth:740,margin:"0 auto",padding:"0 18px",display:"flex",flexDirection:"column",gap:14}}>
              {messages.map((m,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
                  <div style={{
                    width:30,height:30,borderRadius:8,flexShrink:0,
                    background:m.role==="user"?C.accentDim:C.panel2,
                    border:`1px solid ${m.role==="user"?C.accentBorder:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,
                  }}>{m.role==="user"?"👤":"🤖"}</div>
                  <div style={{
                    maxWidth:"82%",
                    background:m.role==="user"?C.accentDim:C.panel,
                    border:`1px solid ${m.role==="user"?C.accentBorder:C.border}`,
                    borderRadius:10,padding:"11px 15px",fontSize:13,lineHeight:1.6,
                  }}>
                    {m.role==="assistant"?formatMsg(m.content):<span style={{color:C.text}}>{m.content}</span>}
                  </div>
                </div>
              ))}
              {loading&&(
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:30,height:30,borderRadius:8,background:C.panel2,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
                  <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",display:"flex",gap:5,alignItems:"center"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:3,background:C.accent,animation:`pulse 1.2s ${i*.2}s ease-in-out infinite`}}/>)}
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 18px",background:C.panel,flexShrink:0}}>
          <div style={{maxWidth:740,margin:"0 auto",display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder={stats?"Ask about your strategy, Pine Script, risk, prop firm readiness...":"Ask about NQ/ES trading, ICT, Pine Script..."}
              style={{
                flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,
                padding:"11px 15px",color:C.text,fontSize:13,
                fontFamily:"'Inter',sans-serif",outline:"none",transition:"border-color .15s",
              }}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{
              width:42,height:42,borderRadius:10,
              border:`1px solid ${loading||!input.trim()?C.border:C.accentBorder}`,
              background:loading||!input.trim()?C.panel:C.accentDim,
              color:loading||!input.trim()?C.textMuted:C.accent,
              cursor:loading||!input.trim()?"not-allowed":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
              transition:"all .15s",flexShrink:0,
            }}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── CHART OVERLAY ────────────────────────────────────────────────────────────
function ChartOverlay({image, levels}){
  if(!levels) return null;
  const {bias,levels:lvls=[]}=levels;
  const isLong=bias==="LONG";
  const biasColor=isLong?"#22d3a4":"#f05252";
  const biasLabel=isLong?"▲ LONG":"▼ SHORT";

  // Group levels by type for the card layout
  const resistance=lvls.filter(l=>l.type==="resistance"||l.type==="resistance_zone");
  const entry=lvls.find(l=>l.type==="entry");
  const sl=lvls.find(l=>l.type==="sl");
  const tps=lvls.filter(l=>l.type==="support");
  const labels=lvls.filter(l=>l.type==="label");

  const Row=({label,value,color,mono})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"7px 14px",borderBottom:"1px solid #ffffff08"}}>
      <span style={{color:"#6b7a99",fontSize:11,fontWeight:500}}>{label}</span>
      <span style={{color:color||"#e2e8f0",fontSize:12,
        fontFamily:mono?"'JetBrains Mono',monospace":"inherit",fontWeight:600}}>
        {value}
      </span>
    </div>
  );

  const ZoneRow=({label,lv,color})=>{
    const val=lv.priceHigh!=null
      ?lv.priceHigh.toLocaleString()+" – "+lv.priceLow.toLocaleString()
      :lv.price!=null?lv.price.toLocaleString():"—";
    return <Row label={label} value={val} color={color} mono/>;
  };

  return(
    <div style={{borderRadius:12,overflow:"hidden",border:"1px solid #1e2535",
      background:"#0d1117",marginTop:4}}>
      {/* Header with chart image */}
      {image&&(
        <div style={{position:"relative"}}>
          <img src={image} alt="chart" style={{width:"100%",display:"block",maxHeight:240,objectFit:"cover"}}/>
          {/* Bias badge over image */}
          <div style={{position:"absolute",top:10,left:10,
            background:isLong?"#22d3a415":"#f0525215",
            border:"1.5px solid "+biasColor,
            borderRadius:6,padding:"4px 12px",
            color:biasColor,fontSize:13,fontWeight:700,
            fontFamily:"'JetBrains Mono',monospace",
            backdropFilter:"blur(4px)"}}>
            {biasLabel}
          </div>
          {/* SL tag over image */}
          {sl&&(
            <div style={{position:"absolute",top:10,right:10,
              background:"#f0525218",border:"1px solid #f05252",
              borderRadius:5,padding:"3px 9px",
              color:"#f05252",fontSize:11,fontWeight:700,
              fontFamily:"'JetBrains Mono',monospace",
              backdropFilter:"blur(4px)"}}>
              SL {sl.price?.toLocaleString()}
            </div>
          )}
          {/* TP badges bottom */}
          <div style={{position:"absolute",bottom:8,left:8,display:"flex",gap:6}}>
            {tps.map((tp,i)=>(
              <div key={i} style={{background:"#22d3a418",border:"1px solid #22d3a4",
                borderRadius:5,padding:"3px 9px",color:"#22d3a4",fontSize:11,fontWeight:700,
                fontFamily:"'JetBrains Mono',monospace",backdropFilter:"blur(4px)"}}>
                TP{i+1} {tp.price?.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Levels card */}
      <div style={{padding:"2px 0"}}>
        <div style={{padding:"10px 14px 6px",display:"flex",alignItems:"center",gap:8,
          borderBottom:"1px solid #1e2535"}}>
          <div style={{width:8,height:8,borderRadius:2,background:biasColor}}/>
          <span style={{color:"#8892a4",fontSize:10,fontWeight:600,
            textTransform:"uppercase",letterSpacing:".1em"}}>Trade Levels</span>
        </div>
        {resistance.map((r,i)=>(
          <ZoneRow key={i}
            label={r.type==="resistance_zone"?"Resistance Zone":"Resistance"}
            lv={r} color="#f05252"/>
        ))}
        {entry&&<ZoneRow label="Entry Zone" lv={entry} color="#f0a92e"/>}
        {sl&&<Row label="Stop Loss" value={sl.price?.toLocaleString()} color="#f05252" mono/>}
        {tps.map((tp,i)=>(
          <Row key={i} label={"TP "+(i+1)} value={tp.price?.toLocaleString()} color="#22d3a4" mono/>
        ))}
        {labels.map((lb,i)=>(
          <Row key={i} label="Note" value={lb.label} color="#7c6cfa"/>
        ))}
      </div>
    </div>
  );
}

// ─── CHART ANALYZER ───────────────────────────────────────────────────────────
const STYLE_PROMPTS={
  "Price Action":"Focus on candlestick patterns, support/resistance levels, trend structure (HH/HL/LH/LL), chart patterns (triangles, flags, wedges), and price-based entries. Identify key S/R zones, trend direction, and pattern-based trade setups.",
  "Smart Money (SMC)":"Analyze using Smart Money Concepts: identify order blocks (OB), fair value gaps (FVG), breaker blocks, change of character (ChoCH), break of structure (BOS), liquidity pools (buy-side/sell-side), and institutional order flow. Focus on premium/discount arrays.",
  "ICT":"Use Inner Circle Trader methodology: identify ICT order blocks, fair value gaps, optimal trade entry (OTE), market structure shifts (MSS), killzone sessions (London/NY/Asia), SMT divergence, IPDA ranges, and draw on liquidity. Reference PD arrays.",
  "Supply & Demand":"Identify supply and demand zones using institutional footprint: fresh zones, tested zones, zone strength (rally-base-drop, drop-base-rally patterns). Focus on imbalances, zone confluence, and price reaction at key levels.",
  "Classic TA":"Traditional technical analysis: moving averages, RSI, MACD divergence, Fibonacci retracements, volume analysis, trend lines, chart patterns, and classical indicators. Provide indicator-based signals and confluences.",
};

const TRADE_SUMMARY_SECTION=
"\n\n## TRADE SUMMARY\n\n"+
"| Field | Value |\n"+
"|---|---|\n"+
"| **Bias** | LONG or SHORT |\n"+
"| **Structure** | e.g. Lower Highs - Bearish / Higher Lows - Bullish |\n"+
"| **Key Reversal Level** | [price] - [description] |\n"+
"| **Resistance / Supply Zone** | [price range] |\n"+
"| **Entry Zone** | [price range] - [trigger condition] |\n"+
"| **Stop Loss** | [price] (~[X] pts risk) |\n"+
"| **TP 1** | [price] (R:R [x.x]) |\n"+
"| **TP 2** | [price] (R:R [x.x]) |\n"+
"| **Invalidation** | [price] - [condition] |\n\n"+
"**Wait for**: [specific confirmation before entry]\n\n"+
"After the Trade Summary, output chart levels in this EXACT format:\n"+
"<<<LEVELS_JSON>>>\n"+
'{"bias":"SHORT","priceMin":29400,"priceMax":29800,"levels":['+
'{"type":"resistance","price":29740,"label":"Session High","color":"#f05252"},'+
'{"type":"entry","priceHigh":29600,"priceLow":29540,"label":"Entry Zone","color":"#f0a92e30"},'+
'{"type":"sl","price":29650,"label":"SL","color":"#f05252"},'+
'{"type":"support","price":29480,"label":"TP1","color":"#22d3a4"}'+
"]}\n"+
"<<<END_LEVELS>>>\n\n"+
"WARNING: For educational purposes only, not financial advice.";

function buildChartSystemPrompt(s,stats,dataset){
  var base="You are TradeProof Chart Analyzer - an expert trading analyst.\n"+
    "Analysis style: "+s+"\n"+
    (STYLE_PROMPTS[s]||"")+"\n\n"+
    "When analyzing a chart, always provide:\n"+
    "1. Market Overview: Asset, timeframe (if visible), current trend\n"+
    "2. Technical Analysis: Detailed analysis using the "+s+" methodology\n"+
    "3. Key Levels: List important levels with prices\n"+
    "4. Candlestick Observations: Notable patterns\n"+
    "5. Confluence Factors: What confirms the bias\n"+
    "6. Entry Strategy: Specific trigger to enter\n"+
    "7. Risk Note: Invalidation level and any warnings";
  if(stats&&dataset){
    base+="\n\nUSER STRATEGY CONTEXT: Win rate "+
      (stats.winRate*100).toFixed(1)+"%, PF "+
      stats.profitFactor.toFixed(2)+", avg win $"+
      stats.avgWin.toFixed(0)+" / avg loss $"+
      stats.avgLoss.toFixed(0)+". Align R:R suggestions to match their proven parameters.";
  }
  base+=TRADE_SUMMARY_SECTION;
  return base;
}

function ChartAnalyzerSection({dataset,stats}){
  const [style,setStyle]=useState("Price Action");
  const [styleOpen,setStyleOpen]=useState(false);
  const [image,setImage]=useState(null);
  const [imageB64,setImageB64]=useState(null);
  const [imageReady,setImageReady]=useState(false);
  const [analysis,setAnalysis]=useState(null);
  const [loading,setLoading]=useState(false);
  const [followUp,setFollowUp]=useState("");
  const [followLoading,setFollowLoading]=useState(false);
  const [history,setHistory]=useState([]);
  const [histOpen,setHistOpen]=useState(false);
  const fileRef=useRef();
  const bottomRef=useRef();

  const STYLES=["Price Action","Smart Money (SMC)","ICT","Supply & Demand","Classic TA"];

  // SYSTEM_PROMPT and STYLE_PROMPTS are defined outside component (see above)

  // ── image resizing + compression (from v3) ──────────────────────────────────
  const handleFile=file=>{
    if(!file||!file.type.startsWith("image/")) return;
    setImageReady(false);
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;
      const img=new Image();
      img.onload=()=>{
        const MAX=1600;
        let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
        if(!w||!h){
          setImage(dataUrl);
          setImageB64(dataUrl.split(",")[1]);
          setImageReady(true); setAnalysis(null); return;
        }
        if(w>MAX||h>MAX){
          if(w>h){h=Math.round(h*(MAX/w));w=MAX;}
          else{w=Math.round(w*(MAX/h));h=MAX;}
        }
        try{
          const canvas=document.createElement("canvas");
          canvas.width=w; canvas.height=h;
          const ctx=canvas.getContext("2d");
          ctx.drawImage(img,0,0,w,h);
          let out=canvas.toDataURL("image/jpeg",0.82);
          if(out.length>3_000_000){out=canvas.toDataURL("image/jpeg",0.6);}
          if(out.length>3_000_000){
            const c2=document.createElement("canvas");
            c2.width=Math.round(w*0.6); c2.height=Math.round(h*0.6);
            c2.getContext("2d").drawImage(canvas,0,0,c2.width,c2.height);
            out=c2.toDataURL("image/jpeg",0.7);
          }
          setImage(out);
          setImageB64(out.split(",")[1]);
        }catch(_){
          setImage(dataUrl);
          setImageB64(dataUrl.split(",")[1]);
        }
        setImageReady(true); setAnalysis(null);
      };
      img.onerror=()=>{
        setImage(dataUrl);
        setImageB64(dataUrl.split(",")[1]);
        setImageReady(true); setAnalysis(null);
      };
      img.src=dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const cleanB64=(s)=>{if(!s)return s;const idx=s.indexOf(",");return idx!==-1?s.slice(idx+1):s;};

  useEffect(()=>{
    const onPaste=e=>{
      const item=[...e.clipboardData.items].find(i=>i.type.startsWith("image/"));
      if(item) handleFile(item.getAsFile());
    };
    window.addEventListener("paste",onPaste);
    return()=>window.removeEventListener("paste",onPaste);
  },[]);

  const extractLevels=(text)=>{
    try{
      const match=text.match(/<<<LEVELS_JSON>>>([\s\S]*?)<<<END_LEVELS>>>/);
      if(!match) return null;
      return JSON.parse(match[1].trim());
    }catch(_){return null;}
  };

  const LEVELS_PROMPT=
    "Based on the analysis above, output chart overlay levels in EXACTLY this format with no other text:\n"+
    "<<<LEVELS_JSON>>>\n"+
    "{"+
      "\"bias\":\"SHORT or LONG\","+
      "\"priceMin\":LOWEST_PRICE_NUMBER,"+
      "\"priceMax\":HIGHEST_PRICE_NUMBER,"+
      "\"levels\":["+
        "{\"type\":\"resistance\",\"price\":PRICE,\"label\":\"Label\",\"color\":\"#f05252\"},"+
        "{\"type\":\"resistance_zone\",\"priceHigh\":PRICE,\"priceLow\":PRICE,\"label\":\"Label\",\"color\":\"#f0525230\"},"+
        "{\"type\":\"entry\",\"priceHigh\":PRICE,\"priceLow\":PRICE,\"label\":\"Entry Zone\",\"color\":\"#f0a92e30\"},"+
        "{\"type\":\"sl\",\"price\":PRICE,\"label\":\"SL: PRICE\",\"color\":\"#f05252\"},"+
        "{\"type\":\"support\",\"price\":PRICE,\"label\":\"TP1: PRICE\",\"color\":\"#22d3a4\"},"+
        "{\"type\":\"support\",\"price\":PRICE,\"label\":\"TP2: PRICE\",\"color\":\"#22d3a4\"}"+
      "]"+
    "}\n"+
    "<<<END_LEVELS>>>\n"+
    "Replace all PRICE values with real numbers from the chart. Output ONLY the block above, nothing else.";

  const { session:authSession, usage:authUsage, recordUse:authRecordUse, setPaywallFor } = useAuth();

  const analyze=async()=>{
    if(!imageB64||!imageReady||loading) return;
    if(!authSession){ setPaywallFor("login"); return; }
    const plan = PLANS[authUsage?.plan||"free"];
    if((authUsage?.chart_analyses||0) >= plan.chartAnalyses){ setPaywallFor("chart"); return; }
    await authRecordUse("chart");
    setLoading(true); setAnalysis(null);
    try{
      // Step 1: Get the written analysis
      const res1=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:1000,
          system:buildChartSystemPrompt(style,stats,dataset),
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:cleanB64(imageB64)}},
            {type:"text",text:"Analyze this trading chart using the "+style+" methodology."},
          ]}],
        }),
      });
      const d1=await res1.json();
      if(d1.error){
        setAnalysis({id:0,style,image,imageB64,text:"⚠️ API Error: "+d1.error.message,levels:null,followUps:[],ts:""});
        setLoading(false); return;
      }
      const analysisText=d1.content?.find(b=>b.type==="text")?.text||"No analysis returned.";

      // Step 2: Get the JSON levels in a separate focused call
      const res2=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:400,
          messages:[
            {role:"user",content:[
              {type:"image",source:{type:"base64",media_type:"image/jpeg",data:cleanB64(imageB64)}},
              {type:"text",text:"Here is the analysis:\n"+analysisText},
            ]},
            {role:"assistant",content:"I have analyzed the chart."},
            {role:"user",content:LEVELS_PROMPT},
          ],
        }),
      });
      const d2=await res2.json();
      const levelsRaw=d2.content?.find(b=>b.type==="text")?.text||"";
      const levels=extractLevels(levelsRaw);

      const entry={id:Date.now(),style,image,imageB64,text:analysisText,levels,followUps:[],ts:new Date().toLocaleTimeString()};
      setAnalysis(entry);
      setHistory(h=>[entry,...h.slice(0,14)]);
    }catch(e){
      setAnalysis({id:0,style,image,imageB64,text:"⚠️ Error: "+e.message,levels:null,followUps:[],ts:""});
    }
    setLoading(false);
  };

  const sendFollowUp=async()=>{
    const q=followUp.trim(); if(!q||followLoading||!analysis) return;
    setFollowLoading(true); setFollowUp("");
    try{
      const msgs=[
        {role:"user",content:[
          {type:"image",source:{type:"base64",media_type:"image/jpeg",data:cleanB64(analysis.imageB64||imageB64)}},
          {type:"text",text:"Analyze this chart."},
        ]},
        {role:"assistant",content:analysis.text},
      ];
      for(const fu of analysis.followUps){
        msgs.push({role:"user",content:fu.q});
        msgs.push({role:"assistant",content:fu.a});
      }
      msgs.push({role:"user",content:q});
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,system:buildChartSystemPrompt(style,stats,dataset),messages:msgs}),
      });
      const data=await res.json();
      if(data.error){
        setAnalysis(prev=>({...prev,followUps:[...prev.followUps,{q,a:"⚠️ API Error: "+data.error.message}]}));
      } else {
        const reply=data.content?.find(b=>b.type==="text")?.text||"No response.";
        setAnalysis(prev=>({...prev,followUps:[...prev.followUps,{q,a:reply}]}));
      }
    }catch(e){
      setAnalysis(prev=>({...prev,followUps:[...prev.followUps,{q,a:"⚠️ Error: "+e.message}]}));
    }
    setFollowLoading(false);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const renderText=(text)=>text.split("\n").map((line,i)=>{
    if(line.startsWith("### ")) return <div key={i} style={{color:C.text,fontWeight:700,fontSize:14,marginTop:12,marginBottom:4}}>{line.slice(4)}</div>;
    if(line.startsWith("## ")) return <div key={i} style={{color:C.accent,fontWeight:700,fontSize:15,marginTop:14,marginBottom:5}}>{line.slice(3)}</div>;
    if(line.startsWith("**")&&line.endsWith("**")) return <div key={i} style={{color:C.text,fontWeight:700,marginBottom:3}}>{line.slice(2,-2)}</div>;
    if(line.startsWith("- ")||line.startsWith("• ")){
      const raw=line.slice(2);
      const parts=raw.split(/(\*\*[^*]+\*\*)/g);
      return <div key={i} style={{color:C.textDim,paddingLeft:16,marginBottom:3,display:"flex",gap:6,lineHeight:1.6}}><span style={{color:C.accent,flexShrink:0}}>›</span><span>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:C.text}}>{p.slice(2,-2)}</strong>:p)}</span></div>;
    }
    if(line.startsWith("|")) return <div key={i} className="mono" style={{color:C.textDim,fontSize:12,padding:"3px 0",borderBottom:`1px solid ${C.border}18`}}>{line}</div>;
    if(line.startsWith("⚠️")) return <div key={i} style={{background:C.yellowDim,border:`1px solid ${C.yellow}30`,borderRadius:8,padding:"10px 14px",color:C.yellow,fontSize:12,marginTop:10,fontStyle:"italic"}}>{line}</div>;
    if(line==="") return <div key={i} style={{height:5}}/>;
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    return <div key={i} style={{color:C.textDim,marginBottom:3,lineHeight:1.6}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:C.text}}>{p.slice(2,-2)}</strong>:p)}</div>;
  });

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.panel,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setHistOpen(o=>!o)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:7,
            border:`1px solid ${histOpen?C.accentBorder:C.border}`,
            background:histOpen?C.accentDim:"transparent",color:histOpen?C.accent:C.textMuted,
            cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",
          }}>🕐 History {history.length>0&&<span style={{background:C.accentDim,color:C.accent,borderRadius:4,padding:"0 5px",fontSize:10,fontWeight:700,border:`1px solid ${C.accentBorder}`}}>{history.length}</span>}</button>
          {analysis&&<button onClick={()=>{setImage(null);setImageB64(null);setImageReady(false);setAnalysis(null);}} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif"}}>+ New Chart</button>}
        </div>
        <div style={{position:"relative"}}>
          <button onClick={()=>setStyleOpen(o=>!o)} style={{
            display:"flex",alignItems:"center",gap:7,padding:"6px 13px",borderRadius:8,
            border:`1px solid ${C.border}`,background:C.panel2,color:C.text,
            cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:500,
          }}>
            <span style={{color:C.textMuted,fontSize:11}}>Style:</span>{style}<span style={{color:C.textMuted,fontSize:10}}>▾</span>
          </button>
          {styleOpen&&(
            <div style={{position:"absolute",right:0,top:"calc(100% + 5px)",background:C.panel2,border:`1px solid ${C.borderLight}`,borderRadius:10,overflow:"hidden",zIndex:200,minWidth:190,boxShadow:"0 8px 32px #00000070"}}>
              {STYLES.map(s=>(
                <button key={s} onClick={()=>{setStyle(s);setStyleOpen(false);}} style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  width:"100%",padding:"10px 15px",border:"none",
                  background:s===style?C.accentDim:"transparent",
                  color:s===style?C.accent:C.textDim,
                  cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",textAlign:"left",
                  transition:"background .1s",
                }}>{s}{s===style&&<span style={{color:C.accent,fontSize:13}}>✓</span>}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History strip */}
      {histOpen&&(
        <div style={{borderBottom:`1px solid ${C.border}`,background:C.panel2,padding:"10px 18px",flexShrink:0}}>
          {history.length===0?(
            <div style={{color:C.textMuted,fontSize:12,padding:"8px 4px"}}>No chart analyses yet. Analyze a chart to build your history.</div>
          ):(
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
              {history.map(h=>(
                <div key={h.id} onClick={()=>{setAnalysis(h);setImage(h.image);setImageB64(h.imageB64);setHistOpen(false);}} style={{
                  flexShrink:0,background:C.panel,border:`1px solid ${analysis?.id===h.id?C.accentBorder:C.border}`,
                  borderRadius:10,cursor:"pointer",width:170,overflow:"hidden",
                  transition:"border-color .15s",
                  outline:analysis?.id===h.id?`1px solid ${C.accentBorder}`:"none",
                }}>
                  <div style={{position:"relative",height:90,background:"#000",overflow:"hidden"}}>
                    <img src={h.image} alt="chart" style={{width:"100%",height:"100%",objectFit:"cover",opacity:.9}}/>
                    <div style={{position:"absolute",top:5,left:5,background:C.accentDim,border:`1px solid ${C.accentBorder}`,borderRadius:4,padding:"1px 6px",fontSize:9,color:C.accent,fontWeight:700}}>{h.style.split(" ")[0]}</div>
                    {analysis?.id===h.id&&<div style={{position:"absolute",top:5,right:5,background:C.greenDim,border:`1px solid ${C.greenBorder}`,borderRadius:4,padding:"1px 6px",fontSize:9,color:C.green,fontWeight:700}}>Active</div>}
                  </div>
                  <div style={{padding:"7px 9px"}}>
                    <div style={{color:C.textMuted,fontSize:9,marginBottom:3}}>{h.ts}</div>
                    <div style={{color:C.textDim,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.text.replace(/[#*]/g,"").trim().slice(0,50)}...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflowY:"auto"}}>
        {!image?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:18,padding:"20px"}}
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}>
            <div style={{textAlign:"center",marginBottom:4}}>
              <div style={{color:C.text,fontSize:19,fontWeight:600,marginBottom:6}}>Upload chart to analyze</div>
              <div style={{color:C.textMuted,fontSize:12}}>Using <strong style={{color:C.accent}}>{style}</strong> methodology</div>
            </div>
            <div onClick={()=>fileRef.current?.click()} style={{
              width:340,border:`1.5px dashed ${C.border}`,borderRadius:14,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              cursor:"pointer",gap:10,padding:"30px 20px",background:C.panel,
              transition:"all .2s",
            }}>
              <div style={{width:46,height:46,borderRadius:12,background:C.panel2,border:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📈</div>
              <div style={{color:C.textDim,fontSize:13,fontWeight:500}}>Upload Chart Screenshot</div>
              <div style={{color:C.textMuted,fontSize:11}}>or paste from clipboard (Ctrl+V)</div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            </div>
            <div style={{color:C.textMuted,fontSize:11}}>PNG · JPG · WebP · TradingView screenshots</div>
          </div>
        ):(
          <div style={{maxWidth:780,margin:"0 auto",padding:"18px"}}>
            {!analysis&&!loading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,marginBottom:18}}>
                <img src={image} alt="chart" style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,maxHeight:320,objectFit:"contain",background:"#000"}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setImage(null);setImageB64(null);setImageReady(false);}} style={{padding:"8px 15px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Remove</button>
                  <button onClick={analyze} disabled={!imageReady} style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${imageReady?C.accentBorder:C.border}`,background:imageReady?C.accentDim:"transparent",color:imageReady?C.accent:C.textMuted,cursor:imageReady?"pointer":"not-allowed",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:600}}>{imageReady?"Analyze this chart →":"Processing image..."}</button>
                </div>
              </div>
            )}
            {loading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"50px 0"}}>
                <div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:4,background:C.accent,animation:`pulse 1.2s ${i*.2}s ease-in-out infinite`}}/>)}</div>
                <div style={{color:C.textMuted,fontSize:13}}>Analyzing with <strong style={{color:C.accent}}>{style}</strong>...</div>
              </div>
            )}
            {analysis&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{position:"relative"}}>
                  <img src={analysis.image} alt="chart" style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,maxHeight:360,objectFit:"contain",background:"#000"}}/>
                  <div style={{position:"absolute",top:8,right:8,background:C.panel,borderRadius:5,padding:"3px 8px",fontSize:10,color:C.textMuted,border:`1px solid ${C.border}`,fontWeight:600}}>You · Chart</div>
                </div>
                <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <div style={{width:26,height:26,borderRadius:6,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>📊</div>
                    <div style={{color:C.textDim,fontSize:10,textTransform:"uppercase",letterSpacing:".1em",fontWeight:600}}>{analysis.style} Analysis · {analysis.ts}</div>
                  </div>
                  <div style={{fontSize:13,lineHeight:1.7}}>{renderText(analysis.text)}</div>
                </div>
                {analysis.levels&&(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{color:C.textDim,fontSize:10,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600,paddingLeft:2}}>📈 Chart Overlay</div>
                    <ChartOverlay image={analysis.image} levels={analysis.levels}/>
                  </div>
                )}
                {analysis.followUps.map((fu,i)=>(
                  <div key={i} style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"flex-end"}}>
                      <div style={{background:C.accentDim,border:`1px solid ${C.accentBorder}`,borderRadius:10,padding:"9px 13px",maxWidth:"72%",color:C.text,fontSize:13}}>{fu.q}</div>
                    </div>
                    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",fontSize:13,lineHeight:1.7}}>{renderText(fu.a)}</div>
                  </div>
                ))}
                {followLoading&&<div style={{display:"flex",gap:5,padding:"8px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:4,background:C.accent,animation:`pulse 1.2s ${i*.2}s ease-in-out infinite`}}/>)}</div>}
                <div ref={bottomRef}/>
              </div>
            )}
          </div>
        )}
      </div>

      {analysis&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:"11px 18px",background:C.panel,flexShrink:0}}>
          <div style={{maxWidth:780,margin:"0 auto",display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:15,flexShrink:0}}>📎</span>
            <input value={followUp} onChange={e=>setFollowUp(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendFollowUp()}
              placeholder="Ask a follow-up..."
              style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
            <button onClick={sendFollowUp} disabled={followLoading||!followUp.trim()} style={{
              width:38,height:38,borderRadius:9,flexShrink:0,
              border:`1px solid ${followLoading||!followUp.trim()?C.border:C.accentBorder}`,
              background:followLoading||!followUp.trim()?C.panel:C.accentDim,
              color:followLoading||!followUp.trim()?C.textMuted:C.accent,
              cursor:followLoading||!followUp.trim()?"not-allowed":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,
            }}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function AppInner(){
  const [page,setPage]=useState("Summary");
  const [dataset,setDataset]=useState(null);
  const stats=useMemo(()=>dataset?calcStats(dataset.trades,dataset.accountSize):null,[dataset]);
  const { session, usage, signOut, paywallFor, setPaywallFor } = useAuth();

  // Handle Stripe success redirect
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("stripe_success")==="1"){
      window.history.replaceState(null,"",window.location.pathname);
      setPage("billing");
    }
  },[]);

  const ANALYTICS=[
    {id:"Summary",    icon:"📋", label:"Summary"},
    {id:"Performance",icon:"📈", label:"Performance"},
    {id:"Risk",       icon:"⚠️",  label:"Risk"},
    {id:"Backtest",   icon:"🔬", label:"Backtest"},
    {id:"Filters",    icon:"🔍", label:"Filters"},
    {id:"Prop Firm",  icon:"🏦", label:"Prop Firm"},
    {id:"Optimizer",  icon:"⚙️",  label:"Optimizer"},
    {id:"QuantLab",   icon:"🧪", label:"QuantLab"},
  ];
  const AI_TOOLS=[
    {id:"chat",  icon:"🤖", label:"AI Chat"},
    {id:"chart", icon:"📸", label:"Chart Analyzer"},
  ];
  const isAnalytics=ANALYTICS.some(a=>a.id===page);
  const plan = PLANS[usage?.plan||"free"];
  const isPro = usage?.plan !== "free";

  const NavBtn=({item,badge})=>(
    <button onClick={()=>setPage(item.id)} style={{
      width:"100%",display:"flex",alignItems:"center",gap:9,
      padding:"8px 10px",borderRadius:7,border:"none",
      background:page===item.id?C.accentDim:"transparent",
      color:page===item.id?C.accent:C.textMuted,
      cursor:"pointer",fontFamily:"'Inter',sans-serif",
      fontSize:12,fontWeight:page===item.id?600:400,
      outline:page===item.id?`1px solid ${C.accentBorder}`:"none",
      marginBottom:1,transition:"all .15s",textAlign:"left",
    }}>
      <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
      <span style={{flex:1}}>{item.label}</span>
      {badge&&<span style={{background:C.accentDim,color:C.accent,fontSize:9,padding:"1px 5px",borderRadius:4,border:`1px solid ${C.accentBorder}`,fontWeight:700,flexShrink:0}}>{badge}</span>}
    </button>
  );

  return(
    <>
      <style>{styles}</style>
      <PaywallModal/>
      <div style={{display:"flex",height:"100vh",background:C.bg,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{
          width:190,flexShrink:0,background:C.panel,
          borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column",
          height:"100vh",
        }}>
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:7,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📊</div>
            <div className="mono" style={{fontSize:13,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>
              Trade<span style={{color:C.accent}}>Proof</span>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"10px 8px"}}>
            <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600,padding:"4px 10px 6px"}}>Analytics</div>
            {ANALYTICS.map(n=><NavBtn key={n.id} item={n}/>)}
            <div style={{height:1,background:C.border,margin:"14px 4px 12px"}}/>
            <div style={{color:C.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontWeight:600,padding:"4px 10px 6px"}}>AI Tools</div>
            {AI_TOOLS.map(n=>{
              const used = n.id==="chat" ? usage?.ai_messages||0 : usage?.chart_analyses||0;
              const max  = n.id==="chat" ? plan.aiMessages : plan.chartAnalyses;
              const atLimit = !isPro && used>=max;
              return <NavBtn key={n.id} item={n} badge={atLimit?"🔒":"AI"}/>;
            })}
            <div style={{height:1,background:C.border,margin:"14px 4px 12px"}}/>
            <NavBtn item={{id:"billing",icon:"⚙️",label:"Account & Billing"}}/>
          </div>
          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            {/* User avatar */}
            {session&&(
              <div onClick={()=>setPage("billing")} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer",padding:"5px 6px",borderRadius:8,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.panelHover}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {session.user?.user_metadata?.avatar_url
                  ? <img src={session.user.user_metadata.avatar_url} alt="" style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,flexShrink:0}}/>
                  : <div style={{width:24,height:24,borderRadius:6,background:C.accentDim,border:`1px solid ${C.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>👤</div>
                }
                <div style={{overflow:"hidden",flex:1}}>
                  <div style={{color:C.textDim,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.user?.user_metadata?.full_name||session.user?.email||"User"}</div>
                  <div style={{color:isPro?C.green:C.textMuted,fontSize:9,marginTop:1,fontWeight:600}}>{plan.label}</div>
                </div>
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:dataset?8:0}}>
              <div style={{width:6,height:6,borderRadius:3,background:C.green}}/>
              <span style={{color:C.textMuted,fontSize:10}}>AI Connected</span>
            </div>
            {dataset&&(
              <button onClick={()=>{setDataset(null);setPage("Summary");}} style={{
                width:"100%",padding:"5px 0",borderRadius:6,
                border:`1px solid ${C.border}`,background:"transparent",
                color:C.textMuted,cursor:"pointer",fontSize:10,
                fontFamily:"'Inter',sans-serif",
              }}>↑ New Dataset</button>
            )}
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {isAnalytics&&(
            <div style={{
              borderBottom:`1px solid ${C.border}`,padding:"0 20px",
              display:"flex",alignItems:"center",height:48,
              background:C.panel,flexShrink:0,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:C.textDim,fontSize:13,fontWeight:600}}>{page}</span>
                {dataset&&(
                  <>
                    <div style={{width:1,height:14,background:C.border}}/>
                    <span className="mono" style={{color:C.textMuted,fontSize:11}}>{dataset.filename}</span>
                    <div style={{background:C.accentDim,color:C.accent,fontSize:10,padding:"1px 7px",borderRadius:4,fontWeight:700,border:`1px solid ${C.accentBorder}`}} className="mono">{dataset.trades.length} trades</div>
                  </>
                )}
              </div>
            </div>
          )}
          {isAnalytics&&(
            <div style={{flex:1,overflowY:"auto",padding:18}}>
              {!dataset?(
                <UploadScreen onUpload={setDataset}/>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {dataset.warnings.length>0&&(
                    <div style={{background:C.yellowDim,border:`1px solid ${C.yellow}35`,borderRadius:8,padding:"9px 14px",color:C.yellow,fontSize:12,fontWeight:500}}>
                      ⚠️ {dataset.warnings.length} warning(s) during CSV parsing
                    </div>
                  )}
                  {page==="Summary"&&stats&&<SummaryTab trades={dataset.trades} stats={stats}/>}
                  {page==="Performance"&&stats&&<PerformanceTab trades={dataset.trades} stats={stats}/>}
                  {page==="Risk"&&stats&&<RiskTab trades={dataset.trades} stats={stats}/>}
                  {page==="Backtest"&&stats&&<BacktestTab trades={dataset.trades} stats={stats}/>}
                  {page==="Filters"&&<FiltersTab trades={dataset.trades}/>}
                  {page==="Prop Firm"&&<PropFirmTab trades={dataset.trades}/>}
                  {page==="Optimizer"&&<OptimizerTab trades={dataset.trades}/>}
                  {page==="QuantLab"&&<QuantLabTab/>}
                </div>
              )}
            </div>
          )}
          {page==="chat"&&<AIChatSection dataset={dataset} stats={stats}/>}
          {page==="chart"&&<ChartAnalyzerSection dataset={dataset} stats={stats}/>}
          {page==="billing"&&<div style={{flex:1,overflowY:"auto"}}><BillingPage/></div>}
        </div>
      </div>
    </>
  );
}

export default function TradeProof(){
  return (
    <AuthProvider>
      <AuthGate/>
    </AuthProvider>
  );
}

function AuthGate(){
  const { session } = useAuth();
  if(session === undefined) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg}}>
      <div style={{width:36,height:36,border:`3px solid ${C.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
    </div>
  );
  if(!session) return <LoginScreen/>;
  return <AppInner/>;
}

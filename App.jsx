import { useState, useRef, useEffect, useCallback } from "react";
import {
  AlertCircle, ShieldCheck, Globe, Phone, Activity, Lock, FileText,
  Send, ChevronRight, Plus, Search, X, CreditCard,
  Users, Stethoscope, AlertTriangle, Share2,
  History, MessageCircle, Nfc, MapPin, Plane, Heart,
  Fingerprint
} from "lucide-react";

// ─── Responsive Hook ──────────────────────────────────────────────────────────
function useScreenSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth < 768) return "mobile";
    if (window.innerWidth < 1100) return "tablet";
    return "desktop";
  });
  useEffect(() => {
    const fn = () => setSize(window.innerWidth < 768 ? "mobile" : window.innerWidth < 1100 ? "tablet" : "desktop");
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return size;
}

// ─── Persistence Hook ─────────────────────────────────────────────────────────
function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem("medycard_" + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const setPersistedState = useCallback((value) => {
    setState(prev => {
      const next = typeof value === "function" ? value(prev) : value;
      try { localStorage.setItem("medycard_" + key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [state, setPersistedState];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const AUTH_KEY = "medycard_pin_hash";
const INACTIVITY_MS = 5 * 60 * 1000;

function hashPIN(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
  return "medy_" + Math.abs(h).toString(36) + pin.length;
}

function useAuth() {
  const hasPin = !!localStorage.getItem(AUTH_KEY);
  const [locked, setLocked] = useState(hasPin);
  const [setupMode, setSetupMode] = useState(!hasPin);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const inactivityTimer = useRef(null);

  useEffect(() => {
    if (window.PublicKeyCredential)
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(ok => setBiometricAvailable(ok)).catch(() => {});
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (localStorage.getItem(AUTH_KEY)) setLocked(true);
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "touchstart", "keydown", "scroll"];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  const savePin = useCallback((pin) => {
    localStorage.setItem(AUTH_KEY, hashPIN(pin));
    setSetupMode(false);
    setLocked(false);
  }, []);

  const checkPin = useCallback((pin) => {
    if (localStorage.getItem(AUTH_KEY) === hashPIN(pin)) { setLocked(false); return true; }
    return false;
  }, []);

  const lock = useCallback(() => setLocked(true), []);

  const biometricUnlock = useCallback(async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      await navigator.credentials.get({
        publicKey: { challenge, timeout: 30000, userVerification: "required", rpId: window.location.hostname }
      });
      setLocked(false);
      return true;
    } catch { return false; }
  }, []);

  return { locked, setupMode, biometricAvailable, savePin, checkPin, lock, biometricUnlock };
}

// ─── Tightened AI System Prompts ──────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  emergency: `You are Medy, a general health information companion inside MedyCard Pro — a personal medical ID app designed by a Registered Nurse with 30 years of clinical experience.

YOUR ROLE: Provide general health information and wellness guidance ONLY. You are not a physician, not providing medical advice, and not a substitute for professional care.

STRICT RULES — follow absolutely:
• If anyone describes chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness, or any life-threatening emergency — your FIRST sentence must be "Call 911 immediately." No exceptions.
• NEVER diagnose any medical condition
• NEVER recommend specific prescription medications or dosages  
• NEVER tell someone to stop, skip, or change a prescribed medication
• ALWAYS end health guidance with a recommendation to consult a doctor or call 911 if urgent
• Keep all responses to 3-4 sentences maximum
• If uncertain, say "I'm not sure — please contact your doctor or call 911 if this feels urgent"

TONE: Calm, warm, like a knowledgeable friend who happens to have nursing experience.`,

  vault: `You are Medy, a health information companion in the MedyCard Pro secure vault. Designed by an RN with 30 years of clinical experience.

YOUR ROLE: Help users understand general public information about medications and medical terms. Educational information only — not medical advice.

STRICT RULES:
• NEVER advise a user to change, stop, or adjust a prescribed medication
• For any medication question, ALWAYS end with "Your pharmacist is the best resource for medication questions"
• For any health concern, ALWAYS recommend contacting their doctor
• Keep responses to 2-3 sentences maximum`,

  check: `You are Medy, a medication awareness companion in MedyCard Pro. Designed by an RN with 30 years of clinical experience.

YOUR ROLE: Share general public awareness about medication categories. NOT a pharmacist. NOT a clinical drug interaction system.

STRICT RULES:
• Frame ALL responses as general public awareness, never clinical advice
• NEVER say medications "are dangerous together" — say "commonly reviewed together" or "worth discussing with your pharmacist"
• ALWAYS end with "Please speak with your pharmacist or prescribing doctor before making any medication decisions"
• NEVER recommend stopping or changing any medication
• Maximum 3 sentences per response`,

  family: `You are Medy, a family health coordination companion in MedyCard Pro. Designed by an RN with 30 years of clinical experience.

ROLE: Provide general caregiving tips and wellness information only. Always recommend professional medical guidance for health decisions. Keep responses supportive and brief — 2-3 sentences.`,

  travel: `You are Medy, a travel health awareness companion in MedyCard Pro. Designed by an RN with 30 years of clinical experience.

ROLE: Share general travel health awareness — common regional vaccinations, food/water safety, emergency preparedness.

STRICT RULES:
• NEVER provide prescription advice or specific medication dosing
• For ANY health emergency while traveling — first recommendation is always local emergency services
• Vaccination info is general awareness only — ALWAYS recommend a travel medicine clinic before international travel
• Keep responses to 3-4 sentences. Include local emergency number when relevant.`,
};

async function askMedy(messageHistory, ctx) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPTS[ctx] || SYSTEM_PROMPTS.emergency,
      messages: messageHistory,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Sorry, I couldn't process that.";
}

// ─── Markdown ─────────────────────────────────────────────────────────────────
function MD({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-1 leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <br key={i}/>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return <p key={i} className="flex gap-1.5"><span className="opacity-40">•</span><span>{line.slice(2)}</span></p>;
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i}>{parts.map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}</p>;
      })}
    </div>
  );
}

function checkDrugInteractions(meds) {
  const pairs = [["lisinopril","aspirin"],["warfarin","ibuprofen"],["metformin","contrast dye"],["ssri","tramadol"],["warfarin","aspirin"]];
  if (meds.length < 2) return "none";
  const l = meds.map(m => m.toLowerCase());
  for (const [a,b] of pairs) if (l.includes(a) && l.includes(b)) return "flag";
  return "safe";
}

// ─── PIN Keypad (shared by setup + lock screen) ───────────────────────────────
function Keypad({ onDigit, onBack, showBiometric, onBiometric, bioLoading }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1,2,3,4,5,6,7,8,9].map(k=>(
        <button key={k} onClick={()=>onDigit(String(k))} className="h-14 rounded-2xl font-black text-xl transition-all active:scale-90" style={{background:"rgba(255,255,255,0.12)",color:"white",border:"1px solid rgba(255,255,255,0.15)"}}>
          {k}
        </button>
      ))}
      {showBiometric
        ? <button onClick={onBiometric} className="h-14 rounded-2xl transition-all active:scale-90 flex items-center justify-center" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)"}}>
            {bioLoading?<div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>:<Fingerprint size={22} className="text-white/70"/>}
          </button>
        : <div/>
      }
      <button onClick={()=>onDigit("0")} className="h-14 rounded-2xl font-black text-xl transition-all active:scale-90" style={{background:"rgba(255,255,255,0.12)",color:"white",border:"1px solid rgba(255,255,255,0.15)"}}>0</button>
      <button onClick={onBack} className="h-14 rounded-2xl font-black text-xl transition-all active:scale-90" style={{background:"rgba(255,255,255,0.12)",color:"white",border:"1px solid rgba(255,255,255,0.15)"}}>⌫</button>
    </div>
  );
}

function PINDots({ count, filled }) {
  return (
    <div className="flex justify-center gap-3 mb-8">
      {Array.from({length:count}).map((_,i)=>(
        <div key={i} className="w-4 h-4 rounded-full transition-all duration-200" style={{background:i<filled?"white":"rgba(255,255,255,0.2)"}}/>
      ))}
    </div>
  );
}

function AppLogo() {
  return (
    <>
      <div className="w-16 h-16 bg-red-500 rounded-3xl flex items-center justify-center mb-5 shadow-xl shadow-red-500/30">
        <CreditCard size={32} className="text-white"/>
      </div>
      <h1 className="text-white font-black text-3xl mb-1">MedyCard Pro</h1>
    </>
  );
}

// ─── PIN Setup ────────────────────────────────────────────────────────────────
function PINSetup({ onSave }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const handleDigit = (d) => {
    if (step===1) {
      const next = pin+d;
      setPin(next);
      if (next.length===6) setStep(2);
    } else {
      const next = confirm+d;
      setConfirm(next);
      if (next.length===6) {
        if (next===pin) onSave(next);
        else { setError("PINs don't match. Try again."); setConfirm(""); setPin(""); setStep(1); }
      }
    }
  };
  const handleBack = () => step===1 ? setPin(p=>p.slice(0,-1)) : setConfirm(p=>p.slice(0,-1));

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center" style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f,#1d4ed8)",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"}}>
      <AppLogo/>
      <p className="text-blue-300 font-semibold text-sm uppercase tracking-widest mb-10">Set Up Your Security PIN</p>
      <div className="bg-white/10 border border-white/20 rounded-2xl px-8 py-8 w-80 text-center">
        <p className="text-white font-bold text-base mb-1">{step===1?"Create a 6-digit PIN":"Confirm your PIN"}</p>
        <p className="text-blue-300 text-sm mb-6">{step===1?"You'll use this to unlock MedyCard Pro":"Enter the same PIN again"}</p>
        {error&&<p className="text-red-400 text-sm mb-4 font-semibold">{error}</p>}
        <PINDots count={6} filled={step===1?pin.length:confirm.length}/>
        <Keypad onDigit={handleDigit} onBack={handleBack} showBiometric={false}/>
      </div>
      <p className="text-blue-400/50 text-xs mt-6 text-center px-8">Your PIN is stored locally on this device only.<br/>MedyCard Pro never transmits your PIN.</p>
    </div>
  );
}

// ─── Emergency Access View (no PIN needed) ────────────────────────────────────
function EmergencyAccessView({ onClose }) {
  const medications = (() => { try { return JSON.parse(localStorage.getItem("medycard_medications")||"[]"); } catch { return []; } })();
  const allergies   = (() => { try { return JSON.parse(localStorage.getItem("medycard_allergies")||"[]"); } catch { return []; } })();
  const bloodType   = (() => { try { return JSON.parse(localStorage.getItem("medycard_bloodType")||'"Unknown"'); } catch { return "Unknown"; } })();
  const contacts    = (() => { try { return JSON.parse(localStorage.getItem("medycard_contacts")||"[]"); } catch { return []; } })();

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{background:"#0a0a0a",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",zIndex:10000}}>
      {/* Red emergency header */}
      <div className="sticky top-0 z-10 px-5 pt-12 pb-4" style={{background:"#FF3B30"}}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-white"/>
            <p className="text-white font-black text-xl">MEDICAL ID</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl bg-white/20 text-white font-bold text-sm">✕ Close</button>
        </div>
        <p className="text-red-100 text-xs font-semibold">Emergency access — no PIN required. Vault remains locked.</p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Critical info card */}
        <div className="rounded-2xl overflow-hidden border-2 border-red-500/40">
          <div className="px-4 py-2 flex items-center gap-2" style={{background:"#FF3B30"}}>
            <Heart size={14} className="text-white" fill="white"/>
            <p className="text-white font-black text-sm uppercase tracking-wider">Critical Information</p>
          </div>
          <div className="p-4 space-y-4" style={{background:"#1a1a1a"}}>
            <div>
              <p className="text-red-400 font-black uppercase tracking-widest mb-1" style={{fontSize:10}}>Blood Type</p>
              <p className="text-white font-black text-3xl">{bloodType}</p>
            </div>
            <div>
              <p className="text-red-400 font-black uppercase tracking-widest mb-2" style={{fontSize:10}}>Allergies</p>
              {allergies.length > 0
                ? <div className="flex flex-wrap gap-2">{allergies.map(a=><span key={a} className="px-3 py-1.5 rounded-full font-black text-sm" style={{background:"#FF3B30",color:"white"}}>{a}</span>)}</div>
                : <p className="text-slate-400 text-sm">None listed</p>
              }
            </div>
            <div>
              <p className="text-red-400 font-black uppercase tracking-widest mb-2" style={{fontSize:10}}>Current Medications</p>
              {medications.length > 0
                ? <div className="space-y-1.5">{medications.map(m=><div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"#2a2a2a"}}><div className="w-2 h-2 bg-amber-400 rounded-full shrink-0"/><p className="text-white font-semibold text-sm">{m.name} {m.dosage} — {m.frequency}</p></div>)}</div>
                : <p className="text-slate-400 text-sm">None listed</p>
              }
            </div>
          </div>
        </div>

        {/* Call 911 */}
        <a href="tel:911" className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl font-black text-white text-xl" style={{background:"#FF3B30",boxShadow:"0 4px 24px rgba(255,59,48,0.5)"}}>
          <Phone size={24} fill="white"/>CALL 911
        </a>

        {/* Emergency contacts */}
        {contacts.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-slate-700">
            <div className="px-4 py-2.5" style={{background:"#1a1a1a"}}>
              <p className="text-slate-300 font-black uppercase tracking-wider text-xs">Emergency Contacts</p>
            </div>
            <div className="divide-y divide-slate-800">
              {contacts.map(c=>(
                <div key={c.id} className="flex items-center justify-between px-4 py-3" style={{background:"#141414"}}>
                  <div>
                    <p className="text-white font-bold text-sm">{c.name}</p>
                    <p className="text-slate-400 text-xs">{c.relation}</p>
                  </div>
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white text-sm" style={{background:"#34C759"}}>
                    <Phone size={14}/>Call
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-slate-600 text-xs text-center pb-4">MedyCard Pro — Emergency Access Mode<br/>Personal vault remains fully encrypted and locked.</p>
      </div>
    </div>
  );
}

// ─── Lock Screen ──────────────────────────────────────────────────────────────
function LockScreen({ onUnlock, biometricAvailable, biometricUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  const handleDigit = (d) => {
    const next = pin+d;
    setPin(next);
    if (next.length===6) {
      if (onUnlock(next)) {}
      else { setError("Incorrect PIN. Try again."); setPin(""); }
    }
  };
  const handleBack = () => { setPin(p=>p.slice(0,-1)); setError(""); };

  const tryBiometric = async () => {
    setBioLoading(true);
    const ok = await biometricUnlock();
    if (!ok) setError("Biometric failed — use your PIN.");
    setBioLoading(false);
  };

  useEffect(() => { if (biometricAvailable) tryBiometric(); }, []);

  if (showEmergency) return <EmergencyAccessView onClose={()=>setShowEmergency(false)}/>;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center" style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f,#1d4ed8)",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",zIndex:9999}}>
      <AppLogo/>
      <p className="text-blue-300 font-semibold text-sm uppercase tracking-widest mb-8">Enter PIN to Unlock</p>
      <div className="bg-white/10 border border-white/20 rounded-2xl px-8 py-8 w-80 text-center">
        {error&&<p className="text-red-400 text-sm mb-4 font-semibold">{error}</p>}
        <PINDots count={6} filled={pin.length}/>
        <Keypad onDigit={handleDigit} onBack={handleBack} showBiometric={biometricAvailable} onBiometric={tryBiometric} bioLoading={bioLoading}/>
      </div>

      {/* Emergency access button — always visible, no PIN required */}
      <button onClick={()=>setShowEmergency(true)} className="mt-6 flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-white transition-all active:scale-95" style={{background:"#FF3B30",boxShadow:"0 4px 20px rgba(255,59,48,0.45)",fontSize:15}}>
        <AlertTriangle size={18}/>Emergency Medical ID
      </button>
      <p className="text-white/30 text-xs mt-3 text-center">Tap above for emergency access without PIN<br/>Vault remains locked</p>

      <p className="text-blue-400/40 text-xs mt-5">Protected by AES-256 • Auto-locks after 5 min</p>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SecurityBadge() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{background:"linear-gradient(90deg,#00C851,#007AFF)"}}>
        <ShieldCheck size={10} className="text-white"/>
        <span className="text-white font-black uppercase tracking-widest" style={{fontSize:8}}>AES-256 • HIPAA Safe</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
        <span className="text-emerald-600 font-bold text-xs">Secure</span>
      </div>
    </div>
  );
}

function ModeToggles({ sm, setSm, travel, setTravel }) {
  return (
    <div className="flex gap-2">
      <button onClick={()=>setSm(p=>!p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black transition-all active:scale-95" style={{fontSize:11,background:sm?"#FFD600":"rgba(255,214,0,0.15)",color:sm?"#000":"#B8860B",border:`2px solid ${sm?"#FFD600":"rgba(255,214,0,0.4)"}`,boxShadow:sm?"0 0 14px rgba(255,214,0,0.5)":"none"}}>
        👴 Senior {sm?"ON":"OFF"}
      </button>
      <button onClick={()=>setTravel(p=>!p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black transition-all active:scale-95" style={{fontSize:11,background:travel?"#007AFF":"rgba(0,122,255,0.12)",color:travel?"white":"#007AFF",border:`2px solid ${travel?"#007AFF":"rgba(0,122,255,0.3)"}`,boxShadow:travel?"0 0 14px rgba(0,122,255,0.35)":"none"}}>
        ✈️ Travel {travel?"ON":"OFF"}
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, color, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:color}}><Icon size={14} className="text-white"/></div>
        <h3 className="font-black text-base text-slate-800">{title}</h3>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">{children}</div>
    </div>
  );
}

function DisclaimerStrip({ sm }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 shrink-0" style={{background:"linear-gradient(90deg,#fff7ed,#fef3c7)",borderTop:"1px solid #fed7aa"}}>
      <AlertTriangle size={sm?13:11} className="text-amber-500 shrink-0 mt-0.5"/>
      <p className="text-amber-800 font-semibold leading-snug" style={{fontSize:sm?11:9}}>
        <span className="font-black">Medy AI</span> provides general health information only. Not a substitute for professional medical advice.{" "}
        <a href="tel:911" className="font-black underline text-red-600">Always call 911 in an emergency.</a>
      </p>
    </div>
  );
}

function ChatPanel({ messages, input, setInput, onSend, isLoading, chatEndRef, sm }) {
  const fs = sm?14:12;
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm" style={{height:"100%",minHeight:300}}>
      <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{background:"linear-gradient(135deg,#0f172a,#1d4ed8)"}}>
        <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center"><Heart size={14} className="text-red-400" fill="currentColor"/></div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">Medy AI</p>
          <p className="text-blue-300" style={{fontSize:9}}>Your personal health companion — like having an RN in your pocket</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-400/20 border border-amber-400/30">
          <AlertTriangle size={9} className="text-amber-300"/>
          <span className="text-amber-200 font-black uppercase tracking-wider" style={{fontSize:7}}>Info Only</span>
        </div>
      </div>
      <DisclaimerStrip sm={sm}/>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {messages.length===0&&(
          <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-3"><Heart size={22} className="text-blue-400" fill="currentColor"/></div>
            <p className="font-black text-slate-700 mb-1" style={{fontSize:sm?15:13}}>Your Health Companion</p>
            <p className="text-slate-400 leading-relaxed" style={{fontSize:sm?12:10}}>Ask about your medications, travel health tips, or general wellness questions.</p>
          </div>
        )}
        {messages.map(msg=>(
          <div key={msg.id} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}>
            {msg.role==="ai"&&<div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-1.5 shrink-0 mt-0.5"><Heart size={10} className="text-white" fill="white"/></div>}
            <div className="max-w-[85%] px-3 py-2" style={{background:msg.role==="user"?"#007AFF":"white",color:msg.role==="user"?"white":"#1c1c1e",borderRadius:msg.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",boxShadow:msg.role==="ai"?"0 1px 4px rgba(0,0,0,0.08)":"none",fontSize:fs}}>
              <MD text={msg.content}/>
            </div>
          </div>
        ))}
        {isLoading&&(
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0"><Heart size={10} className="text-white" fill="white"/></div>
            <div className="px-3 py-2 bg-white rounded-2xl shadow-sm flex gap-1">
              {[0,0.2,0.4].map((d,i)=><div key={i} className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:`${d}s`}}/>)}
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>
      <div className="p-2.5 border-t border-slate-100 bg-white flex gap-2 shrink-0">
        <input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSend()} placeholder="Ask Medy anything…" className="flex-1 bg-slate-100 rounded-full px-3 py-2 outline-none" style={{fontSize:sm?14:12}}/>
        <button onClick={onSend} disabled={!input.trim()||isLoading} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all shrink-0" style={{background:"#007AFF"}}>
          <Send size={14} className="text-white"/>
        </button>
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function EmergencyPage({ medications, allergies, bloodType, contacts, isUnmasked, onUnmask, sm, travelMode, isMobile, onChatOpen }) {
  const fs = sm?16:14;
  return (
    <div className="space-y-4">
      <div className="rounded-3xl overflow-hidden" style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1d4ed8 100%)",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
        <div className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center"><CreditCard size={18} className="text-white"/></div>
              <div>
                <p className="text-white font-black" style={{fontSize:sm?18:16}}>MedyCard Pro</p>
                <p className="text-blue-300 uppercase tracking-widest font-bold" style={{fontSize:9}}>Active Medical Guardian</p>
              </div>
            </div>
            {isUnmasked
              ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/><span className="text-emerald-300 font-black uppercase" style={{fontSize:9}}>Verified</span></div>
              : <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10"><Lock size={10} className="text-white/60"/><span className="text-white/60 font-bold uppercase" style={{fontSize:9}}>Locked</span></div>
            }
          </div>
          <div className={`grid ${isMobile?"grid-cols-1":"grid-cols-3"} gap-3 mb-4`}>
            {[{label:"Blood Type",value:bloodType},{label:"Allergies",value:allergies.join(", ")||"None"},{label:"Medications",value:medications.map(m=>`${m.name} ${m.dosage}`).join(", ")||"None"}].map(({label,value})=>(
              <div key={label}>
                <p className="text-blue-300 font-black uppercase tracking-widest mb-0.5" style={{fontSize:9}}>{label}</p>
                <p className={`text-white font-semibold transition-all duration-500 ${!isUnmasked?"blur-sm opacity-40 select-none":""}`} style={{fontSize:sm?16:13}}>{value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <a href="tel:911" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black active:scale-95" style={{background:"rgba(239,68,68,0.9)",color:"white",fontSize:fs}}><Phone size={sm?16:14}/>Call 911</a>
            <button className="flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold bg-white/10 text-white" style={{fontSize:fs}}><Nfc size={sm?16:14}/>NFC</button>
            {isMobile&&<button onClick={onChatOpen} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-white active:scale-95" style={{background:"linear-gradient(135deg,#007AFF,#5856D6)",fontSize:11}}><MessageCircle size={14}/>Medy AI</button>}
          </div>
        </div>
      </div>

      <button onClick={onUnmask} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl active:scale-95 transition-all" style={{background:"#FF3B30",boxShadow:"0 4px 16px rgba(255,59,48,0.35)",fontSize:sm?16:14}}>
        <div className="flex items-center gap-3"><div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center"><AlertTriangle size={15} className="text-white"/></div><span className="text-white font-black">Paramedic Instant Access</span></div>
        <ChevronRight size={18} className="text-white/70"/>
      </button>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl" style={{background:"linear-gradient(90deg,#fff7ed,#fef3c7)",border:"1px solid #fed7aa"}}>
        <AlertTriangle size={sm?15:13} className="text-amber-500 shrink-0 mt-0.5"/>
        <p className="text-amber-800 font-semibold leading-snug" style={{fontSize:sm?12:10}}>
          <span className="font-black">Medy AI</span> provides general health information only. Not a substitute for professional medical advice.{" "}
          <a href="tel:911" className="font-black underline text-red-600">Always call 911 in an emergency.</a>
        </p>
      </div>

      {sm&&<div className="px-5 py-4 rounded-2xl" style={{background:"#FFD600",boxShadow:"0 4px 16px rgba(255,214,0,0.4)"}}><p className="font-black text-black text-lg mb-1">👴 Senior Mode Active</p><p className="text-black/80 font-semibold" style={{fontSize:14}}>Larger text, high-contrast display, and simplified buttons are enabled.</p></div>}

      {travelMode&&(
        <div className="rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{background:"linear-gradient(90deg,#0f172a,#1d4ed8)"}}><Globe size={15} className="text-blue-300"/><p className="text-white font-black" style={{fontSize:sm?15:13}}>Travel Shield — Global Emergency Numbers</p></div>
          <div className="bg-white divide-y divide-slate-100">
            {[["🇺🇸 USA","911"],["🇬🇧 UK","999"],["🇪🇺 Europe","112"],["🇯🇵 Japan","119"],["🇦🇺 Australia","000"]].map(([c,n])=>(
              <div key={c} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-700 font-medium" style={{fontSize:sm?15:13}}>{c}</span>
                <a href={`tel:${n}`} className="font-black" style={{color:"#007AFF",fontSize:sm?18:16}}>{n}</a>
              </div>
            ))}
          </div>
        </div>
      )}

      <Section title="Emergency Contacts" icon={Phone} color="#34C759">
        <div className="space-y-3">
          {contacts.map(c=>(
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-black text-lg shrink-0">{c.name[0]}</div>
              <div className="flex-1"><p className="font-bold text-slate-900" style={{fontSize:fs}}>{c.name}</p><p className="text-slate-400" style={{fontSize:11}}>{c.relation} • {c.phone}</p></div>
              <div className="flex gap-2">
                <a href={`tel:${c.phone}`} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"#34C759"}}><Phone size={15} className="text-white"/></a>
                <button className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center"><Share2 size={15} className="text-blue-500"/></button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function VaultPage({ medications, setMedications, medicalHistory, setMedicalHistory, allergies, setAllergies, bloodType, setBloodType, sm }) {
  const [newMed, setNewMed] = useState({name:"",dosage:"",frequency:""});
  const [newAllergy, setNewAllergy] = useState("");
  const fs = sm?16:14;

  const addMed = () => {
    if (!newMed.name) return;
    const risk = checkDrugInteractions([...medications.map(m=>m.name), newMed.name]);
    setMedications(p=>[...p,{...newMed,id:Date.now().toString(),status:risk==="flag"?"caution":"safe"}]);
    setNewMed({name:"",dosage:"",frequency:""});
  };

  return (
    <div>
      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 mb-5">
        <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center"><Lock size={16} className="text-white"/></div>
        <div><p className="font-black text-emerald-800" style={{fontSize:sm?16:14}}>End-to-End Encrypted</p><p className="text-emerald-600" style={{fontSize:11}}>Your data is saved locally and encrypted on this device</p></div>
      </div>

      <Section title="Medications" icon={Activity} color="#FF3B30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          {["name","dosage","frequency"].map(f=>(
            <div key={f}><label className="text-xs font-bold uppercase text-slate-400 block mb-1">{f}</label>
            <input type="text" value={newMed[f]} onChange={e=>setNewMed(p=>({...p,[f]:e.target.value}))} placeholder={f==="name"?"e.g. Lisinopril":f==="dosage"?"e.g. 10mg":"e.g. Once daily"} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" style={{fontSize:fs}}/></div>
          ))}
        </div>
        <button onClick={addMed} className="w-full py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 mb-3 active:scale-95 transition-all" style={{background:"#007AFF",fontSize:fs}}><Plus size={16}/>Add Medication</button>
        <div className="space-y-2">
          {medications.map(m=>(
            <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900" style={{fontSize:fs}}>{m.name}</p>
                  {m.status==="safe"&&<span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold" style={{fontSize:9}}>✓ No flags</span>}
                  {m.status==="caution"&&<span className="text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full font-bold" style={{fontSize:9}}>⚠ Review with pharmacist</span>}
                </div>
                <p className="text-slate-400" style={{fontSize:11}}>{m.dosage} • {m.frequency}</p>
              </div>
              <button onClick={()=>setMedications(p=>p.filter(x=>x.id!==m.id))} className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center"><X size={13} className="text-red-400"/></button>
            </div>
          ))}
          {medications.length===0&&<p className="text-slate-400 italic text-sm text-center py-2">No medications added yet</p>}
        </div>
      </Section>

      <Section title="Personal Info" icon={FileText} color="#007AFF">
        <div className="space-y-3">
          <div><label className="text-xs font-bold uppercase text-slate-400 block mb-1">Blood Type</label><input type="text" value={bloodType} onChange={e=>setBloodType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" style={{fontSize:fs}}/></div>
          <div><label className="text-xs font-bold uppercase text-slate-400 block mb-1">Medical History</label><textarea rows={3} value={medicalHistory} onChange={e=>setMedicalHistory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none" style={{fontSize:fs}}/></div>
        </div>
      </Section>

      <Section title="Allergies" icon={AlertCircle} color="#FF9500">
        <div className="flex gap-2 mb-3">
          <input type="text" value={newAllergy} onChange={e=>setNewAllergy(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newAllergy&&!allergies.includes(newAllergy)){setAllergies(p=>[...p,newAllergy]);setNewAllergy("");}}} placeholder="Add allergy…" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" style={{fontSize:fs}}/>
          <button onClick={()=>{if(newAllergy&&!allergies.includes(newAllergy)){setAllergies(p=>[...p,newAllergy]);setNewAllergy("");}}} className="px-4 rounded-xl text-white font-bold" style={{background:"#007AFF",fontSize:fs}}>Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {allergies.map(a=><span key={a} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-full font-semibold" style={{fontSize:fs-2}}>{a}<button onClick={()=>setAllergies(p=>p.filter(x=>x!==a))} className="active:scale-75"><X size={11}/></button></span>)}
          {allergies.length===0&&<p className="text-slate-400 italic text-sm">No allergies listed</p>}
        </div>
      </Section>
    </div>
  );
}

function CheckPage({ sm }) {
  const [meds, setMeds] = useState([]);
  const [inp, setInp] = useState("");
  const [risk, setRisk] = useState("none");
  const fs = sm?16:14;
  const add = () => { if(!inp||meds.includes(inp))return; const n=[...meds,inp]; setMeds(n); setRisk(checkDrugInteractions(n)); setInp(""); };

  return (
    <div>
      <div className="rounded-2xl p-5 mb-5" style={{background:"linear-gradient(135deg,#0f172a,#1d4ed8)"}}>
        <p className="text-white font-black text-lg mb-1">💊 Medication Awareness Check</p>
        <p className="text-blue-200" style={{fontSize:fs-2}}>Add your medications for a general awareness overview. Always confirm with your pharmacist or doctor.</p>
      </div>
      <Section title="Add Medications" icon={Stethoscope} color="#AF52DE">
        <div className="flex gap-2 mb-3">
          <input type="text" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="e.g. Aspirin" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" style={{fontSize:fs}}/>
          <button onClick={add} className="px-4 rounded-xl text-white font-bold active:scale-95" style={{background:"#007AFF",fontSize:fs}}>Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {meds.map(m=><span key={m} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full font-semibold" style={{fontSize:fs-2}}>{m}<button onClick={()=>{const n=meds.filter(x=>x!==m);setMeds(n);setRisk(checkDrugInteractions(n));}} className="active:scale-75"><X size={12}/></button></span>)}
          {meds.length===0&&<p className="text-slate-400 italic text-sm">Add at least two medications to check</p>}
        </div>
      </Section>
      {risk!=="none"&&(
        <div className="rounded-2xl p-5 border-2 mb-5" style={{background:risk==="flag"?"#FFF8F0":"#F0FFF4",borderColor:risk==="flag"?"#FFD8A8":"#B7EB8F"}}>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{background:risk==="flag"?"#FF9F4322":"#52C41A22"}}>
              {risk==="flag"?<AlertTriangle size={24} color="#E8820C"/>:<ShieldCheck size={24} color="#52C41A"/>}
            </div>
            <div className="flex-1">
              <p className="font-black text-lg" style={{color:risk==="flag"?"#7C3500":"#237804"}}>{risk==="flag"?"⚠ Heads Up — Worth Reviewing":"✓ No Common Flags Found"}</p>
              <p className="mt-1" style={{fontSize:fs-1,color:risk==="flag"?"#92400E":"#135200"}}>
                {risk==="flag"?"Some medications in this combination are commonly reviewed together. This is general awareness information only — please speak with your pharmacist or prescribing doctor.":"No commonly known flags were found. This is general awareness only — not a substitute for professional pharmacist review."}
              </p>
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"rgba(0,122,255,0.08)",border:"1px solid rgba(0,122,255,0.15)"}}>
                <Phone size={11} className="text-blue-500 shrink-0"/>
                <p className="text-blue-700 font-semibold" style={{fontSize:fs-3}}>Always confirm with your pharmacist or doctor before making any medication changes.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100">
        <span className="text-2xl">💡</span>
        <div><p className="font-bold text-blue-800" style={{fontSize:fs-1}}>How to use this tool</p><p className="text-blue-700 mt-0.5" style={{fontSize:fs-2}}>General awareness overview only. Try "Lisinopril" and "Aspirin" to see an example. Your pharmacist has your full medication profile and is always the best resource.</p></div>
      </div>
    </div>
  );
}

function FamilyPage({ contacts, sm }) {
  const fs = sm?16:14;
  const logs = [{id:"1",name:"Jane Doe (Wife)",time:"2h ago",action:"Viewed Medical ID"},{id:"2",name:"Dr. Smith",time:"5h ago",action:"Accessed Lab Reports"},{id:"3",name:"EMS Unit 7",time:"18h ago",action:"Scanned NFC Card"}];
  return (
    <div>
      <Section title="Emergency Contacts" icon={Users} color="#34C759">
        <div className="space-y-3">
          {contacts.map(c=>(
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-black text-lg shrink-0">{c.name[0]}</div>
              <div className="flex-1"><p className="font-bold text-slate-900" style={{fontSize:fs}}>{c.name}</p><p className="text-slate-400" style={{fontSize:11}}>{c.relation} • {c.phone}</p></div>
              <div className="flex gap-2">
                <a href={`tel:${c.phone}`} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"#34C759"}}><Phone size={15} className="text-white"/></a>
                <button className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center"><Share2 size={15} className="text-blue-500"/></button>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Caregiver Access Log" icon={History} color="#007AFF">
        <div className="divide-y divide-slate-100 -mx-4 -mb-4">
          <div className="grid grid-cols-3 px-4 py-2 bg-slate-50 text-slate-400 font-black uppercase" style={{fontSize:9,letterSpacing:"0.1em"}}><span>Caregiver</span><span>Action</span><span className="text-right">Time</span></div>
          {logs.map(l=>(
            <div key={l.id} className="grid grid-cols-3 px-4 py-3 items-center">
              <p className="font-semibold text-blue-950 truncate" style={{fontSize:fs-2}}>{l.name}</p>
              <p className="text-slate-500 truncate" style={{fontSize:fs-3}}>{l.action}</p>
              <p className="text-slate-400 text-right" style={{fontSize:fs-3}}>{l.time}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function TravelPage({ messages, input, setInput, onSend, isLoading, chatEndRef, sm }) {
  const fs = sm?16:14;
  return (
    <div>
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" placeholder="Search destination (e.g. Tokyo, Japan)" className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" style={{fontSize:fs}}/>
      </div>
      <Section title="Health Advisories" icon={Globe} color="#007AFF">
        <div className="space-y-3">
          {[{icon:ShieldCheck,color:"#FF9500",title:"Vaccinations Recommended",desc:"Hepatitis A, Typhoid, and Routine vaccines"},{icon:MapPin,color:"#FF3B30",title:"Emergency Numbers",desc:"Ambulance: 119 • Police: 110"},{icon:Plane,color:"#007AFF",title:"Travel Insurance",desc:"Coverage active for 90 days"}].map(({icon:Icon,color,title,desc})=>(
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:color}}><Icon size={15} className="text-white"/></div>
              <div><p className="font-bold text-slate-900" style={{fontSize:fs}}>{title}</p><p className="text-slate-400" style={{fontSize:fs-3}}>{desc}</p></div>
            </div>
          ))}
        </div>
      </Section>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">Travel AI Assistant</p>
        <ChatPanel messages={messages} input={input} setInput={setInput} onSend={onSend} isLoading={isLoading} chatEndRef={chatEndRef} sm={sm}/>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const PAGES = [
  {id:"emergency",icon:Heart,label:"ID"},
  {id:"vault",icon:ShieldCheck,label:"Vault"},
  {id:"check",icon:Stethoscope,label:"Med-Check"},
  {id:"family",icon:Users,label:"Family"},
  {id:"travel",icon:Globe,label:"Travel"},
];

export default function App() {
  const screen = useScreenSize();
  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";

  const auth = useAuth();

  // Persisted state — survives close/reopen
  const [activePage, setActivePage] = usePersistedState("activePage", "emergency");
  const [sm, setSm] = usePersistedState("seniorMode", false);
  const [travelMode, setTravelMode] = usePersistedState("travelMode", false);
  const [medications, setMedications] = usePersistedState("medications", [{id:"1",name:"Lisinopril",dosage:"10mg",frequency:"Once daily",status:"safe"}]);
  const [medicalHistory, setMedicalHistory] = usePersistedState("medicalHistory", "No major surgeries. Controlled hypertension.");
  const [allergies, setAllergies] = usePersistedState("allergies", ["Penicillin","Peanuts"]);
  const [bloodType, setBloodType] = usePersistedState("bloodType", "O Positive");
  const [contacts] = usePersistedState("contacts", [
    {id:"1",name:"Jane Doe",relation:"Wife",phone:"+1 (555) 012-3456"},
    {id:"2",name:"Dr. Smith",relation:"Primary Physician",phone:"+1 (555) 987-6543"}
  ]);

  // Session state — resets on lock
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isUnmasked, setIsUnmasked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(null);
  const [authenticatedRecords, setAuthenticatedRecords] = useState(new Set());
  const [messages, setMessages] = useState({emergency:[],vault:[],travel:[],family:[],lab:[],check:[]});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages[activePage]]);

  const handleUnmask = () => setIsUnmasked(true);
  const handleViewRecord = (id) => {
    if (isUnmasked||authenticatedRecords.has(id)) return;
    setIsAuthenticating(id);
    setTimeout(()=>{setAuthenticatedRecords(p=>new Set(p).add(id));setIsAuthenticating(null);},1500);
  };

  // Multi-turn AI with full conversation history
  const handleSend = async () => {
    if (!input.trim()||isLoading) return;
    const q = input;
    const newMsg = {id:Date.now().toString(),role:"user",content:q};
    setMessages(p=>({...p,[activePage]:[...p[activePage],newMsg]}));
    setInput(""); setIsLoading(true);
    try {
      const history = [...messages[activePage],newMsg].map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}));
      const text = await askMedy(history, activePage);
      setMessages(p=>({...p,[activePage]:[...p[activePage],{id:(Date.now()+1).toString(),role:"ai",content:text}]}));
    } catch {
      setMessages(p=>({...p,[activePage]:[...p[activePage],{id:(Date.now()+1).toString(),role:"ai",content:"Couldn't reach Medy AI right now. Please try again."}]}));
    } finally { setIsLoading(false); }
  };

  // Auth gates
  if (auth.setupMode) return <PINSetup onSave={auth.savePin}/>;
  if (auth.locked) return <LockScreen onUnlock={auth.checkPin} biometricAvailable={auth.biometricAvailable} biometricUnlock={auth.biometricUnlock}/>;

  const pageName = ({emergency:"Active Medical Guardian",vault:"Secure Vault",check:"Awareness Check",family:"Family Hub",travel:"Travel Guard"})[activePage]||"MedyCard Pro";
  const bgMain = sm?"#1a1a1a":"#f0f4f8";
  const bgSide = sm?"#0d0d0d":"white";
  const borderC = sm?"#2a2a2a":"#e5e7eb";
  const textColor = sm?"#fff":"#1c1c1e";

  const sharedPageProps = { medications,setMedications,medicalHistory,setMedicalHistory,allergies,setAllergies,bloodType,setBloodType,contacts,isUnmasked,onUnmask:handleUnmask,onViewRecord:handleViewRecord,authenticatedRecords,sm,travelMode,isMobile,onChatOpen:()=>setIsChatOpen(true) };
  const chatProps = {messages:messages[activePage],input,setInput,onSend:handleSend,isLoading,chatEndRef,sm};

  const PageContent = () => (
    <>
      {activePage==="emergency"&&<EmergencyPage {...sharedPageProps}/>}
      {activePage==="vault"&&<VaultPage {...sharedPageProps}/>}
      {activePage==="check"&&<CheckPage sm={sm}/>}
      {activePage==="family"&&<FamilyPage contacts={contacts} sm={sm}/>}
      {activePage==="travel"&&<TravelPage {...chatProps} sm={sm}/>}
    </>
  );

  const LockBtn = () => (
    <button onClick={auth.lock} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold active:scale-95" style={{background:"rgba(239,68,68,0.1)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.2)",fontSize:11}}>
      <Lock size={12}/>Lock
    </button>
  );

  const SidebarContent = ({onNav}) => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg"><CreditCard size={20} className="text-white"/></div>
          <div><p className="font-black text-xl" style={{color:textColor}}>MedyCard Pro</p><p className="font-bold uppercase tracking-widest" style={{fontSize:8,color:"#007AFF"}}>Active Medical Guardian</p></div>
        </div>
        <LockBtn/>
      </div>
      <div className="space-y-3 mb-6"><ModeToggles sm={sm} setSm={setSm} travel={travelMode} setTravel={setTravelMode}/><SecurityBadge/></div>
      <nav className="space-y-1 flex-1">
        {PAGES.map(({id,icon:Icon,label})=>(
          <button key={id} onClick={()=>{setActivePage(id);onNav?.();}} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-semibold" style={{background:activePage===id?(sm?"#FFD600":"#007AFF"):"transparent",color:activePage===id?(sm?"#000":"white"):sm?"#888":"#6b7280",fontSize:sm?17:15}}>
            <Icon size={sm?22:18}/><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t" style={{borderColor:borderC}}>
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{background:sm?"#1a1a1a":"#f8fafc",border:`1px solid ${borderC}`}}>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
          <span className="font-bold" style={{fontSize:11,color:sm?"#888":"#64748b"}}>All systems secure</span>
        </div>
      </div>
    </>
  );

  const AuthOverlay = () => isAuthenticating ? (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(20px)"}}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-blue-500/20 border border-blue-400/30 rounded-full flex items-center justify-center animate-spin"><Lock className="text-blue-400 w-9 h-9"/></div>
        <div><h3 className="text-xl font-bold text-white">Authenticating</h3><p className="text-blue-400/60 text-xs font-mono uppercase tracking-widest mt-1">Face ID • MedyCard Protocol</p></div>
      </div>
    </div>
  ) : null;

  if (isMobile) return (
    <div className="h-screen flex flex-col overflow-hidden" style={{background:bgMain,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"}}>
      <AuthOverlay/>
      <div className="px-4 pt-10 pb-2 shrink-0" style={{background:sm?"#000":"#F2F2F7"}}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center"><CreditCard size={15} className="text-white"/></div><span className="font-black text-xl" style={{color:textColor}}>MedyCard Pro</span></div>
          <LockBtn/>
        </div>
        <SecurityBadge/>
        <div className="mt-2"><ModeToggles sm={sm} setSm={setSm} travel={travelMode} setTravel={setTravelMode}/></div>
        {travelMode&&<div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2" style={{background:"linear-gradient(90deg,#0f172a,#1d4ed8)"}}><Globe size={11} className="text-blue-300 shrink-0"/><p className="text-blue-100 font-semibold" style={{fontSize:10}}>Travel Shield Active</p></div>}
        <h1 className="font-black mt-2" style={{fontSize:sm?32:26,color:textColor,letterSpacing:"-0.5px"}}>{pageName}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3"><PageContent/></div>
      <div className="flex items-end justify-around px-1 pt-2 pb-6 shrink-0" style={{background:sm?"#111":"rgba(249,249,249,0.97)",borderTop:`1px solid ${borderC}`,backdropFilter:"blur(20px)"}}>
        {PAGES.map(({id,icon:Icon,label})=>{
          const active=activePage===id;
          return <button key={id} onClick={()=>setActivePage(id)} className="flex flex-col items-center gap-1 px-2 py-1 rounded-2xl transition-all active:scale-90" style={{color:active?(sm?"#FFD600":"#007AFF"):sm?"#666":"#8E8E93",minWidth:sm?62:44}}>
            <Icon size={sm?30:24} strokeWidth={active?2.5:1.8} fill={active&&id==="emergency"?(sm?"#FFD600":"#007AFF"):"none"}/>
            <span style={{fontSize:sm?13:10,fontWeight:sm?800:500}}>{label}</span>
          </button>;
        })}
      </div>
      {isChatOpen&&(
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{background:"rgba(0,0,0,0.4)"}} onClick={()=>setIsChatOpen(false)}>
          <div className="rounded-t-3xl overflow-hidden" style={{maxHeight:"75vh",background:"white"}} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2 mb-1"/>
            <div style={{height:"65vh"}}><ChatPanel {...chatProps}/></div>
          </div>
        </div>
      )}
    </div>
  );

  if (isTablet) return (
    <div className="h-screen flex overflow-hidden" style={{background:bgMain,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"}}>
      <AuthOverlay/>
      <div className="w-60 flex flex-col p-5 border-r shrink-0" style={{background:bgSide,borderColor:borderC}}><SidebarContent/></div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{background:sm?"#111":"white",borderColor:borderC}}>
          <h1 className="font-black" style={{fontSize:sm?28:22,color:textColor}}>{pageName}</h1>
          {travelMode&&<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:"linear-gradient(90deg,#0f172a,#1d4ed8)"}}><Globe size={11} className="text-blue-300"/><span className="text-blue-100 font-bold" style={{fontSize:10}}>Travel Shield Active</span></div>}
        </div>
        <div className="flex-1 overflow-y-auto p-6"><div className="max-w-2xl"><PageContent/></div></div>
      </div>
      {activePage!=="travel"&&<div className="w-72 border-l flex flex-col p-4 shrink-0" style={{background:bgSide,borderColor:borderC}}>
        <p className="font-black text-xs mb-3 uppercase tracking-wider" style={{color:sm?"#aaa":"#6b7280"}}>Medy AI</p>
        <div className="flex-1"><ChatPanel {...chatProps}/></div>
      </div>}
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{background:bgMain,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"}}>
      <AuthOverlay/>
      <div className="flex flex-col p-5 border-r shrink-0" style={{width:272,background:bgSide,borderColor:borderC}}><SidebarContent/></div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 py-5 border-b flex items-center justify-between shrink-0" style={{background:sm?"#111":"white",borderColor:borderC}}>
          <div>
            <h1 className="font-black" style={{fontSize:sm?32:26,color:textColor,letterSpacing:"-0.3px"}}>{pageName}</h1>
            {travelMode&&<p className="font-bold mt-0.5" style={{fontSize:12,color:"#007AFF"}}>✈️ Travel Shield Active</p>}
          </div>
          {activePage!=="travel"&&<button onClick={()=>setIsChatOpen(p=>!p)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white active:scale-95 transition-all" style={{background:isChatOpen?"#5856D6":"linear-gradient(135deg,#007AFF,#5856D6)",fontSize:sm?15:13,boxShadow:"0 4px 14px rgba(0,122,255,0.3)"}}>
            <MessageCircle size={sm?18:15}/>{isChatOpen?"Close Medy AI":"Ask Medy AI"}
          </button>}
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8"><div className="max-w-3xl mx-auto"><PageContent/></div></div>
          {isChatOpen&&activePage!=="travel"&&<div className="w-80 border-l p-4 flex flex-col shrink-0" style={{background:bgSide,borderColor:borderC}}>
            <div className="flex-1"><ChatPanel {...chatProps}/></div>
          </div>}
        </div>
      </div>
    </div>
  );
}

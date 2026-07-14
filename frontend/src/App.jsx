import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Database,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Gauge,
  History,
  Import,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Pause,
  Play,
  PlugZap,
  QrCode,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  TerminalSquare,
  Upload,
  Users,
  Wand2,
  Wifi,
  WifiOff,
  X,
  Zap
} from "lucide-react";
import { api, setToken } from "./lib/api.js";
import { createRealtimeSocket } from "./lib/socket.js";

const TOKEN_KEY = "winc_token";
const USER_KEY = "winc_user";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "disparos", label: "Disparos", icon: Send },
  { id: "facebook", label: "Facebook Groups", icon: Users },
  { id: "historico", label: "Historico", icon: History },
  { id: "conexoes", label: "Conexoes", icon: PlugZap },
  { id: "config", label: "Configuracoes", icon: Settings }
];

const variables = ["{nome}", "{campo1}", "{campo2}", "{vencimento}", "{plano}"];

const starterMessage =
  "Ola {nome}, tudo certo? Seu plano {plano} vence em {vencimento}. Posso te ajudar com a renovacao? 😊";

const seedNumbers = [
  "+5511991111001;Ana Costa;VIP;Renovacao;20/05/2026;Premium",
  "+5511991111002;Bruno Lima;Lead quente;Segmento A;21/05/2026;Pro",
  "+5511991111003;Carla Mendes;Cliente;Segmento B;22/05/2026;Start"
].join("\n");

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatNumber(value = 0) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasHeader = /phone|telefone|numero/i.test(lines[0] || "");
  const data = hasHeader ? lines.slice(1) : lines;
  return data
    .map((line) => line.split(/[,;]/).map((part) => part.trim()))
    .filter((cols) => cols[0])
    .map((cols) => [cols[0], cols[1] || "", cols[2] || "", cols[3] || "", cols[4] || "", cols[5] || ""].join(";"))
    .join("\n");
}

function playTone(type = "success") {
  const enabled = localStorage.getItem("winc_sound") !== "off";
  if (!enabled) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = type === "error" ? 190 : 620;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
}

function NeonLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="logo-mark">
        <Zap size={compact ? 18 : 22} />
      </div>
      {!compact && (
        <div>
          <div className="neon-title text-lg leading-none">DISPARO WINC</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-mint/50">Nexus Broadcast OS</div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status = "offline", label }) {
  const positive = ["online", "running", "completed", "sent", "success"].includes(status);
  const pending = ["qr_pending", "connecting", "paused", "pending", "draft"].includes(status);
  const danger = ["failed", "cancelled", "error"].includes(status);

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]",
        positive && "border-neon/40 bg-neon/10 text-neon",
        pending && "border-amber/40 bg-amber/10 text-amber",
        danger && "border-danger/40 bg-danger/10 text-danger",
        !positive && !pending && !danger && "border-white/10 bg-white/5 text-white/50"
      )}
    >
      <span className={classNames("h-2 w-2 rounded-full", positive ? "bg-neon shadow-[0_0_12px_#27ff88]" : pending ? "bg-amber" : danger ? "bg-danger" : "bg-white/30")} />
      {label || status}
    </span>
  );
}

function CyberLoader({ label = "Sincronizando" }) {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-mint/70">
      <Loader2 className="animate-spin text-neon" size={18} />
      {label}
    </div>
  );
}

function ToastStack({ toasts, dismiss }) {
  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            className={classNames("toast", toast.type === "error" && "toast-error", toast.type === "success" && "toast-success")}
          >
            <div className="flex items-start gap-3">
              {toast.type === "error" ? <AlertTriangle size={18} /> : <Bell size={18} />}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-sm text-white/58">{toast.message}</p>}
              </div>
              <button className="icon-button h-8 w-8" onClick={() => dismiss(toast.id)} aria-label="Fechar toast">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function LoginScreen({ onLogin, busy }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="login-grid min-h-screen overflow-hidden bg-void text-white">
      <div className="cyber-grid" />
      <section className="relative z-10 grid min-h-screen items-center px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-neon">
            <CircleDot size={14} />
            Sistema SaaS de campanhas em tempo real
          </div>
          <h1 className="neon-hero text-5xl font-black leading-[0.92] sm:text-7xl xl:text-8xl">
            DISPARO WINC
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-mint/68">
            Automacao profissional com validacao, filas, QR Code, modo seguro, logs vivos e uma central de disparos feita para operacoes modernas.
          </p>
          <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              ["Realtime", Radio],
              ["JWT Secure", ShieldCheck],
              ["Queue Core", Layers3]
            ].map(([label, Icon]) => (
              <div className="neon-card p-4" key={label}>
                <Icon className="text-neon" size={22} />
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="neon-card relative mx-auto mt-10 w-full max-w-md p-6 lg:mt-0"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(email, password);
          }}
        >
          <div className="scanline" />
          <NeonLogo />
          <div className="mt-8 space-y-4">
            <label className="field-label">
              Email
              <input className="winc-input mt-2" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>
            <label className="field-label">
              Senha
              <input className="winc-input mt-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
          </div>
          <button className="neon-button mt-6 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
            Entrar no painel
          </button>
          <div className="mt-5 rounded-lg border border-neon/10 bg-black/24 p-4 font-mono text-xs text-mint/52">
            <p>Use credenciais definidas no ambiente do backend.</p>
            <p>Em desenvolvimento, a senha temporária aparece no terminal.</p>
          </div>
        </motion.form>
      </section>
    </main>
  );
}

function Sidebar({ active, setActive, collapsed, setCollapsed, onLogout }) {
  return (
    <aside className={classNames("sidebar", collapsed && "sidebar-collapsed")}>
      <div className="flex items-center justify-between gap-2 px-3 py-4">
        <NeonLogo compact={collapsed} />
        <button className="icon-button hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher sidebar">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="mt-4 space-y-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={classNames("nav-item", active === item.id && "nav-item-active", collapsed && "justify-center")}
              onClick={() => setActive(item.id)}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pb-4">
        <button className={classNames("nav-item text-white/52", collapsed && "justify-center")} onClick={onLogout}>
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ active, user, session, mobileOpen, setMobileOpen }) {
  const label = navItems.find((item) => item.id === active)?.label || "Dashboard";
  return (
    <header className="sticky top-0 z-30 border-b border-neon/10 bg-void/75 backdrop-blur-2xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button className="icon-button lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menu">
            <Menu size={19} />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neon/60">Painel operacional</p>
            <h2 className="text-xl font-black text-white">{label}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={session?.status || "offline"} label={session?.status === "online" ? "online" : "offline"} />
          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 sm:block">
            {user?.name || "Operador"}
          </div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({ label, value, icon: Icon, tone = "neon", sub }) {
  return (
    <motion.article whileHover={{ y: -4 }} className="neon-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">{label}</p>
          <p className="mt-3 text-3xl font-black text-white">{formatNumber(value)}</p>
          {sub && <p className="mt-2 text-sm text-mint/52">{sub}</p>}
        </div>
        <div className={classNames("metric-icon", tone === "danger" && "metric-danger", tone === "amber" && "metric-amber")}>
          <Icon size={22} />
        </div>
      </div>
    </motion.article>
  );
}

function Dashboard({ stats, session, campaigns, setActive }) {
  const recent = stats?.recent?.length ? stats.recent : campaigns.slice(0, 6);
  const deliveryRate = stats?.sent ? Math.round((stats.sent / Math.max(1, stats.sent + stats.failed)) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enviados" value={stats?.sent} icon={CheckCircle2} sub={`${deliveryRate}% de entrega simulada`} />
        <MetricCard label="Falhados" value={stats?.failed} icon={AlertTriangle} tone="danger" sub="monitorado pela fila" />
        <MetricCard label="Aguardando" value={stats?.pending} icon={Clock3} tone="amber" sub="em fila ativa" />
        <MetricCard label="Contatos" value={stats?.contacts} icon={Users} sub="base importada" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="neon-card overflow-hidden p-0">
          <div className="border-b border-neon/10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Command center</p>
                <h3 className="mt-2 text-2xl font-black text-white">Operacao de disparos em massa</h3>
              </div>
              <button className="neon-button" onClick={() => setActive("disparos")}>
                <Rocket size={18} />
                Nova campanha
              </button>
            </div>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            {[
              ["Modo seguro", "Delays, janela silenciosa e opt-in antes de volume.", ShieldCheck],
              ["Validacao", "Deduplicacao e leitura de variaveis dinamicas.", ClipboardCheck],
              ["Tempo real", "Socket.io entrega logs, status e progresso vivos.", Activity]
            ].map(([title, text, Icon]) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4" key={title}>
                <Icon className="text-neon" size={22} />
                <h4 className="mt-4 font-black text-white">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-white/52">{text}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-neon/10 p-5">
            <div className="h-28 rounded-lg border border-neon/10 bg-black/25 p-4">
              <div className="flex h-full items-end gap-2">
                {[32, 48, 28, 68, 54, 78, 44, 90, 62, 72, 58, 86].map((height, index) => (
                  <div key={index} className="chart-bar" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="neon-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">WhatsApp</p>
                <h3 className="mt-2 text-xl font-black text-white">{session?.provider === "official" ? "API Oficial" : "WPP Connect"}</h3>
              </div>
              {session?.status === "online" ? <Wifi className="text-neon" /> : <WifiOff className="text-white/32" />}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <span className="text-sm text-white/52">Status da sessao</span>
              <StatusPill status={session?.status || "offline"} />
            </div>
          </div>

          <div className="neon-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Campanhas recentes</p>
            <div className="mt-4 space-y-3">
              {recent.length ? (
                recent.map((campaign) => (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3" key={campaign.id}>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{campaign.name}</p>
                      <p className="text-xs text-white/42">{campaign.status}</p>
                    </div>
                    <span className="font-mono text-sm text-neon">{campaign.sent}/{campaign.total}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/42">Nenhuma campanha ainda.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProviderToggle({ value, onChange }) {
  return (
    <div className="segmented">
      <button className={classNames(value === "wppconnect" && "active")} onClick={() => onChange("wppconnect")} type="button">
        <Bot size={16} />
        WPP Connect
      </button>
      <button className={classNames(value === "official" && "active")} onClick={() => onChange("official")} type="button">
        <ShieldCheck size={16} />
        API Oficial
      </button>
    </div>
  );
}

function CampaignBuilder({ session, campaigns, currentCampaign, setCurrentCampaign, logs, refreshAll, notify }) {
  const [form, setForm] = useState({
    name: "Campanha Nexus",
    provider: "wppconnect",
    numbers: seedNumbers,
    message: starterMessage,
    delayMin: 8,
    delayMax: 22,
    safeMode: true,
    warmupMode: true,
    attachments: []
  });
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);

  const progress = currentCampaign?.progress || 0;
  const campaignId = currentCampaign?.id;

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = async () => {
    setBusy(true);
    try {
      const result = await api.post("/contacts/validate", { text: form.numbers });
      setValidation(result);
      notify("Validacao concluida", `${result.valid.length} validos, ${result.invalid.length} invalidos, ${result.duplicates.length} duplicados.`, "success");
    } catch (error) {
      notify("Falha na validacao", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const createCampaign = async (startNow = false) => {
    setBusy(true);
    try {
      const { campaign } = await api.post("/campaigns", {
        ...form,
        delayMin: Number(form.delayMin),
        delayMax: Number(form.delayMax)
      });
      setCurrentCampaign(campaign);
      notify("Campanha criada", `${campaign.total} destinatarios preparados.`, "success");

      if (startNow) {
        const started = await api.post(`/campaigns/${campaign.id}/start`);
        setCurrentCampaign(started.campaign);
      }

      await refreshAll();
    } catch (error) {
      notify("Erro ao criar campanha", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const controlCampaign = async (action) => {
    if (!campaignId) return;
    setBusy(true);
    try {
      const { campaign } = await api.post(`/campaigns/${campaignId}/${action}`);
      setCurrentCampaign(campaign);
      await refreshAll();
    } catch (error) {
      notify("Comando nao executado", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    update("numbers", parsed);
    notify("CSV carregado", `${parsed.split(/\r?\n/).filter(Boolean).length} linhas importadas.`, "success");
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const data = new FormData();
    files.forEach((file) => data.append("files", file));

    try {
      const result = await api.upload("/uploads", data);
      update("attachments", [...form.attachments, ...result.files]);
      notify("Arquivos anexados", `${result.files.length} arquivo(s) pronto(s).`, "success");
    } catch (error) {
      notify("Upload recusado", error.message, "error");
    }
  };

  const importContacts = async () => {
    try {
      const { contacts } = await api.get("/contacts");
      const lines = contacts.map((item) => [item.phone, item.name, item.field1, item.field2, item.vencimento, item.plano].join(";"));
      update("numbers", lines.join("\n") || form.numbers);
      notify("Contatos importados", `${contacts.length} contatos carregados da base.`, "success");
    } catch (error) {
      notify("Erro ao importar contatos", error.message, "error");
    }
  };

  const importGroups = async () => {
    try {
      const { groups } = await api.get("/whatsapp/groups");
      const lines = groups.map((group, index) => `+55119888${String(index + 1000).padStart(4, "0")};${group.name};Grupo;${group.size};25/05/2026;Winc`);
      update("numbers", `${form.numbers}\n${lines.join("\n")}`.trim());
      notify("Grupos importados", `${groups.length} grupos adicionados como amostras operacionais.`, "success");
    } catch (error) {
      notify("Erro ao importar grupos", error.message, "error");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.82fr]">
      <section className="neon-card p-5">
        <div className="flex flex-col gap-4 border-b border-neon/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Area de disparos</p>
            <h3 className="mt-2 text-2xl font-black text-white">Campanha em massa personalizada</h3>
          </div>
          <ProviderToggle value={form.provider} onChange={(value) => update("provider", value)} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="field-label">
            Nome da campanha
            <input className="winc-input mt-2" value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              Delay min.
              <input className="winc-input mt-2" type="number" min="1" value={form.delayMin} onChange={(event) => update("delayMin", event.target.value)} />
            </label>
            <label className="field-label">
              Delay max.
              <input className="winc-input mt-2" type="number" min="1" value={form.delayMax} onChange={(event) => update("delayMax", event.target.value)} />
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
          <label className="field-label">
            Multiplos numeros
            <textarea
              className="winc-input mt-2 min-h-[220px] font-mono text-sm"
              value={form.numbers}
              onChange={(event) => update("numbers", event.target.value)}
              placeholder="+5511999999999;Nome;Campo1;Campo2;Vencimento;Plano"
            />
          </label>
          <div className="space-y-3">
            <button className="ghost-button w-full justify-start" onClick={validate} disabled={busy} type="button">
              <ClipboardCheck size={18} />
              VALIDAR numeros
            </button>
            <label className="ghost-button w-full cursor-pointer justify-start">
              <Upload size={18} />
              Upload CSV
              <input className="hidden" type="file" accept=".csv,text/csv" onChange={handleCsv} />
            </label>
            <button className="ghost-button w-full justify-start" onClick={importContacts} type="button">
              <Import size={18} />
              Importar contatos
            </button>
            <button className="ghost-button w-full justify-start" onClick={importGroups} type="button">
              <Users size={18} />
              Importar grupos
            </button>
            {validation && (
              <div className="rounded-lg border border-neon/10 bg-black/25 p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-black text-neon">{validation.valid.length}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">validos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-danger">{validation.invalid.length}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">invalidos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-amber">{validation.duplicates.length}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">duplicados</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap gap-2">
            {variables.map((item) => (
              <button
                className="variable-chip"
                key={item}
                onClick={() => update("message", `${form.message} ${item}`)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <label className="field-label">
            Mensagem com variaveis e emojis
            <textarea
              className="winc-input mt-2 min-h-[150px]"
              value={form.message}
              onChange={(event) => update("message", event.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <label className="field-label">Anexar arquivos</label>
            <label className="upload-zone mt-2">
              <Upload size={20} />
              <span>imagem, video, pdf ou audio</span>
              <input className="hidden" type="file" multiple onChange={uploadFiles} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {form.attachments.map((file) => (
                <span className="file-pill" key={file.id || file.fileName}>
                  {file.mimeType?.startsWith("image") ? <FileImage size={14} /> : file.mimeType?.startsWith("video") ? <FileVideo size={14} /> : file.mimeType?.startsWith("audio") ? <FileAudio size={14} /> : <FileText size={14} />}
                  {file.originalName}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <label className="toggle-row">
              <span>
                <strong>Controle anti-bloqueio seguro</strong>
                <small>rate limit, opt-in, dedupe e pausas naturais</small>
              </span>
              <input type="checkbox" checked={form.safeMode} onChange={(event) => update("safeMode", event.target.checked)} />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Aquecimento de sessao</strong>
                <small>cadencia conservadora para novas operacoes</small>
              </span>
              <input type="checkbox" checked={form.warmupMode} onChange={(event) => update("warmupMode", event.target.checked)} />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="neon-button flex-1" onClick={() => createCampaign(true)} disabled={busy || session?.status !== "online"} type="button">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Criar e disparar
          </button>
          <button className="ghost-button flex-1" onClick={() => createCampaign(false)} disabled={busy} type="button">
            <Archive size={18} />
            Salvar rascunho
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="neon-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Progresso</p>
              <h3 className="mt-2 text-xl font-black text-white">{currentCampaign?.name || "Nenhuma campanha ativa"}</h3>
            </div>
            <StatusPill status={currentCampaign?.status || "offline"} label={currentCampaign?.status || "standby"} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between font-mono text-xs text-mint/52">
              <span>{progress}%</span>
              <span>{currentCampaign?.sent || 0}/{currentCampaign?.total || 0}</span>
            </div>
            <div className="progress-shell">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="counter-box">
              <strong>{currentCampaign?.sent || 0}</strong>
              <span>enviados</span>
            </div>
            <div className="counter-box">
              <strong className="text-danger">{currentCampaign?.failed || 0}</strong>
              <span>falhados</span>
            </div>
            <div className="counter-box">
              <strong className="text-amber">{currentCampaign?.pending || 0}</strong>
              <span>aguardando</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button className="control-button" onClick={() => controlCampaign("pause")} disabled={!campaignId || busy} type="button">
              <Pause size={17} />
              Pausar
            </button>
            <button className="control-button" onClick={() => controlCampaign("resume")} disabled={!campaignId || busy} type="button">
              <Play size={17} />
              Continuar
            </button>
            <button className="control-button danger" onClick={() => controlCampaign("cancel")} disabled={!campaignId || busy} type="button">
              <Square size={17} />
              Cancelar
            </button>
          </div>
        </div>

        <div className="terminal-card">
          <div className="flex items-center justify-between border-b border-neon/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-neon">
              <TerminalSquare size={18} />
              Logs em tempo real
            </div>
            <span className="text-xs text-white/36">{logs.length} eventos</span>
          </div>
          <div className="terminal-scroll">
            {logs.length ? (
              logs.map((log) => (
                <div className={classNames("terminal-line", `terminal-${log.level}`)} key={log.id || `${log.created_at}-${log.message}`}>
                  <span>{new Date(log.created_at || Date.now()).toLocaleTimeString("pt-BR")}</span>
                  <p>{log.message}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-mint/36">Aguardando eventos da fila...</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryPage({ campaigns, loadCampaign }) {
  return (
    <div className="neon-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-neon/10 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Historico</p>
          <h3 className="mt-2 text-2xl font-black text-white">Campanhas executadas</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/52">
          {campaigns.length} registros
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-white/[0.025] text-xs uppercase tracking-[0.16em] text-white/42">
            <tr>
              <th className="px-5 py-4">Campanha</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Provider</th>
              <th className="px-5 py-4">Enviados</th>
              <th className="px-5 py-4">Falhas</th>
              <th className="px-5 py-4">Criada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {campaigns.map((campaign) => (
              <tr className="transition hover:bg-neon/[0.035]" key={campaign.id} onClick={() => loadCampaign(campaign.id)}>
                <td className="px-5 py-4 font-bold text-white">{campaign.name}</td>
                <td className="px-5 py-4"><StatusPill status={campaign.status} label={campaign.status} /></td>
                <td className="px-5 py-4 text-white/58">{campaign.provider}</td>
                <td className="px-5 py-4 font-mono text-neon">{campaign.sent}/{campaign.total}</td>
                <td className="px-5 py-4 font-mono text-danger">{campaign.failed}</td>
                <td className="px-5 py-4 text-white/42">{new Date(campaign.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectionsPage({ session, setSession, notify }) {
  const [provider, setProvider] = useState(session?.provider || "wppconnect");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.provider) setProvider(session.provider);
  }, [session?.provider]);

  const changeProvider = async (next) => {
    setProvider(next);
    try {
      const { session: updated } = await api.post("/whatsapp/provider", { provider: next });
      setSession(updated);
    } catch (error) {
      notify("Provider nao alterado", error.message, "error");
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const { session: connected } = await api.post("/whatsapp/connect", { provider });
      setSession(connected);
      notify("Conexao iniciada", provider === "official" ? "API Oficial online." : "QR Code gerado para leitura.", "success");
    } catch (error) {
      notify("Falha ao conectar", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const { session: disconnected } = await api.post("/whatsapp/disconnect");
      setSession(disconnected);
      notify("Sessao desconectada", "A conexao foi colocada offline.", "success");
    } catch (error) {
      notify("Falha ao desconectar", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <section className="neon-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Conexoes WhatsApp</p>
        <h3 className="mt-2 text-2xl font-black text-white">Sessao e provedor</h3>
        <div className="mt-6">
          <ProviderToggle value={provider} onChange={changeProvider} />
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-white/58">Status</span>
            <StatusPill status={session?.status || "offline"} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <span className="text-white/58">Telefone</span>
            <span className="font-mono text-neon">{session?.phone || "nao vinculado"}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="neon-button" onClick={connect} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />}
            Conectar
          </button>
          <button className="ghost-button" onClick={disconnect} disabled={busy}>
            <WifiOff size={18} />
            Desconectar
          </button>
        </div>
      </section>

      <section className="neon-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">QR Code</p>
            <h3 className="mt-2 text-2xl font-black text-white">Pareamento WPP Connect</h3>
          </div>
          <Smartphone className="text-neon" />
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="qr-frame">
            {session?.qr_code ? <img src={session.qr_code} alt="QR Code WhatsApp" /> : <QrCode size={96} className="text-white/16" />}
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-neon/10 bg-black/25 p-4">
              <h4 className="font-black text-white">Fluxo operacional</h4>
              <p className="mt-2 text-sm leading-6 text-white/54">
                WPP Connect usa QR Code simulado e fica online em alguns segundos. API Oficial sobe direto quando as credenciais estiverem no ambiente.
              </p>
            </div>
            <div className="rounded-lg border border-amber/20 bg-amber/5 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 text-amber" size={18} />
                <p className="text-sm leading-6 text-amber/78">
                  Use listas com consentimento, opt-out claro e limites de volume. O modo seguro existe para reputacao e conformidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ settings, setSettings, notify }) {
  const [draft, setDraft] = useState(settings || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(settings || {}), [settings]);

  const save = async () => {
    setBusy(true);
    try {
      const { settings: updated } = await api.put("/settings", draft);
      setSettings(updated);
      localStorage.setItem("winc_sound", updated.notificationSound ? "on" : "off");
      notify("Configuracoes salvas", "Politicas do modo seguro atualizadas.", "success");
    } catch (error) {
      notify("Erro ao salvar", error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
      <section className="neon-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Configuracoes</p>
        <h3 className="mt-2 text-2xl font-black text-white">Modo seguro anti-bloqueio</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="field-label">
            Janela silenciosa inicio
            <input className="winc-input mt-2" value={draft.quietHoursStart || "22:00"} onChange={(event) => setDraft({ ...draft, quietHoursStart: event.target.value })} />
          </label>
          <label className="field-label">
            Janela silenciosa fim
            <input className="winc-input mt-2" value={draft.quietHoursEnd || "08:00"} onChange={(event) => setDraft({ ...draft, quietHoursEnd: event.target.value })} />
          </label>
          <label className="field-label">
            Maximo por minuto
            <input className="winc-input mt-2" type="number" value={draft.maxPerMinute || 18} onChange={(event) => setDraft({ ...draft, maxPerMinute: Number(event.target.value) })} />
          </label>
          <label className="field-label">
            Limite diario
            <input className="winc-input mt-2" type="number" value={draft.dailyLimit || 800} onChange={(event) => setDraft({ ...draft, dailyLimit: Number(event.target.value) })} />
          </label>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="toggle-row">
            <span>
              <strong>Modo seguro global</strong>
              <small>Aplica boas praticas de cadencia e janela de envio</small>
            </span>
            <input type="checkbox" checked={Boolean(draft.safeMode)} onChange={(event) => setDraft({ ...draft, safeMode: event.target.checked })} />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Sons sutis de notificacao</strong>
              <small>Beep curto em eventos importantes</small>
            </span>
            <input type="checkbox" checked={Boolean(draft.notificationSound)} onChange={(event) => setDraft({ ...draft, notificationSound: event.target.checked })} />
          </label>
        </div>
        <button className="neon-button mt-6" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar configuracoes
        </button>
      </section>

      <section className="neon-card p-5">
        <Database className="text-neon" size={24} />
        <h3 className="mt-4 text-xl font-black text-white">Banco SQLite</h3>
        <p className="mt-3 text-sm leading-6 text-white/54">
          Usuarios, contatos, campanhas, destinatarios, anexos, logs e preferencias ficam persistidos no arquivo local configurado.
        </p>
        <div className="mt-5 rounded-lg border border-neon/10 bg-black/30 p-4 font-mono text-xs text-mint/52">
          <p>DATABASE_PATH=./backend/storage/disparo-winc.sqlite</p>
          <p>UPLOAD_DIR=./backend/uploads</p>
          <p>JWT_EXPIRES_IN=8h</p>
        </div>
      </section>
    </div>
  );
}

function FacebookGroupsPage({ notify }) {
  const [postText, setPostText] = useState(
    "Olá pessoal! A Agência WINC preparou uma condição especial para empresas que querem captar mais clientes com campanhas organizadas. Quem quiser receber o material, comenta WINC ou chama no privado."
  );

  const groupRows = [
    { name: "Empreendedores Brasil", niche: "Negócios locais", members: "184k", status: "Aprovado" },
    { name: "Marketing para Pequenas Empresas", niche: "Marketing", members: "92k", status: "Revisar regras" },
    { name: "Prestadores de Serviço BR", niche: "Serviços", members: "68k", status: "Aguardando" },
    { name: "Comércio Local e Vendas", niche: "Vendas", members: "41k", status: "Aprovado" }
  ];

  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(postText);
      notify("Post copiado", "Texto pronto para publicação manual nos grupos aprovados.", "success");
    } catch (error) {
      notify("Falha ao copiar", error.message, "error");
    }
  };

  const openFacebookGroups = () => {
    window.open("https://www.facebook.com/groups/feed/", "_blank", "noopener,noreferrer");
    notify("Facebook aberto", "Revise as regras de cada grupo antes de publicar.", "info");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
      <section className="neon-card p-5">
        <div className="flex flex-col gap-4 border-b border-neon/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon/60">Facebook Groups</p>
            <h3 className="mt-2 text-2xl font-black text-white">Disparo assistido em grupos</h3>
          </div>
          <StatusPill status="online" label="manual seguro" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            ["Grupos mapeados", "38"],
            ["Aprovados", "16"],
            ["Posts prontos", "7"],
            ["Pendentes", "3"]
          ].map(([label, value]) => (
            <div className="counter-box text-left" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
          <label className="field-label">
            Copy para grupos
            <textarea
              className="winc-input mt-2 min-h-[220px]"
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
            />
          </label>
          <div className="space-y-3">
            <button className="neon-button w-full justify-center" onClick={copyPost} type="button">
              <ClipboardCheck size={18} />
              Copiar post
            </button>
            <button className="ghost-button w-full justify-center" onClick={openFacebookGroups} type="button">
              <Users size={18} />
              Abrir grupos do Facebook
            </button>
            <div className="rounded-lg border border-amber/20 bg-amber/5 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 text-amber" size={18} />
                <p className="text-sm leading-6 text-amber/78">
                  Publicação assistida: use apenas grupos onde sua postagem é permitida e respeite as regras de cada comunidade.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-white/[0.025] text-xs uppercase tracking-[0.16em] text-white/42">
              <tr>
                <th className="px-5 py-4">Grupo</th>
                <th className="px-5 py-4">Nicho</th>
                <th className="px-5 py-4">Membros</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {groupRows.map((group) => (
                <tr className="transition hover:bg-neon/[0.035]" key={group.name}>
                  <td className="px-5 py-4 font-bold text-white">{group.name}</td>
                  <td className="px-5 py-4 text-white/58">{group.niche}</td>
                  <td className="px-5 py-4 font-mono text-neon">{group.members}</td>
                  <td className="px-5 py-4"><StatusPill status={group.status === "Aprovado" ? "online" : "pending"} label={group.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <div className="neon-card p-5">
          <Clock3 className="text-neon" size={24} />
          <h3 className="mt-4 text-xl font-black text-white">Sequência recomendada</h3>
          <div className="mt-5 space-y-3">
            {["Revisar regras do grupo", "Copiar post aprovado", "Publicar manualmente", "Registrar respostas no CRM"].map((step, index) => (
              <div className="flex items-center gap-3 rounded-lg border border-neon/10 bg-black/25 p-3" key={step}>
                <span className="grid size-7 place-items-center rounded-lg border border-neon/20 bg-neon/10 font-mono text-xs text-neon">{index + 1}</span>
                <span className="text-sm text-white/70">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="neon-card p-5">
          <Sparkles className="text-neon" size={24} />
          <h3 className="mt-4 text-xl font-black text-white">Modelo humanizado</h3>
          <p className="mt-3 text-sm leading-6 text-white/54">
            Crie posts curtos, contextuais e com chamada leve para comentário. Evite repetição agressiva e mantenha histórico por grupo.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => ({
    token: sessionStorage.getItem(TOKEN_KEY),
    user: JSON.parse(sessionStorage.getItem(USER_KEY) || "null")
  }));
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busyLogin, setBusyLogin] = useState(false);
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [settings, setSettings] = useState(null);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((title, message, type = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [{ id, title, message, type }, ...prev].slice(0, 5));
    if (type === "success" || type === "error") playTone(type);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5200);
  }, []);

  const dismissToast = (id) => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const refreshAll = useCallback(async () => {
    if (!auth.token) return;
    try {
      const [statsData, sessionData, campaignsData, settingsData] = await Promise.all([
        api.get("/stats"),
        api.get("/whatsapp/session"),
        api.get("/campaigns"),
        api.get("/settings")
      ]);
      setStats(statsData.stats);
      setSession(sessionData.session);
      setCampaigns(campaignsData.campaigns);
      setSettings(settingsData.settings);
      localStorage.setItem("winc_sound", settingsData.settings.notificationSound ? "on" : "off");
    } catch (error) {
      notify("Sincronizacao falhou", error.message, "error");
    }
  }, [auth.token, notify]);

  useEffect(() => {
    setToken(auth.token);
    if (auth.token) refreshAll();
  }, [auth.token, refreshAll]);

  useEffect(() => {
    if (!auth.token) return undefined;
    const socket = createRealtimeSocket(auth.token);

    socket.on("connect_error", (error) => {
      notify("Tempo real desconectado", error.message || "Falha no Socket.io", "error");
    });
    socket.on("whatsapp:session", setSession);
    socket.on("stats:refresh", setStats);
    socket.on("campaign:progress", (campaign) => {
      setCurrentCampaign((prev) => (prev?.id === campaign.id || !prev ? campaign : prev));
      setCampaigns((prev) => {
        const exists = prev.some((item) => item.id === campaign.id);
        return exists ? prev.map((item) => (item.id === campaign.id ? { ...item, ...campaign } : item)) : [campaign, ...prev];
      });
    });
    socket.on("campaign:log", (log) => {
      setLogs((prev) => [log, ...prev].slice(0, 120));
      if (log.level === "success") playTone("success");
      if (log.level === "error") playTone("error");
    });

    return () => socket.disconnect();
  }, [auth.token, notify]);

  const login = async (email, password) => {
    setBusyLogin(true);
    try {
      const result = await api.post("/auth/login", { email, password });
      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setToken(result.token);
      setAuth({ token: result.token, user: result.user });
      notify("Acesso liberado", "Bem-vindo ao DISPARO WINC.", "success");
    } catch (error) {
      notify("Login recusado", error.message, "error");
    } finally {
      setBusyLogin(false);
    }
  };

  const logout = () => {
    setToken("");
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setAuth({ token: "", user: null });
  };

  const loadCampaign = async (id) => {
    try {
      const { campaign } = await api.get(`/campaigns/${id}`);
      setCurrentCampaign(campaign);
      setLogs(campaign.logs || []);
      setActive("disparos");
    } catch (error) {
      notify("Campanha nao carregada", error.message, "error");
    }
  };

  const content = useMemo(() => {
    if (active === "dashboard") return <Dashboard stats={stats} session={session} campaigns={campaigns} setActive={setActive} />;
    if (active === "disparos") {
      return (
        <CampaignBuilder
          session={session}
          campaigns={campaigns}
          currentCampaign={currentCampaign}
          setCurrentCampaign={setCurrentCampaign}
          logs={logs}
          refreshAll={refreshAll}
          notify={notify}
        />
      );
    }
    if (active === "facebook") return <FacebookGroupsPage notify={notify} />;
    if (active === "historico") return <HistoryPage campaigns={campaigns} loadCampaign={loadCampaign} />;
    if (active === "conexoes") return <ConnectionsPage session={session} setSession={setSession} notify={notify} />;
    return <SettingsPage settings={settings} setSettings={setSettings} notify={notify} />;
  }, [active, stats, session, campaigns, currentCampaign, logs, refreshAll, notify, settings]);

  if (!auth.token) {
    return (
      <>
        <LoginScreen onLogin={login} busy={busyLogin} />
        <ToastStack toasts={toasts} dismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-void text-white">
      <div className="cyber-grid fixed inset-0" />
      <div className="relative z-10 flex min-h-screen">
        <div className={classNames("fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden", mobileOpen ? "block" : "hidden")} onClick={() => setMobileOpen(false)} />
        <div className={classNames("fixed bottom-0 left-0 top-0 z-50 transition-transform lg:sticky lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <Sidebar active={active} setActive={(id) => { setActive(id); setMobileOpen(false); }} collapsed={collapsed} setCollapsed={setCollapsed} onLogout={logout} />
        </div>
        <main className="min-w-0 flex-1">
          <Topbar active={active} user={auth.user} session={session} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
          <div className="p-4 lg:p-6">
            {stats || active !== "dashboard" ? content : <CyberLoader label="Carregando painel" />}
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

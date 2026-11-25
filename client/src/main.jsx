import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  KeyRound,
  MonitorSmartphone,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  Search,
  Plus,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldX,
  Menu,
  ArrowUpRight,
  Coins,
  X,
  CalendarClock,
} from "lucide-react";
import "./index.css";
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Piso-Tabs-Request": "portal",
    },
    ...options,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: "Unexpected server response" };
  }
  if (!response.ok) {
    const details = Object.entries(data.fields || {}).flatMap(
      ([field, messages]) =>
        Array.isArray(messages)
          ? messages.map((message) => `${field}: ${message}`)
          : [],
    );
    throw new Error(
      [data.error || `HTTP ${response.status}`, ...details].join(" — "),
    );
  }
  return data;
}
const moneyDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Never";
const normDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
function Pill({ status }) {
  const style =
    status === "issued"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : status === "revoked"
        ? "bg-red-500/10 text-red-300 border-red-500/30"
        : status === "expired"
          ? "bg-orange-500/10 text-orange-300 border-orange-500/30"
          : "bg-blue-500/10 text-blue-300 border-blue-500/30";
  return (
    <span
      className={
        "border rounded-full px-2.5 py-1 text-xs font-semibold capitalize " +
        style
      }
    >
      {status === "issued" ? "Active / unbound" : status}
    </span>
  );
}
const nav = [
  ["overview", LayoutDashboard, "Overview"],
  ["licenses", KeyRound, "Licenses"],
  ["devices", MonitorSmartphone, "Devices"],
  ["audit", ScrollText, "Audit logs"],
  ["settings", Settings, "Settings"],
];
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10">
        <ShieldCheck className="text-accent" size={23} />
      </div>
      <div>
        <div className="font-extrabold tracking-wider text-xl">
          PISO <span className="text-accent">TABS</span>
        </div>
        <div className="text-[10px] tracking-[.24em] text-slate-400 font-bold">
          LICENSE CONTROL
        </div>
      </div>
    </div>
  );
}
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute rounded-full w-[480px] h-[480px] bg-emerald-500/10 blur-[120px] -top-40 -right-40" />
      <div className="panel w-full max-w-[440px] p-8 md:p-10 relative shadow-2xl">
        <Brand />
        <div className="mt-12">
          <div className="text-2xl font-bold">Welcome back</div>
          <p className="muted mt-2">
            Sign in to your private licensing workspace.
          </p>
        </div>
        <form
          className="mt-8 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              onLogin(result.admin);
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className="label">Administrator email</label>
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 p-3 text-sm">
              {error}
            </div>
          )}
          <button
            disabled={busy}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in to portal"}
          </button>
        </form>
        <div className="mt-8 pt-5 border-t border-slate-700/60 text-xs text-slate-500 flex gap-2">
          <ShieldCheck size={14} /> Secure administrator access · Piso Tabs
        </div>
      </div>
    </main>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#010611]/80 backdrop-blur-md grid place-items-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-start mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          {onClose && (
            <button
              className="p-1 hover:bg-white/10 rounded-lg"
              onClick={onClose}
            >
              <X />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
function Metric({ label, value, icon: Icon, hint }) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between mb-6">
        <div className="text-xs tracking-wider text-slate-400 font-semibold">
          {label}
        </div>
        <div className="p-2 bg-[#1e3445] rounded-lg text-accent">
          <Icon size={18} />
        </div>
      </div>
      <div className="text-3xl font-extrabold">{value ?? "—"}</div>
      <div className="text-xs text-slate-500 mt-2">{hint}</div>
    </div>
  );
}
function Overview({ stats, onNew, onNavigate, reload }) {
  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Dashboard overview</h1>
          <p className="muted mt-2">
            Manage and monitor your Piso Tabs licenses.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={onNew}>
          <Plus size={18} /> Generate license
        </button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
        <Metric
          label="TOTAL LICENSES"
          value={stats?.total}
          icon={KeyRound}
          hint="All keys issued"
        />
        <Metric
          label="ACTIVE LICENSES"
          value={stats?.active}
          icon={ShieldCheck}
          hint="Issued and not expired"
        />
        <Metric
          label="EXPIRING IN 30 DAYS"
          value={stats?.expiringSoon}
          icon={CalendarClock}
          hint="Need renewal"
        />
        <Metric
          label="REVOKED LICENSES"
          value={stats?.revoked}
          icon={ShieldX}
          hint="Disabled by administrator"
        />
      </div>
      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <div className="panel p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-[#17372f] text-accent">
              <ShieldCheck size={19} />
            </div>
            <h3 className="font-bold">Licensing workspace is ready</h3>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Create secure keys, assign them to customers, and manage their
            status. Activation and tablet binding are intentionally disabled in
            this release, until we implement a verified Android device
            handshake.
          </p>
          <button
            className="mt-6 text-accent text-sm font-bold inline-flex items-center gap-1"
            onClick={() => onNavigate("licenses")}
          >
            Open license registry <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="panel p-6">
          <h3 className="font-bold mb-4">System status</h3>
          <div className="flex items-center gap-3 text-sm mb-4">
            <span className="h-2 w-2 bg-emerald-400 rounded-full" /> Portal
            connected
          </div>
          <div className="flex items-center gap-3 text-sm mb-4">
            <span className="h-2 w-2 bg-emerald-400 rounded-full" /> MongoDB
            Atlas database
          </div>
          <div className="flex items-center gap-3 text-sm text-amber-300">
            <span className="h-2 w-2 bg-amber-400 rounded-full" /> Device
            activation pending
          </div>
          <button
            className="btn-muted text-xs mt-5 flex gap-2 items-center"
            onClick={reload}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>
    </>
  );
}
function LicenseRows({ rows, onRevoke, onRenew }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-left min-w-[700px]">
        <thead>
          <tr className="text-xs tracking-wider text-slate-500 border-b border-[#314052]">
            <th className="px-5 py-4">LICENSE / CUSTOMER</th>
            <th className="px-5 py-4">PLAN</th>
            <th className="px-5 py-4">STATUS</th>
            <th className="px-5 py-4">EXPIRES</th>
            <th className="px-5 py-4">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[#213045] hover:bg-[#192b40]/60"
            >
              <td className="px-5 py-4">
                <div className="font-semibold text-sm">{row.label}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {row.customer} · {row.keyHint}
                </div>
              </td>
              <td className="px-5 py-4 text-sm capitalize">{row.plan}</td>
              <td className="px-5 py-4">
                <Pill status={row.status} />
              </td>
              <td className="px-5 py-4 text-sm text-slate-400">
                {moneyDate(row.expiresAt)}
              </td>
              <td className="px-5 py-4 flex gap-2">
                <button
                  className="text-sm text-accent disabled:opacity-30"
                  disabled={row.status === "revoked" || row.plan === "lifetime"}
                  onClick={() => onRenew(row)}
                >
                  Renew
                </button>
                <span className="text-slate-600">·</span>
                <button
                  className="text-sm text-red-300 disabled:opacity-30"
                  disabled={row.status === "revoked"}
                  onClick={() => onRevoke(row)}
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="text-center text-slate-400 py-14">
          No licenses found. Generate your first license to get started.
        </div>
      )}
    </div>
  );
}
function CreateLicense({ close, onDone }) {
  const [label, setLabel] = useState("");
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("monthly");
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiry, setExpiry] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return normDate(d);
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState(null);
  const [shown, setShown] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const date =
        plan === "lifetime"
          ? null
          : new Date(`${expiry}T23:59:59`).toISOString();
      const result = await api("/licenses", {
        method: "POST",
        body: JSON.stringify({
          label,
          customer,
          plan,
          maxDevices: Number(maxDevices),
          expiresAt: date,
          notes,
          requestId,
        }),
      });
      setIssued(result.key);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        issued ? "License successfully generated" : "Generate a new license"
      }
      onClose={issued ? undefined : close}
    >
      {issued ? (
        <div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-200 flex gap-2">
            <AlertTriangle size={20} className="shrink-0" />
            <span>
              This is the only time this full key will be displayed. Copy it and
              store it safely before closing.
            </span>
          </div>
          <div className="rounded-xl border border-[#35465d] p-4 my-5 bg-[#0b1424] break-all font-mono tracking-wide">
            {shown ? issued : issued.replace(/[^-]/g, "•")}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-muted flex gap-2 items-center"
              onClick={() => setShown(!shown)}
            >
              {shown ? <EyeOff size={17} /> : <Eye size={17} />}{" "}
              {shown ? "Hide" : "Show"}
            </button>
            <button
              className="btn-primary flex-1 flex gap-2 justify-center items-center"
              onClick={() => navigator.clipboard.writeText(issued)}
            >
              <Copy size={17} /> Copy key
            </button>
          </div>
          <button className="btn-muted w-full mt-3" onClick={close}>
            I saved the key — close
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label">License label</label>
            <input
              required
              minLength={2}
              maxLength={90}
              className="field"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Arcade Machine 001"
            />
          </div>
          <div>
            <label className="label">Customer / owner</label>
            <input
              required
              minLength={2}
              maxLength={100}
              className="field"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Customer or shop name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License plan</label>
              <select
                className="field"
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  let d = new Date();
                  if (e.target.value === "trial") d.setDate(d.getDate() + 7);
                  else if (e.target.value === "annual")
                    d.setFullYear(d.getFullYear() + 1);
                  else d.setMonth(d.getMonth() + 1);
                  setExpiry(normDate(d));
                }}
              >
                <option value="trial">7-day trial</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div>
              <label className="label">Device limit (future)</label>
              <input
                className="field"
                type="number"
                min="1"
                max="100"
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
              />
            </div>
          </div>
          {plan !== "lifetime" && (
            <div>
              <label className="label">Expiry date</label>
              <input
                className="field"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                required
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="field"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button
            disabled={busy}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate secure key"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function App() {
  const [auth, setAuth] = useState(undefined);
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [licenses, setLicenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [audit, setAudit] = useState([]);
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    api("/auth/me")
      .then((x) => setAuth(x.admin))
      .catch(() => setAuth(null));
  }, []);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    Promise.all([
      api("/dashboard"),
      api("/licenses?page=" + page + "&q=" + encodeURIComponent(query)),
      api("/audit"),
    ])
      .then(([s, l, a]) => {
        if (active) {
          setStats(s);
          setLicenses(l.items);
          setTotal(l.total);
          setAudit(a.items);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [auth, query, page, reloadKey]);
  const reload = () => setReloadKey((v) => v + 1);
  async function revoke(row) {
    if (
      !window.confirm(`Revoke license “${row.label}”? This cannot be undone.`)
    )
      return;
    try {
      await api("/licenses/" + row.id + "/revoke", { method: "POST" });
      reload();
    } catch (e) {
      setError(e.message);
    }
  }
  async function renew(row) {
    const date = window.prompt(
      "New expiry date (YYYY-MM-DD)",
      normDate(row.expiresAt),
    );
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Invalid date format");
      return;
    }
    try {
      await api("/licenses/" + row.id + "/renew", {
        method: "POST",
        body: JSON.stringify({
          expiresAt: new Date(date + "T23:59:59").toISOString(),
        }),
      });
      reload();
    } catch (e) {
      setError(e.message);
    }
  }
  if (auth === undefined)
    return (
      <div className="min-h-screen grid place-items-center text-accent">
        Loading Piso Tabs portal…
      </div>
    );
  if (!auth) return <Login onLogin={setAuth} />;
  return (
    <div className="min-h-screen flex bg-[#080e1c]">
      <aside
        className={
          "fixed z-30 lg:static inset-y-0 left-0 w-[250px] bg-[#0b1525] border-r border-[#263347] flex flex-col p-5 transition-transform " +
          (menu ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
        <Brand />
        <div className="mt-12 text-[10px] text-slate-500 font-bold tracking-[.23em] ml-3 mb-4">
          WORKSPACE
        </div>
        <nav className="space-y-2">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setMenu(false);
              }}
              className={
                "w-full flex gap-3 items-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors " +
                (tab === id
                  ? "bg-[#1b3a36] text-accent border border-[#31584d]"
                  : "text-slate-400 hover:text-white hover:bg-[#17293d]")
              }
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-5 border-t border-[#283549]">
          <div className="text-xs text-slate-400 truncate mb-3">
            {auth.email}
          </div>
          <button
            className="text-slate-400 flex gap-3 items-center text-sm hover:text-white"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
                setAuth(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      {menu && (
        <div
          onClick={() => setMenu(false)}
          className="fixed inset-0 z-20 bg-black/70 lg:hidden"
        />
      )}
      <div className="flex-1 min-w-0">
        <header className="border-b border-[#233046] h-[76px] flex items-center px-5 md:px-8 gap-4 justify-between">
          <div className="flex gap-3 items-center">
            <button className="lg:hidden p-2" onClick={() => setMenu(true)}>
              <Menu />
            </button>
            <span className="text-xs tracking-widest text-slate-500">
              WORKSPACE
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-semibold capitalize">
              {tab === "overview" ? "Dashboard" : tab}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex rounded-full border border-[#265748] text-emerald-300 px-3 py-1.5 text-xs font-semibold gap-2 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
              Connected
            </span>
            <div className="rounded-full bg-[#233a4c] h-9 w-9 grid place-items-center text-sm font-bold text-accent">
              {auth.email[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="p-5 md:p-8 max-w-[1500px] mx-auto">
          {error && (
            <div className="mb-5 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex justify-between">
              {error}
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "overview" && (
            <Overview
              stats={stats}
              onNew={() => setModal("new")}
              onNavigate={setTab}
              reload={reload}
            />
          )}
          {tab === "licenses" && (
            <>
              <div className="flex flex-wrap justify-between gap-4 items-center mb-7">
                <div>
                  <h1 className="text-3xl font-bold">License registry</h1>
                  <p className="muted mt-2">
                    Issue and manage your license keys.
                  </p>
                </div>
                <button
                  className="btn-primary flex gap-2 items-center"
                  onClick={() => setModal("new")}
                >
                  <Plus size={17} /> New license
                </button>
              </div>
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b border-[#29364b] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <KeyRound size={18} /> {total} licenses
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      className="field w-[160px] sm:w-[240px]"
                      placeholder="Search licenses"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setPage(1);
                          setQuery(q);
                        }
                      }}
                    />
                    <button
                      className="btn-muted !px-3"
                      onClick={() => {
                        setPage(1);
                        setQuery(q);
                      }}
                    >
                      <Search size={18} />
                    </button>
                  </div>
                </div>
                <LicenseRows
                  rows={licenses}
                  onRenew={renew}
                  onRevoke={revoke}
                />
                <div className="px-5 py-4 flex justify-between items-center text-sm text-slate-400">
                  <span>
                    Page {page} of {Math.max(1, Math.ceil(total / 25))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="btn-muted !py-1.5"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="btn-muted !py-1.5"
                      disabled={page * 25 >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === "devices" && (
            <>
              <h1 className="text-3xl font-bold">Registered devices</h1>
              <p className="muted mt-2">
                Android device activation is planned for the next milestone.
              </p>
              <div className="panel mt-7 p-10 text-center">
                <MonitorSmartphone
                  size={40}
                  className="mx-auto text-accent mb-4"
                />
                <h3 className="text-xl font-bold mb-2">
                  No device activations yet
                </h3>
                <p className="muted max-w-lg mx-auto">
                  The device activation API is intentionally not exposed until
                  cryptographic device binding, replay protection, and offline
                  entitlement signing are complete.
                </p>
              </div>
            </>
          )}
          {tab === "audit" && (
            <>
              <h1 className="text-3xl font-bold">Activity & audit log</h1>
              <p className="muted mt-2">
                Administrative actions recorded by the server.
              </p>
              <div className="panel mt-7 divide-y divide-[#26364b]">
                {audit.map((a) => (
                  <div
                    className="p-5 flex flex-wrap gap-3 justify-between"
                    key={a.id}
                  >
                    <div>
                      <div className="text-sm font-semibold">{a.action}</div>
                      <div className="text-xs text-slate-500 mt-1 font-mono break-all">
                        {a.targetId}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {!audit.length && (
                  <div className="p-8 text-slate-400">
                    No audit entries yet.
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "settings" && (
            <>
              <h1 className="text-3xl font-bold">Portal settings</h1>
              <p className="muted mt-2">Security and deployment information.</p>
              <div className="panel mt-7 p-6 max-w-3xl">
                <h3 className="font-bold flex gap-2 items-center">
                  <ShieldCheck className="text-accent" /> Account
                </h3>
                <div className="mt-4 text-sm text-slate-400">
                  Signed in as <span className="text-white">{auth.email}</span>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                  <AlertTriangle size={16} className="inline mr-2" /> Before
                  inviting other administrators or selling licenses, add MFA,
                  account recovery, and device activation validation. This
                  release is intended for a single trusted owner account.
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {modal === "new" && (
        <CreateLicense close={() => setModal(null)} onDone={reload} />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);

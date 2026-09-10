import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, LogOut, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Table2, Download, AlertTriangle, RefreshCw,
} from "lucide-react";

import * as api from "./lib/api.js";
import { CATS, CAT_LABEL, baseForm, formOf, fmtLong, toCSV, downloadFile } from "./lib/helpers.js";
import { Poster, Field, FormBuilder, PosterPicker, DynamicField, Empty } from "./ui.jsx";

const BLANK = {
  title: "", category: "tech", org: "", date: "", time: "18:00", ends: "2 hours",
  venue: "", city: "", seats: 100, fee: 0, poster: "",
  blurb: "", about: "", rules: "", policies: "",
  contactName: "", contactPhone: "", contactEmail: "",
};

export default function Admin({ notify, onEventsChanged }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    api.currentSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setChecking(false);
    });
    const { data } = api.supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    api.myProfile().then(setProfile);
  }, [session]);

  if (checking) return <div className="loading">Checking your session…</div>;
  if (!session) return <SignIn notify={notify} />;

  return (
    <Dashboard session={session} profile={profile} notify={notify} onEventsChanged={onEventsChanged} />
  );
}

/* -------------------------------- sign in -------------------------------- */

function SignIn({ notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.signIn(email, password);
      notify("Signed in");
    } catch (err) {
      setError(
        err.message.toLowerCase().includes("invalid")
          ? "That email and password don't match an organiser account."
          : err.message
      );
    }
    setBusy(false);
  }

  return (
    <div className="gate">
      <div className="gate-mark"><LayoutDashboard size={24} /></div>
      <h2>Organiser sign-in</h2>
      <p>Club and department accounts only. Students don't need an account to register.</p>

      <div className="form">
        <Field label="Email">
          <input value={email} inputMode="email" autoComplete="username"
            placeholder="events@campus.ac.in"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
        </Field>
        <Field label="Password">
          <input type="password" value={password} autoComplete="current-password"
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
        </Field>

        {error && <div className="formfail"><AlertTriangle size={15} /><span>{error}</span></div>}

        <button className="btn wide" onClick={go} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>

      <p className="gate-fine">
        Accounts are created by the administrator in Supabase. There is no public sign-up.
      </p>
    </div>
  );
}

/* ------------------------------- dashboard ------------------------------- */

function Dashboard({ session, profile, notify, onEventsChanged }) {
  const [view, setView] = useState("events");
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [composing, setComposing] = useState(false);
  const [step, setStep] = useState("details");
  const [draft, setDraft] = useState(BLANK);
  const [fields, setFields] = useState(baseForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const orgName = (profile && profile.org_name) || session.user.email;

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [list, tally] = await Promise.all([api.listAllEvents(), api.registrationCounts()]);
      setEvents(list);
      setCounts(tally);
      if (onEventsChanged) onEventsChanged(list);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() {
    setDraft({ ...BLANK, org: (profile && profile.org_name) || "", contactEmail: session.user.email });
    setFields(baseForm());
    setEditingId(null);
    setFieldErrors({});
    setStep("details");
    setComposing(true);
  }

  function startEdit(ev) {
    setDraft({
      title: ev.title, category: ev.category, org: ev.org, date: ev.date, time: ev.time,
      ends: ev.ends, venue: ev.venue, city: ev.city || "", seats: ev.seats, fee: ev.fee,
      poster: ev.poster || "", blurb: ev.blurb, about: ev.about || "",
      rules: (ev.rules || []).join("\n"),
      policies: (ev.policies || []).join("\n"),
      contactName: ev.contact.name || "",
      contactPhone: ev.contact.phone || "",
      contactEmail: ev.contact.email || "",
    });
    setFields(formOf(ev).map((f) => ({ ...f })));
    setEditingId(ev.id);
    setFieldErrors({});
    setStep("details");
    setComposing(true);
  }

  function validate() {
    const e = {};
    if (draft.title.trim().length < 3) e.title = "Give the event a name.";
    if (!draft.blurb.trim()) e.blurb = "One line students see on the card.";
    if (!draft.date) e.date = "Pick a date.";
    if (!draft.venue.trim()) e.venue = "Where is it happening?";
    if (!Number(draft.seats) || Number(draft.seats) < 1) e.seats = "Seats must be at least 1.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) {
      setStep("details");
      return;
    }
    if (fields.some((f) => !String(f.label).trim())) {
      notify("Every question needs a label.");
      setStep("form");
      return;
    }

    const body = {
      title: draft.title.trim(),
      category: draft.category,
      org: draft.org.trim() || orgName,
      date: draft.date,
      time: draft.time || "18:00",
      ends: draft.ends.trim() || "2 hours",
      venue: draft.venue.trim(),
      city: draft.city.trim(),
      seats: Number(draft.seats),
      fee: Number(draft.fee) || 0,
      poster: draft.poster.trim(),
      blurb: draft.blurb.trim(),
      about: draft.about.trim() || draft.blurb.trim(),
      rules: draft.rules.split("\n").map((s) => s.trim()).filter(Boolean),
      policies: draft.policies.split("\n").map((s) => s.trim()).filter(Boolean),
      contact: {
        name: draft.contactName.trim(),
        phone: draft.contactPhone.trim(),
        email: draft.contactEmail.trim() || session.user.email,
      },
      form: fields,
      featured: false,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateEvent(editingId, body);
        notify(`${body.title} updated`);
      } else {
        await api.createEvent(body);
        notify(`${body.title} is live`);
      }
      setComposing(false);
      setEditingId(null);
      setDraft(BLANK);
      setFields(baseForm());
      await refresh();
    } catch (err) {
      notify(err.message);
    }
    setSaving(false);
  }

  async function remove(ev) {
    if (!window.confirm(`Remove "${ev.title}" and all its registrations?`)) return;
    try {
      await api.deleteEvent(ev.id);
      notify(`${ev.title} removed`);
      await refresh();
    } catch (err) {
      notify(err.message);
    }
  }

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <>
      <div className="adminbar">
        <div>
          <h2>{orgName}</h2>
          <p>{session.user.email}</p>
        </div>
        <button className="round sm" aria-label="Sign out"
          onClick={async () => { await api.signOut(); notify("Signed out"); }}>
          <LogOut size={16} />
        </button>
      </div>

      <div className="seg admin">
        <button className={view === "events" ? "on" : ""}
          onClick={() => { setView("events"); setComposing(false); }}>Events</button>
        <button className={view === "regs" ? "on" : ""}
          onClick={() => { setView("regs"); setComposing(false); }}>Registrations</button>
      </div>

      {error && (
        <div className="segbody">
          <div className="formfail"><AlertTriangle size={15} /><span>{error}</span></div>
        </div>
      )}

      {view === "events" && !composing && (
        <div className="segbody">
          <div className="statrow">
            <div className="stat"><b>{events.length}</b><span>events</span></div>
            <div className="stat">
              <b>{Object.values(counts).reduce((a, b) => a + b, 0)}</b><span>registrations</span>
            </div>
            <div className="stat">
              <b>{events.reduce((s, e) => s + Math.max(0, e.seats - e.taken), 0)}</b><span>seats open</span>
            </div>
          </div>

          <button className="btn wide" onClick={startNew}>
            <Plus size={17} strokeWidth={2.6} />Post an event
          </button>

          {loading && <p className="sc-empty">Loading your events…</p>}

          {!loading && events.length === 0 && (
            <Empty icon={<LayoutDashboard size={22} />} title="No events yet"
              body="Post the first one and it appears on the Discover tab straight away." />
          )}

          <div className="adminlist">
            {events.map((ev) => (
              <div className="arow" key={ev.id}>
                <div className="ar-poster"><Poster ev={ev} /></div>
                <div className="ar-body">
                  <h4>{ev.title}</h4>
                  <p>{fmtLong(ev.date)} · {ev.venue}</p>
                  <div className="ar-meta">
                    <span className="tagline">{counts[ev.id] || 0} registered</span>
                    <span className="tagline">{formOf(ev).length} questions</span>
                  </div>
                </div>
                <div className="ar-tools">
                  <button className="round sm" aria-label={`Edit ${ev.title}`} onClick={() => startEdit(ev)}>
                    <Pencil size={14} />
                  </button>
                  <button className="round sm danger" aria-label={`Remove ${ev.title}`} onClick={() => remove(ev)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "events" && composing && (
        <div className="segbody">
          <div className="composehead">
            <button className="round sm" onClick={() => setComposing(false)} aria-label="Back">
              <ChevronLeft size={17} />
            </button>
            <h3>{editingId ? "Edit event" : "New event"}</h3>
          </div>

          <div className="seg two-up">
            <button className={step === "details" ? "on" : ""} onClick={() => setStep("details")}>
              Event details
            </button>
            <button className={step === "form" ? "on" : ""} onClick={() => setStep("form")}>
              Registration form
            </button>
          </div>

          {step === "details" && (
            <div className="form">
              <PosterPicker draft={draft} setDraft={setDraft} notify={notify} upload={api.uploadPoster} />

              <Field label="Event name" error={fieldErrors.title}>
                <input value={draft.title} onChange={set("title")} placeholder="Freshers' Night" />
              </Field>

              <Field label="One-line description" hint="shown on the card" error={fieldErrors.blurb}>
                <input value={draft.blurb} onChange={set("blurb")}
                  placeholder="Music, food and a very serious dance-off." />
              </Field>

              <div className="two">
                <Field label="Category">
                  <select value={draft.category} onChange={set("category")}>
                    {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </Field>
                <Field label="Hosted by">
                  <input value={draft.org} onChange={set("org")} placeholder="Cultural Committee" />
                </Field>
              </div>

              <div className="two">
                <Field label="Date" error={fieldErrors.date}>
                  <input type="date" value={draft.date} onChange={set("date")} />
                </Field>
                <Field label="Start time">
                  <input type="time" value={draft.time} onChange={set("time")} />
                </Field>
              </div>

              <div className="two">
                <Field label="Venue" error={fieldErrors.venue}>
                  <input value={draft.venue} onChange={set("venue")} placeholder="Open Air Theatre" />
                </Field>
                <Field label="Runs for">
                  <input value={draft.ends} onChange={set("ends")} placeholder="3 hours" />
                </Field>
              </div>

              <div className="two">
                <Field label="Seats" error={fieldErrors.seats}>
                  <input type="number" min="1" value={draft.seats} onChange={set("seats")} />
                </Field>
                <Field label="Fee in ₹" hint="0 for free">
                  <input type="number" min="0" value={draft.fee} onChange={set("fee")} />
                </Field>
              </div>

              <Field label="City or campus">
                <input value={draft.city} onChange={set("city")} placeholder="Jorhat" />
              </Field>

              <Field label="Full description">
                <textarea rows={4} value={draft.about} onChange={set("about")}
                  placeholder="What happens, who it's for, what to bring." />
              </Field>

              <Field label="Rules" hint="one per line">
                <textarea rows={4} value={draft.rules} onChange={set("rules")}
                  placeholder={"Bring your institute ID.\nDoors close at 7pm."} />
              </Field>

              <Field label="Policies" hint="one per line">
                <textarea rows={4} value={draft.policies} onChange={set("policies")}
                  placeholder={"Seats released after 15 minutes.\nFees refunded only if cancelled."} />
              </Field>

              <div className="two">
                <Field label="Contact name">
                  <input value={draft.contactName} onChange={set("contactName")} placeholder="Ankita Bora" />
                </Field>
                <Field label="Contact phone">
                  <input value={draft.contactPhone} onChange={set("contactPhone")} placeholder="+91 98640 11223" />
                </Field>
              </div>

              <Field label="Contact email">
                <input value={draft.contactEmail} onChange={set("contactEmail")} placeholder={session.user.email} />
              </Field>

              <button className="btn wide" onClick={() => { if (validate()) setStep("form"); }}>
                Next: registration form<ChevronRight size={16} />
              </button>
            </div>
          )}

          {step === "form" && (
            <div className="form">
              <FormBuilder fields={fields} setFields={setFields} />

              <div className="fb-preview">
                <div className="fb-pv-head">What students will see</div>
                {fields.map((f) => (
                  <DynamicField key={f.id} field={f} value={f.type === "checkbox" ? false : ""}
                    onChange={() => {}} disabled />
                ))}
              </div>

              <button className="btn wide" onClick={save} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Publish event"}
              </button>
              <button className="btn ghost wide" onClick={() => setComposing(false)} disabled={saving}>
                Discard
              </button>
            </div>
          )}
        </div>
      )}

      {view === "regs" && (
        <Registrations events={events} counts={counts} notify={notify} onRefresh={refresh} />
      )}
    </>
  );
}

/* ----------------------------- registrations ----------------------------- */

function Registrations({ events, counts, notify, onRefresh }) {
  const withRegs = events.filter((e) => (counts[e.id] || 0) > 0);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const active = events.find((e) => e.id === selected) || withRegs[0] || null;
  const form = active ? formOf(active) : [];

  useEffect(() => {
    if (!active) {
      setRows([]);
      return;
    }
    setLoading(true);
    api
      .listRegistrations(active.id)
      .then(setRows)
      .catch((err) => notify(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active && active.id]);

  if (withRegs.length === 0)
    return (
      <div className="segbody">
        <Empty icon={<Table2 size={22} />} title="No registrations yet"
          body="Once students start registering, their answers appear here and download as a spreadsheet." />
      </div>
    );

  const cell = (r, f) => {
    const v = (r.answers || {})[f.id];
    if (f.type === "checkbox") return v ? "Yes" : "No";
    return v == null || v === "" ? "—" : String(v);
  };

  return (
    <div className="segbody">
      <div className="sheetcard">
        <div className="sc-head">
          <Table2 size={18} />
          <div>
            <b>{active ? active.title : "Registrations"}</b>
            <span>{rows.length} rows · columns follow this event's form</span>
          </div>
        </div>
        <p className="sc-note">
          Download opens in Excel, Google Sheets or Numbers. Add a question to the form later and a
          new column joins the export automatically.
        </p>
        <div className="pp-actions">
          <button className="btn ghost" onClick={onRefresh}><RefreshCw size={15} />Refresh</button>
          <button className="btn" disabled={!rows.length}
            onClick={() => {
              const name = `${active.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-registrations.csv`;
              downloadFile(name, toCSV(form, rows));
              notify("Spreadsheet downloaded");
            }}>
            <Download size={15} />Download CSV
          </button>
        </div>
      </div>

      <Field label="Showing rows for">
        <select value={active ? active.id : ""} onChange={(e) => setSelected(e.target.value)}>
          {withRegs.map((e) => (
            <option key={e.id} value={e.id}>{e.title} ({counts[e.id] || 0})</option>
          ))}
        </select>
      </Field>

      {loading ? (
        <p className="sc-empty">Loading rows…</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {form.map((f) => <th key={f.id}>{f.label}</th>)}
                <th>Pass code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {form.map((f) => <td key={f.id}>{cell(r, f)}</td>)}
                  <td>{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

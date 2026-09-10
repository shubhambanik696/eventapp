import React, { useMemo, useState, useRef } from "react";
import {
  Heart, Check, X, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Lock,
  GripVertical, ImagePlus,
} from "lucide-react";
import {
  INKS, CAT_LABEL, FIELD_TYPES, hash, fmtDay, fmtMon, fmtWeekday, compressImage,
} from "./lib/helpers.js";

/* --------------------------------- logo ---------------------------------- */

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="ea-g" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D6F050" />
          <stop offset="0.52" stopColor="#7BE0A8" />
          <stop offset="1" stopColor="#FF4E8B" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="15" fill="url(#ea-g)" />
      <path
        d="M12.5 18.4a3.9 3.9 0 0 1 3.9-3.9h15.2a3.9 3.9 0 0 1 3.9 3.9v2.5a3.1 3.1 0 0 0 0 6.2v2.5a3.9 3.9 0 0 1-3.9 3.9H16.4a3.9 3.9 0 0 1-3.9-3.9v-2.5a3.1 3.1 0 0 0 0-6.2z"
        fill="#0C0C1E"
      />
      <path d="M24 15v18" stroke="#D6F050" strokeWidth="1.5" strokeDasharray="2 3.2" strokeLinecap="round" opacity="0.75" />
      <path d="M18.2 20.6l1.3 2.7 3 .44-2.15 2.1.5 2.98-2.65-1.4-2.65 1.4.5-2.98-2.15-2.1 3-.44z" fill="#D6F050" />
      <circle cx="29.6" cy="24" r="1.5" fill="#FF4E8B" />
      <circle cx="29.6" cy="19.4" r="1.5" fill="#FF4E8B" opacity=".55" />
      <circle cx="29.6" cy="28.6" r="1.5" fill="#FF4E8B" opacity=".55" />
    </svg>
  );
}

/* ------------------------------ riso posters ------------------------------ */

function Motif({ kind, a, b }) {
  if (kind === "arcs")
    return (
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx="150" cy="118" r={34 + i * 26} fill="none" stroke={a} strokeWidth="7" opacity={0.85 - i * 0.13} />
        ))}
        <circle cx="196" cy="76" r="30" fill={b} opacity=".85" />
      </g>
    );
  if (kind === "waves")
    return (
      <g>
        {[...Array(13)].map((_, i) => {
          const h = 22 + Math.abs(Math.sin(i * 1.35)) * 116;
          return (
            <rect key={i} x={22 + i * 21} y={182 - h} width="13" height={h} rx="6"
              fill={i % 3 === 0 ? b : a} opacity={i % 3 === 0 ? 0.9 : 0.8} />
          );
        })}
      </g>
    );
  if (kind === "orbs")
    return (
      <g>
        <circle cx="112" cy="112" r="74" fill={a} opacity=".85" />
        <circle cx="196" cy="140" r="62" fill={b} opacity=".7" />
        <circle cx="152" cy="70" r="40" fill="none" stroke={a} strokeWidth="6" />
      </g>
    );
  if (kind === "rays")
    return (
      <g>
        {[...Array(14)].map((_, i) => (
          <path key={i}
            d={`M150 122 L${150 + 210 * Math.cos((i * Math.PI) / 7)} ${122 + 210 * Math.sin((i * Math.PI) / 7)} L${150 + 210 * Math.cos(((i + 0.42) * Math.PI) / 7)} ${122 + 210 * Math.sin(((i + 0.42) * Math.PI) / 7)} Z`}
            fill={i % 2 ? a : b} opacity=".62" />
        ))}
        <circle cx="150" cy="122" r="42" fill={a} />
      </g>
    );
  if (kind === "grid")
    return (
      <g>
        {[...Array(4)].map((_, r) =>
          [...Array(5)].map((_, c) => (
            <rect key={`${r}-${c}`} x={26 + c * 54} y={30 + r * 48} width="40" height="34" rx="8"
              fill={(r + c) % 3 === 0 ? b : "none"} stroke={a} strokeWidth="4"
              opacity={(r + c) % 3 === 0 ? 0.9 : 0.7} />
          ))
        )}
      </g>
    );
  return (
    <g>
      <path d="M40 150a62 62 0 0 1 124 0z" fill={a} opacity=".9" />
      <path d="M150 150a52 52 0 0 1 104 0z" fill={b} opacity=".8" />
      <circle cx="88" cy="62" r="26" fill="none" stroke={a} strokeWidth="6" />
      <circle cx="212" cy="70" r="18" fill={b} opacity=".85" />
    </g>
  );
}

export function Poster({ ev, tall = false, className = "" }) {
  const ink = INKS[ev.category] || INKS.workshop;
  const rot = ((hash(ev.id || ev.title || "x") % 7) - 3) * 0.6;
  const height = tall ? 300 : 210;

  if (ev.poster)
    return (
      <div className={`poster ${className}`} style={{ height }}>
        <img src={ev.poster} alt="" className="poster-img" loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="poster-fade" />
        <div className="poster-cat">{CAT_LABEL[ev.category]}</div>
      </div>
    );

  return (
    <div className={`poster ${className}`} style={{ height, background: ink.bg }}>
      <svg viewBox="0 0 300 210" preserveAspectRatio="xMidYMid slice" className="poster-svg">
        <g transform={`rotate(${rot} 150 105)`} opacity=".9">
          <Motif kind={ink.motif} a={ink.a} b={ink.b} />
        </g>
      </svg>
      <div className="poster-halftone" />
      <div className="poster-mis" style={{ color: ink.b }}>{ev.title}</div>
      <div className="poster-type" style={{ color: ink.a }}>{ev.title}</div>
      <div className="poster-fade" />
      <div className="poster-cat">{CAT_LABEL[ev.category]}</div>
    </div>
  );
}

/* ------------------------------ small pieces ------------------------------ */

export function SeatBar({ ev }) {
  const left = Math.max(0, ev.seats - ev.taken);
  const pct = Math.min(100, Math.round((ev.taken / Math.max(1, ev.seats)) * 100));
  const state = left === 0 ? "full" : left <= ev.seats * 0.12 ? "low" : "ok";
  return (
    <div className="seatwrap">
      <div className="seatbar"><span className={`seatfill s-${state}`} style={{ width: `${pct}%` }} /></div>
      <span className={`seattext s-${state}`}>
        {left === 0 ? "No seats left" : `${left} of ${ev.seats} seats left`}
      </span>
    </div>
  );
}

export function LikeButton({ liked, onClick, big = false }) {
  return (
    <button className={`like ${liked ? "on" : ""} ${big ? "big" : ""}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-pressed={liked} aria-label={liked ? "Remove from liked" : "Add to liked"}>
      <Heart size={big ? 20 : 17} fill={liked ? "#FF4E8B" : "none"} strokeWidth={2.2} />
    </button>
  );
}

export function DateBlock({ ev }) {
  return (
    <div className="dateblock">
      <span className="d-day">{fmtDay(ev.date)}</span>
      <span className="d-mon">{fmtMon(ev.date)}</span>
      <span className="d-wd">{fmtWeekday(ev.date)}</span>
    </div>
  );
}

export function CodeGrid({ code }) {
  const cells = useMemo(() => {
    let h = hash(code);
    const out = [];
    for (let i = 0; i < 441; i++) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      out.push((h >>> 17) & 1);
    }
    const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
    return out.map((v, i) => {
      const r = Math.floor(i / 21);
      const c = i % 21;
      if (finder(r, c)) {
        const rr = r > 13 ? r - 14 : r;
        const cc = c > 13 ? c - 14 : c;
        const edge = rr === 0 || rr === 6 || cc === 0 || cc === 6;
        const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
        return edge || core ? 1 : 0;
      }
      return v;
    });
  }, [code]);

  return (
    <div className="qr" role="img" aria-label={`Entry code ${code}`}>
      {cells.map((v, i) => <span key={i} className={v ? "on" : ""} />)}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="f-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
      {error && <span className="f-err">{error}</span>}
    </label>
  );
}

export function Empty({ icon, title, body, action, onAction }) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <button className="btn ghost" onClick={onAction}>{action}</button>}
    </div>
  );
}

/* --------------------------- one registration field ----------------------- */

export function DynamicField({ field, value, onChange, error, disabled = false }) {
  if (field.type === "checkbox")
    return (
      <div className="field">
        <button type="button" className={`agree ${value ? "on" : ""}`} disabled={disabled}
          onClick={() => onChange(!value)}>
          <span className="box">{value && <Check size={13} strokeWidth={3.5} />}</span>
          <span>{field.label}{field.hint && <em className="inlinehint">{field.hint}</em>}</span>
        </button>
        {error && <span className="f-err">{error}</span>}
      </div>
    );

  return (
    <Field label={field.label + (field.required ? "" : " (optional)")} hint={field.hint} error={error}>
      {field.type === "textarea" ? (
        <textarea rows={3} value={value || ""} placeholder={field.placeholder || ""} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={field.type === "date" ? "date" : "text"}
          inputMode={
            field.type === "phone" || field.type === "number"
              ? "numeric"
              : field.type === "email"
              ? "email"
              : "text"
          }
          maxLength={field.type === "phone" ? 10 : undefined}
          value={value || ""} placeholder={field.placeholder || ""} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/* ------------------------------ form builder ------------------------------ */

function FieldEditor({ field, onChange, onRemove, onMove, first, last }) {
  const [open, setOpen] = useState(false);
  const type = FIELD_TYPES[field.type] || FIELD_TYPES.text;

  return (
    <div className={`fb-item ${open ? "open" : ""}`}>
      <div className="fb-head">
        <span className="fb-grip"><GripVertical size={15} /></span>
        <button type="button" className="fb-name" onClick={() => setOpen(!open)}>
          <b>{field.label || "Untitled question"}</b>
          <span className="fb-type">{type.label}{field.required ? " · required" : ""}</span>
        </button>
        {field.locked && (
          <span className="fb-lock" title="Kept on every form"><Lock size={13} /></span>
        )}
        <div className="fb-tools">
          <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label="Move up"><ArrowUp size={14} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={last} aria-label="Move down"><ArrowDown size={14} /></button>
          <button type="button" onClick={() => setOpen(!open)} aria-label="Edit question"><Pencil size={14} /></button>
          {!field.locked && (
            <button type="button" className="danger" onClick={onRemove} aria-label="Remove question"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {open && (
        <div className="fb-edit">
          <Field label="Question">
            <input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
          </Field>

          <div className="two">
            <Field label="Answer type">
              <select value={field.type} disabled={field.locked}
                onChange={(e) =>
                  onChange({
                    ...field,
                    type: e.target.value,
                    options:
                      e.target.value === "select"
                        ? field.options || ["Option one", "Option two"]
                        : field.options,
                  })
                }>
                {Object.entries(FIELD_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Required">
              <select value={field.required ? "yes" : "no"} disabled={field.locked}
                onChange={(e) => onChange({ ...field, required: e.target.value === "yes" })}>
                <option value="yes">Must answer</option>
                <option value="no">Can skip</option>
              </select>
            </Field>
          </div>

          {field.type === "select" && (
            <Field label="Choices" hint="one per line">
              <textarea rows={4} value={(field.options || []).join("\n")}
                onChange={(e) =>
                  onChange({
                    ...field,
                    options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                } />
            </Field>
          )}

          {field.type !== "checkbox" && field.type !== "select" && (
            <Field label="Placeholder" hint="optional">
              <input value={field.placeholder || ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })} />
            </Field>
          )}

          <Field label="Helper note" hint="optional">
            <input value={field.hint || ""} onChange={(e) => onChange({ ...field, hint: e.target.value })} />
          </Field>

          {field.locked && (
            <p className="fb-note">
              This one stays on every form. The name prints on the pass, and the email is what stops
              the same person registering twice. You can still reword the question.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function FormBuilder({ fields, setFields }) {
  const [adding, setAdding] = useState(false);

  const update = (i, next) => setFields(fields.map((f, j) => (j === i ? next : f)));
  const remove = (i) => setFields(fields.filter((_, j) => j !== i));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    setFields(next);
  };

  const add = (type) => {
    setFields([
      ...fields,
      {
        id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        type,
        label: type === "checkbox" ? "Do you agree?" : "New question",
        required: false,
        options: type === "select" ? ["Option one", "Option two"] : undefined,
      },
    ]);
    setAdding(false);
  };

  return (
    <div className="fb">
      <div className="fb-top">
        <div>
          <h4>Registration form</h4>
          <p>What students fill in when they register for this event.</p>
        </div>
        <span className="fb-count">{fields.length} questions</span>
      </div>

      <div className="fb-list">
        {fields.map((f, i) => (
          <FieldEditor key={f.id} field={f} onChange={(n) => update(i, n)} onRemove={() => remove(i)}
            onMove={(d) => move(i, d)} first={i === 0} last={i === fields.length - 1} />
        ))}
      </div>

      {adding ? (
        <div className="fb-add">
          {Object.entries(FIELD_TYPES).map(([k, v]) => (
            <button type="button" key={k} className="fb-chip" onClick={() => add(k)}>
              <i>{v.icon}</i>{v.label}
            </button>
          ))}
          <button type="button" className="fb-chip cancel" onClick={() => setAdding(false)}>
            <X size={13} />Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn ghost wide" onClick={() => setAdding(true)}>
          <Plus size={16} strokeWidth={2.6} />Add a question
        </button>
      )}
    </div>
  );
}

/* ------------------------------ poster picker ----------------------------- */

export function PosterPicker({ draft, setDraft, notify, upload }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Pick an image file — jpg, png or webp.");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const url = await upload(blob);
      setDraft((d) => ({ ...d, poster: url }));
      notify("Poster uploaded");
    } catch (err) {
      notify(err.message || "That image wouldn't upload.");
    }
    setBusy(false);
  }

  return (
    <div className="pp">
      <div className="pp-preview">
        <Poster ev={{ id: "draft", title: draft.title || "Your event", category: draft.category, poster: draft.poster }} />
        {draft.poster && (
          <button type="button" className="round sm pp-clear" aria-label="Remove poster"
            onClick={() => setDraft((d) => ({ ...d, poster: "" }))}>
            <X size={15} />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

      <div className="pp-actions">
        <button type="button" className="btn ghost" disabled={busy}
          onClick={() => fileRef.current && fileRef.current.click()}>
          <ImagePlus size={16} />
          {busy ? "Uploading…" : draft.poster ? "Replace poster" : "Upload poster"}
        </button>
      </div>

      <Field label="Or paste an image link" hint="optional">
        <input value={draft.poster || ""} placeholder="https://…"
          onChange={(e) => setDraft((d) => ({ ...d, poster: e.target.value }))} />
      </Field>

      <p className="pp-note">
        Uploads are resized to about 1400px wide before they reach storage. With no poster, the
        event prints its own in the colours of its category.
      </p>
    </div>
  );
}

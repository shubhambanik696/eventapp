/* Pure helpers shared by the student and admin sides. No Supabase in here. */

export const INKS = {
  tech: { bg: "#0F1035", a: "#63E6BE", b: "#FF4E8B", motif: "arcs" },
  music: { bg: "#2A0B2E", a: "#FFD166", b: "#FF4E8B", motif: "waves" },
  sports: { bg: "#06231B", a: "#D6F050", b: "#4CC9F0", motif: "orbs" },
  cultural: { bg: "#2B0F1A", a: "#FF7A5C", b: "#FFD166", motif: "rays" },
  workshop: { bg: "#12122B", a: "#D6F050", b: "#A78BFA", motif: "grid" },
  talks: { bg: "#0B1F2A", a: "#4CC9F0", b: "#D6F050", motif: "blobs" },
};

export const CATS = ["tech", "music", "sports", "cultural", "workshop", "talks"];

export const CAT_LABEL = {
  tech: "Tech",
  music: "Music",
  sports: "Sports",
  cultural: "Cultural",
  workshop: "Workshop",
  talks: "Talks",
};

/* ------------------------- registration form model ------------------------ */

export const FIELD_TYPES = {
  text: { label: "Short text", icon: "Aa" },
  textarea: { label: "Paragraph", icon: "¶" },
  email: { label: "Email", icon: "@" },
  phone: { label: "Mobile", icon: "#" },
  number: { label: "Number", icon: "12" },
  select: { label: "Dropdown", icon: "▾" },
  checkbox: { label: "Yes / no", icon: "✓" },
  date: { label: "Date", icon: "31" },
};

/* key:'name' and key:'email' are locked on every form. The name prints on the
   pass; the email is the duplicate guard backed by a unique index. */
export const baseForm = () => [
  {
    id: "name",
    key: "name",
    label: "Full name",
    type: "text",
    required: true,
    locked: true,
    placeholder: "Rituraj Bhuyan",
  },
  {
    id: "email",
    key: "email",
    label: "Email",
    type: "email",
    required: true,
    locked: true,
    hint: "your pass goes here",
    placeholder: "you@campus.ac.in",
  },
  { id: "phone", label: "Mobile", type: "phone", required: true, placeholder: "9864012345" },
  { id: "roll", label: "Roll number", type: "text", required: true, placeholder: "CSE22-114" },
  {
    id: "dept",
    label: "Department",
    type: "select",
    required: true,
    options: [
      "Computer Science",
      "Electronics",
      "Mechanical",
      "Civil",
      "Agriculture",
      "Commerce",
      "Arts",
      "Science",
    ],
  },
];

export const formOf = (ev) =>
  ev && Array.isArray(ev.form) && ev.form.length ? ev.form : baseForm();

export const keyed = (form, key) => form.find((f) => f.key === key) || form[0];

export const answerFor = (values, ev, key) => values[keyed(formOf(ev), key).id];

/* ------------------------------- formatting ------------------------------- */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseDate(d) {
  const [y, m, day] = String(d).split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}
export const fmtDay = (d) => String(parseDate(d).getDate()).padStart(2, "0");
export const fmtMon = (d) => MONTHS[parseDate(d).getMonth()];
export const fmtWeekday = (d) => DAYS[parseDate(d).getDay()];

export function fmtLong(d) {
  const x = parseDate(d);
  return `${DAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`;
}

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${suffix}`;
}

export function daysAway(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(d) - today) / 86400000);
}

export function countdown(d) {
  const n = daysAway(d);
  if (n < 0) return "Finished";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return `In ${n} days`;
  if (n < 14) return "Next week";
  return `In ${Math.round(n / 7)} weeks`;
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------- validation ------------------------------- */

export const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
export const phoneOk = (v) => /^[6-9]\d{9}$/.test(String(v).replace(/\D/g, ""));

/* --------------------------------- images --------------------------------- */

/* Resizes a chosen poster before upload so a 5MB phone photo becomes ~200KB. */
export function compressImage(file, max = 1400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image we can read."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* --------------------------------- exports -------------------------------- */

const quote = (c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`;
const asCSV = (lines) => lines.map((line) => line.map(quote).join(",")).join("\n");

const answerText = (row, field) => {
  const v = (row.answers || {})[field.id];
  if (field.type === "checkbox") return v ? "Yes" : "No";
  return v == null ? "" : v;
};

const stamp = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

/* Registrations for one event. Columns follow that event's own form. */
export function toCSV(form, rows) {
  const head = [...form.map((f) => f.label), "Pass code", "Registered on"];
  const body = rows.map((r) => [
    ...form.map((f) => answerText(r, f)),
    r.code,
    stamp(r.created_at),
  ]);
  return asCSV([head, ...body]);
}

/* Every event, one row each, with its seat and registration numbers. */
export function eventsToCSV(events, counts = {}) {
  const head = [
    "Event", "Category", "Hosted by", "Date", "Time", "Runs for", "Venue", "City",
    "Seats", "Taken", "Seats left", "Registrations", "Fee", "Questions",
    "Published", "Contact name", "Contact phone", "Contact email",
    "Rules", "Policies", "Poster", "Description",
  ];
  const body = events.map((e) => [
    e.title, e.category, e.org, e.date, e.time, e.ends, e.venue, e.city,
    e.seats, e.taken, Math.max(0, e.seats - e.taken), counts[e.id] || 0, e.fee,
    formOf(e).length, e.published ? "Yes" : "No",
    (e.contact || {}).name, (e.contact || {}).phone, (e.contact || {}).email,
    (e.rules || []).join(" | "), (e.policies || []).join(" | "),
    e.poster || "", e.about || e.blurb,
  ]);
  return asCSV([head, ...body]);
}

/* Every registration across every event in one sheet. Events ask different
   questions, so the columns are the union of all labels; a blank cell means
   that event never asked. */
export function allRegistrationsToCSV(events, rows) {
  const byId = {};
  events.forEach((e) => { byId[e.id] = e; });

  const labels = [];
  events.forEach((e) =>
    formOf(e).forEach((f) => {
      if (!labels.includes(f.label)) labels.push(f.label);
    })
  );

  const head = ["Event", "Event date", "Venue", ...labels, "Pass code", "Registered on"];

  const body = rows.map((r) => {
    const ev = byId[r.event_id];
    const cells = {};
    if (ev) formOf(ev).forEach((f) => { cells[f.label] = answerText(r, f); });
    return [
      ev ? ev.title : "(removed event)",
      ev ? ev.date : "",
      ev ? ev.venue : "",
      ...labels.map((l) => (cells[l] == null ? "" : cells[l])),
      r.code,
      stamp(r.created_at),
    ];
  });

  return asCSV([head, ...body]);
}

export function downloadFile(name, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

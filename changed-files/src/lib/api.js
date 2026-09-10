import { createClient } from "@supabase/supabase-js";
import { baseForm } from "./helpers.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

/* --------------------------- local device memory --------------------------- */
/* No accounts for students, so a random id in localStorage is the identity.
   It is what keeps a like attached to a phone and disables a used button. */

const DEVICE_KEY = "eventapp.device";
const PASS_KEY = "eventapp.passes";

export function deviceId() {
  let id = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id = "no-storage";
  }
  return id;
}

export function getPasses() {
  try {
    const raw = localStorage.getItem(PASS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePass(pass) {
  const list = [...getPasses().filter((p) => p.eventId !== pass.eventId), pass];
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify(list));
  } catch {
    /* private mode — the pass still shows for this session */
  }
  return list;
}

/* -------------------------------- mapping -------------------------------- */

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    org: r.org,
    date: r.event_date,
    time: r.event_time,
    ends: r.duration,
    venue: r.venue,
    city: r.city,
    seats: r.seats,
    taken: r.taken,
    fee: r.fee,
    poster: r.poster_url,
    blurb: r.blurb,
    about: r.about,
    rules: r.rules || [],
    policies: r.policies || [],
    contact: r.contact || {},
    form: Array.isArray(r.form_fields) && r.form_fields.length ? r.form_fields : baseForm(),
    featured: r.featured,
    published: r.published,
    likes: r.like_count || 0,
  };
}

function toRow(ev) {
  return {
    title: ev.title,
    category: ev.category,
    org: ev.org,
    event_date: ev.date,
    event_time: ev.time,
    duration: ev.ends,
    venue: ev.venue,
    city: ev.city,
    seats: Number(ev.seats),
    fee: Number(ev.fee) || 0,
    poster_url: ev.poster || null,
    blurb: ev.blurb,
    about: ev.about,
    rules: ev.rules,
    policies: ev.policies,
    contact: ev.contact,
    form_fields: ev.form,
    featured: Boolean(ev.featured),
    published: true,
  };
}

/* --------------------------------- events -------------------------------- */

export async function listEvents() {
  const { data, error } = await supabase
    .from("events_public")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(fromRow);
}

export async function listAllEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(fromRow);
}

export async function createEvent(ev) {
  const { data, error } = await supabase.from("events").insert(toRow(ev)).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function updateEvent(id, ev) {
  const { data, error } = await supabase
    .from("events")
    .update(toRow(ev))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- posters -------------------------------- */

export async function uploadPoster(blob) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from("posters")
    .upload(name, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("posters").getPublicUrl(name);
  return data.publicUrl;
}

/* ---------------------------------- likes --------------------------------- */

export async function myLikes() {
  const { data, error } = await supabase
    .from("likes")
    .select("event_id")
    .eq("device_id", deviceId());
  if (error) return [];
  return (data || []).map((r) => r.event_id);
}

export async function setLike(eventId, on) {
  if (on) {
    const { error } = await supabase
      .from("likes")
      .insert({ event_id: eventId, device_id: deviceId() });
    if (error && error.code !== "23505") throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("event_id", eventId)
      .eq("device_id", deviceId());
    if (error) throw new Error(error.message);
  }
}

/* ------------------------------ registrations ----------------------------- */

const REG_ERRORS = {
  EVENT_FULL: "That event just filled up. No seats left.",
  ALREADY_REGISTERED: "This email is already registered for this event.",
  EVENT_NOT_FOUND: "This event is no longer open for registration.",
};

export async function register({ eventId, email, name, answers }) {
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event: eventId,
    p_email: email,
    p_name: name,
    p_answers: answers,
    p_device: deviceId(),
  });
  if (error) {
    const key = Object.keys(REG_ERRORS).find((k) => error.message.includes(k));
    throw new Error(key ? REG_ERRORS[key] : error.message);
  }
  return data;
}

export async function isTaken(eventId, email) {
  const { data, error } = await supabase.rpc("email_registered", {
    p_event: eventId,
    p_email: email,
  });
  if (error) return false;
  return Boolean(data);
}

export async function listRegistrations(eventId) {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listAllRegistrations() {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function registrationCounts() {
  const { data, error } = await supabase.from("registration_counts").select("*");
  if (error) return {};
  const out = {};
  (data || []).forEach((r) => {
    out[r.event_id] = r.total;
  });
  return out;
}

/* ---------------------------------- auth ---------------------------------- */

export async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function myProfile() {
  const { data, error } = await supabase.from("admins").select("*").maybeSingle();
  if (error) return null;
  return data;
}

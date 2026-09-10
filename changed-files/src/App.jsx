import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Heart, MapPin, CalendarDays, Users, Search, ChevronLeft, Check, Ticket,
  Home, X, Clock, ShieldCheck, ScrollText, LayoutDashboard, Phone, Mail,
  ChevronRight, AlertTriangle,
} from "lucide-react";

import * as api from "./lib/api.js";
import {
  CATS, CAT_LABEL, countdown, daysAway, emailOk, phoneOk, fmtLong, fmtTime,
  formOf, keyed,
} from "./lib/helpers.js";
import {
  Logo, Poster, SeatBar, LikeButton, DateBlock, CodeGrid, Field, Empty, DynamicField,
} from "./ui.jsx";
import Admin from "./Admin.jsx";

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [events, setEvents] = useState([]);
  const [likes, setLikes] = useState([]);
  const [passes, setPasses] = useState([]);
  const [tab, setTab] = useState("discover");
  const [openId, setOpenId] = useState(null);
  const [regFor, setRegFor] = useState(null);
  const [pass, setPass] = useState(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [toast, setToast] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!api.configured) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const [evs, myLikes] = await Promise.all([api.listEvents(), api.myLikes()]);
        setEvents(evs);
        setLikes(myLikes);
      } catch (err) {
        setLoadError(err.message);
      }
      setPasses(api.getPasses());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  if (!api.configured) return <SetupNotice />;

  const isLiked = (id) => likes.includes(id);
  const passOf = (id) => passes.find((p) => p.eventId === id);
  const open = openId ? events.find((e) => e.id === openId) : null;

  async function toggleLike(id) {
    const on = !likes.includes(id);
    setLikes((l) => (on ? [...l, id] : l.filter((x) => x !== id)));
    try {
      await api.setLike(id, on);
    } catch {
      setLikes((l) => (on ? l.filter((x) => x !== id) : [...l, id]));
      setToast("Couldn't save that like. Check your connection.");
    }
  }

  async function submitRegistration(ev, values) {
    const form = formOf(ev);
    const email = String(values[keyed(form, "email").id] || "").trim().toLowerCase();
    const name = String(values[keyed(form, "name").id] || "").trim();
    const code = await api.register({ eventId: ev.id, email, name, answers: values });
    const record = { eventId: ev.id, code, values, email, ts: Date.now() };
    setPasses(api.savePass(record));
    setEvents((list) =>
      list.map((e) => (e.id === ev.id ? { ...e, taken: Math.min(e.seats, e.taken + 1) } : e))
    );
    setRegFor(null);
    setPass(record);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => (cat === "all" ? true : e.category === cat))
      .filter(
        (e) => !q || `${e.title} ${e.org} ${e.venue} ${e.blurb}`.toLowerCase().includes(q)
      );
  }, [events, query, cat]);

  const featured = useMemo(
    () => events.filter((e) => e.featured || daysAway(e.date) <= 7).slice(0, 4),
    [events]
  );
  const likedEvents = events.filter((e) => likes.includes(e.id));
  const myPasses = passes
    .map((p) => ({ pass: p, ev: events.find((e) => e.id === p.eventId) }))
    .filter((x) => x.ev);

  return (
    <div className="app">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <Logo />
            <div className="brandtext">
              <div className="wordmark"><b>Event</b><i>App</i></div>
              <div className="byline">
                <span>by</span>
                <img src="/sunstone.png" alt="Sunstone" />
              </div>
            </div>
          </div>
          <div className="brand-note">{events.length} events on campus</div>
        </header>

        <main className="scroll" ref={scrollRef}>
          {!ready && <div className="loading">Loading events…</div>}

          {ready && loadError && (
            <div className="loaderr">
              <AlertTriangle size={18} />
              <div>
                <b>Couldn't reach the database</b>
                <span>{loadError}</span>
              </div>
            </div>
          )}

          {ready && tab === "discover" && (
            <Discover events={visible} featured={featured} query={query} setQuery={setQuery}
              cat={cat} setCat={setCat} isLiked={isLiked} toggleLike={toggleLike}
              passOf={passOf} onOpen={setOpenId} />
          )}

          {ready && tab === "liked" && (
            <Section title="Liked" sub={likedEvents.length ? "Tap a poster to register." : ""}>
              {likedEvents.length === 0 ? (
                <Empty icon={<Heart size={22} />} title="Nothing liked yet"
                  body="Tap the heart on any event and it waits for you here."
                  action="Browse events" onAction={() => setTab("discover")} />
              ) : (
                likedEvents.map((e) => (
                  <EventCard key={e.id} ev={e} liked onLike={() => toggleLike(e.id)}
                    pass={passOf(e.id)} onOpen={() => setOpenId(e.id)} />
                ))
              )}
            </Section>
          )}

          {ready && tab === "passes" && (
            <Section title="Your passes" sub={myPasses.length ? "Show the code at the gate." : ""}>
              {myPasses.length === 0 ? (
                <Empty icon={<Ticket size={22} />} title="No passes yet"
                  body="Register for an event and your entry code appears here."
                  action="Find something" onAction={() => setTab("discover")} />
              ) : (
                myPasses.map(({ pass: p, ev }) => (
                  <PassCard key={p.code} pass={p} ev={ev} onOpen={() => setOpenId(ev.id)} />
                ))
              )}
            </Section>
          )}

          {ready && tab === "admin" && (
            <Admin notify={setToast} onEventsChanged={(list) => setEvents(list.filter((e) => e.published))} />
          )}

          <div className="tail" />
        </main>

        <nav className="tabbar">
          {[
            { k: "discover", label: "Discover", icon: Home },
            { k: "liked", label: "Liked", icon: Heart, badge: likes.length },
            { k: "passes", label: "Passes", icon: Ticket, badge: passes.length },
            { k: "admin", label: "Admin", icon: LayoutDashboard },
          ].map(({ k, label, icon: Icon, badge }) => (
            <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
              <span className="tab-ico">
                <Icon size={19} strokeWidth={tab === k ? 2.4 : 2} />
                {badge ? <i className="dot">{badge}</i> : null}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {open && (
        <Detail ev={open} liked={isLiked(open.id)} onLike={() => toggleLike(open.id)}
          pass={passOf(open.id)} onClose={() => setOpenId(null)}
          onRegister={() => setRegFor(open)} onShowPass={() => setPass(passOf(open.id))} />
      )}

      {regFor && (
        <RegisterSheet ev={regFor} onClose={() => setRegFor(null)}
          onSubmit={(values) => submitRegistration(regFor, values)} />
      )}

      {pass && (
        <PassSheet pass={pass} ev={events.find((e) => e.id === pass.eventId)}
          onClose={() => setPass(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* -------------------------------- setup ---------------------------------- */

function SetupNotice() {
  return (
    <div className="app">
      <div className="shell">
        <div className="setup">
          <Logo size={44} />
          <h1>Almost there</h1>
          <p>
            EventApp can't find its database keys. Create a file called <code>.env.local</code> in
            the project root with these two lines, then restart the dev server.
          </p>
          <pre>{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}</pre>
          <p className="setup-fine">
            Both values are in Supabase under Project Settings, API. On Cloudflare, add the same two
            as build variables.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- discover -------------------------------- */

function Discover({ events, featured, query, setQuery, cat, setCat, isLiked, toggleLike, passOf, onOpen }) {
  return (
    <>
      <div className="searchrow">
        <Search size={17} />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, clubs, venues" />
        {query && <button className="clear" onClick={() => setQuery("")}><X size={15} /></button>}
      </div>

      <div className="chips">
        <button className={`chip ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>Everything</button>
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {featured.length > 0 && !query && cat === "all" && (
        <>
          <div className="sechead"><h2>This week</h2><span className="swipe">swipe</span></div>
          <div className="rail">
            {featured.map((e) => (
              <button key={e.id} className="railcard" onClick={() => onOpen(e.id)}>
                <Poster ev={e} tall />
                <div className="rail-body">
                  <span className="when">{countdown(e.date)}</span>
                  <h3>{e.title}</h3>
                  <p>{e.venue}</p>
                </div>
                <div className="rail-like">
                  <LikeButton liked={isLiked(e.id)} onClick={() => toggleLike(e.id)} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sechead"><h2>{query || cat !== "all" ? "Results" : "All events"}</h2></div>

      {events.length === 0 ? (
        <Empty icon={<Search size={22} />} title="Nothing here yet"
          body="Either no events match that, or none have been posted. Try clearing the filter."
          action="Clear filters" onAction={() => { setQuery(""); setCat("all"); }} />
      ) : (
        events.map((e) => (
          <EventCard key={e.id} ev={e} liked={isLiked(e.id)} onLike={() => toggleLike(e.id)}
            pass={passOf(e.id)} onOpen={() => onOpen(e.id)} />
        ))
      )}
    </>
  );
}

function Section({ title, sub, children }) {
  return (
    <>
      <div className="sechead"><h2>{title}</h2>{sub && <span className="swipe">{sub}</span>}</div>
      {children}
    </>
  );
}

function EventCard({ ev, liked, onLike, pass, onOpen }) {
  const left = ev.seats - ev.taken;
  return (
    <article className="card" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
      <div className="card-top">
        <Poster ev={ev} />
        <div className="card-float"><LikeButton liked={liked} onClick={onLike} /></div>
        <div className="card-when">{countdown(ev.date)}</div>
      </div>
      <div className="card-body">
        <DateBlock ev={ev} />
        <div className="card-main">
          <h3>{ev.title}</h3>
          <p className="card-org">{ev.org}</p>
          <div className="meta">
            <span><Clock size={13} />{fmtTime(ev.time)}</span>
            <span><MapPin size={13} />{ev.venue}</span>
          </div>
          <SeatBar ev={ev} />
        </div>
      </div>
      <div className="card-foot">
        <span className="fee">{ev.fee ? `₹${ev.fee}` : "Free entry"}</span>
        {pass ? (
          <span className="pillreg"><Check size={14} strokeWidth={3} />Registered</span>
        ) : left <= 0 ? (
          <span className="pillfull">Full</span>
        ) : (
          <span className="pillgo">Register<ChevronRight size={15} /></span>
        )}
      </div>
    </article>
  );
}

function PassCard({ pass, ev, onOpen }) {
  return (
    <article className="passcard" onClick={onOpen}>
      <div className="pc-left">
        <span className="pc-when">{countdown(ev.date)}</span>
        <h3>{ev.title}</h3>
        <p>{fmtLong(ev.date)} at {fmtTime(ev.time)}</p>
        <p className="pc-venue"><MapPin size={13} />{ev.venue}</p>
        <span className="pc-code">{pass.code}</span>
      </div>
      <div className="pc-perf" />
      <div className="pc-right"><CodeGrid code={pass.code} /></div>
    </article>
  );
}

/* --------------------------------- detail -------------------------------- */

function Detail({ ev, liked, onLike, pass, onClose, onRegister, onShowPass }) {
  const [seg, setSeg] = useState("about");
  const left = ev.seats - ev.taken;

  return (
    <div className="sheet" role="dialog" aria-label={ev.title}>
      <div className="sheet-scroll">
        <div className="hero">
          <Poster ev={ev} tall />
          <button className="round back" onClick={onClose} aria-label="Back"><ChevronLeft size={20} /></button>
          <div className="hero-like"><LikeButton liked={liked} onClick={onLike} big /></div>
          <div className="hero-cap">
            <span className="when">{countdown(ev.date)}</span>
            <h1>{ev.title}</h1>
            <p>{ev.blurb}</p>
          </div>
        </div>

        <div className="facts">
          <div className="fact">
            <CalendarDays size={16} />
            <div><b>{fmtLong(ev.date)}</b><span>{fmtTime(ev.time)} · runs {ev.ends}</span></div>
          </div>
          <div className="fact">
            <MapPin size={16} />
            <div><b>{ev.venue}</b><span>{ev.city}</span></div>
          </div>
          <div className="fact">
            <Users size={16} />
            <div>
              <b>{left <= 0 ? "Fully booked" : `${left} seats left`}</b>
              <span>{ev.taken} of {ev.seats} taken</span>
            </div>
          </div>
          <div className="fact">
            <Ticket size={16} />
            <div><b>{ev.fee ? `₹${ev.fee}` : "Free entry"}</b><span>Hosted by {ev.org}</span></div>
          </div>
        </div>

        <div className="seg">
          {[["about", "About"], ["rules", "Rules"], ["policies", "Policies"], ["contact", "Contact"]].map(
            ([k, l]) => (
              <button key={k} className={seg === k ? "on" : ""} onClick={() => setSeg(k)}>{l}</button>
            )
          )}
        </div>

        <div className="segbody">
          {seg === "about" && <p className="prose">{ev.about || ev.blurb}</p>}

          {seg === "rules" && (
            ev.rules.length ? (
              <ul className="rulelist">
                {ev.rules.map((r, i) => <li key={i}><ScrollText size={15} /><span>{r}</span></li>)}
              </ul>
            ) : (
              <p className="prose">No specific rules for this one.</p>
            )
          )}

          {seg === "policies" && (
            ev.policies.length ? (
              <ul className="rulelist">
                {ev.policies.map((r, i) => <li key={i}><ShieldCheck size={15} /><span>{r}</span></li>)}
              </ul>
            ) : (
              <p className="prose">No extra policies listed.</p>
            )
          )}

          {seg === "contact" && (
            <div className="contact">
              <p className="prose">
                Questions before you register? {ev.contact.name || ev.org} handles this one.
              </p>
              {ev.contact.phone && (
                <a className="crow" href={`tel:${String(ev.contact.phone).replace(/\s/g, "")}`}>
                  <Phone size={16} />{ev.contact.phone}
                </a>
              )}
              {ev.contact.email && (
                <a className="crow" href={`mailto:${ev.contact.email}`}>
                  <Mail size={16} />{ev.contact.email}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="tail" />
      </div>

      <div className="stickybar">
        <div className="sb-left">
          <b>{ev.fee ? `₹${ev.fee}` : "Free"}</b>
          <span>{left <= 0 ? "no seats left" : `${left} seats left`}</span>
        </div>
        {pass ? (
          <button className="btn done" onClick={onShowPass}>
            <Check size={17} strokeWidth={3} />You're registered — view pass
          </button>
        ) : left <= 0 ? (
          <button className="btn" disabled>Fully booked</button>
        ) : (
          <button className="btn" onClick={onRegister}>Register</button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- register -------------------------------- */

function RegisterSheet({ ev, onClose, onSubmit }) {
  const form = formOf(ev);
  const emailField = keyed(form, "email");
  const [vals, setVals] = useState({});
  const [err, setErr] = useState({});
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  async function go() {
    const e = {};

    form.forEach((f) => {
      const v = vals[f.id];
      const empty = f.type === "checkbox" ? !v : !String(v == null ? "" : v).trim();
      if (f.required && empty) {
        e[f.id] = `${f.label} is needed.`;
        return;
      }
      if (empty) return;
      if (f.type === "email" && !emailOk(v)) e[f.id] = "That email doesn't look right.";
      if (f.type === "phone" && !phoneOk(v)) e[f.id] = "Enter a 10-digit mobile number.";
      if (f.type === "number" && Number.isNaN(Number(v))) e[f.id] = "Numbers only.";
      if (f.key === "name" && String(v).trim().length < 3)
        e[f.id] = "Enter your full name as on your ID.";
    });

    if (!agree) e.__agree = "You need to accept the rules to register.";

    setErr(e);
    if (Object.keys(e).length) return;

    const email = String(vals[emailField.id]).trim().toLowerCase();
    setBusy(true);
    setFailure("");

    // A courtesy check so the message is friendly. The unique index in the
    // database is what actually prevents a second registration.
    if (await api.isTaken(ev.id, email)) {
      setErr({ [emailField.id]: "This email is already registered for this event." });
      setBusy(false);
      return;
    }

    try {
      await onSubmit(vals);
    } catch (error) {
      setFailure(error.message);
    }
    setBusy(false);
  }

  return (
    <div className="sheet" role="dialog" aria-label={`Register for ${ev.title}`}>
      <div className="grab" onClick={onClose} />
      <div className="sheet-scroll pad">
        <h2 className="sh-title">Register</h2>
        <p className="sh-sub">{ev.title} · {fmtLong(ev.date)}</p>

        <div className="form">
          {form.map((f) => (
            <DynamicField key={f.id} field={f} value={vals[f.id]} error={err[f.id]} disabled={busy}
              onChange={(v) => setVals({ ...vals, [f.id]: v })} />
          ))}

          <button type="button" className={`agree ${agree ? "on" : ""}`} onClick={() => setAgree(!agree)}>
            <span className="box">{agree && <Check size={13} strokeWidth={3.5} />}</span>
            <span>I've read the rules and policies for this event.</span>
          </button>
          {err.__agree && <span className="f-err block">{err.__agree}</span>}

          {failure && (
            <div className="formfail"><AlertTriangle size={15} /><span>{failure}</span></div>
          )}

          <p className="fineprint">
            One registration per email. Your answers go to {ev.org} for this event only.
          </p>

          <button className="btn wide" onClick={go} disabled={busy}>
            {busy ? "Sending…" : "Confirm registration"}
          </button>
          <button className="btn ghost wide" onClick={onClose} disabled={busy}>Not now</button>
        </div>
        <div className="tail" />
      </div>
    </div>
  );
}

function PassSheet({ pass, ev, onClose }) {
  if (!ev) return null;
  const form = formOf(ev);
  const name = pass.values[keyed(form, "name").id];
  const extras = form
    .filter((f) => !f.key && f.type !== "textarea" && pass.values[f.id])
    .slice(0, 2)
    .map((f) => [f.label, f.type === "checkbox" ? "Yes" : pass.values[f.id]]);

  return (
    <div className="sheet" role="dialog" aria-label="Your pass">
      <div className="grab" onClick={onClose} />
      <div className="sheet-scroll pad">
        <div className="okmark"><Check size={26} strokeWidth={3} /></div>
        <h2 className="sh-title center">You're in</h2>
        <p className="sh-sub center">Show this at the gate. It's saved under Passes.</p>

        <div className="pass">
          <div className="pass-head">
            <div><span>{fmtLong(ev.date)}</span><h3>{ev.title}</h3></div>
            <Logo size={26} />
          </div>
          <div className="pass-rows">
            <div><span>Name</span><b>{name}</b></div>
            <div><span>Venue</span><b>{ev.venue}</b></div>
            <div><span>Reports at</span><b>{fmtTime(ev.time)}</b></div>
            {extras.map(([l, v]) => (
              <div key={l}><span>{l}</span><b>{String(v)}</b></div>
            ))}
          </div>
          <div className="pass-perf" />
          <div className="pass-qr">
            <CodeGrid code={pass.code} />
            <span className="pass-code">{pass.code}</span>
          </div>
        </div>

        <button className="btn wide" onClick={onClose}>Done</button>
        <div className="tail" />
      </div>
    </div>
  );
}

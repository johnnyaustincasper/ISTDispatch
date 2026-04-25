import React, { useMemo, useState } from 'react';

const jobs = [
  { id: 1, time: '7:30', title: '5852 Bluestem Way', crew: 'Blow Truck 2', type: 'Fiberglass', status: 'Wrapping', temp: '67°', material: 'R13 / R30 batts', progress: 78 },
  { id: 2, time: '8:00', title: '2705 1st St, Woodward', crew: 'Blow Truck 2', type: 'Blown attic', status: 'Drive', temp: '62°', material: 'CertainTeed blown FG', progress: 34 },
  { id: 3, time: '9:15', title: '8916 S Timberwolf Dr', crew: 'Foam Truck 2', type: 'Open Cell', status: 'On site', temp: '70°', material: 'Enverge OC', progress: 55 },
];

const inventory = [
  { name: 'Blown Fiberglass', value: 0, unit: 'bags', tone: 'danger' },
  { name: 'JM R13 15x9', value: 5, unit: 'tubes', tone: 'warn' },
  { name: 'OC R19 15x8', value: 8, unit: 'tubes', tone: 'good' },
  { name: 'JM R30 24x48', value: 8, unit: 'tubes', tone: 'good' },
];

const crews = [
  { name: 'Blow Truck 1', status: 'On site', load: '92%', accent: '#3b82f6' },
  { name: 'Blow Truck 2', status: 'Material check', load: '61%', accent: '#f59e0b' },
  { name: 'Foam Truck 2', status: 'Spraying', load: '74%', accent: '#8b5cf6' },
  { name: 'Energy Seal', status: 'Complete', load: '38%', accent: '#10b981' },
];

const concepts = [
  {
    id: 'command',
    label: 'Command Center',
    tagline: 'Dark premium ops board — dispatcher first, fast scanning, high contrast.',
  },
  {
    id: 'field',
    label: 'Field Cards',
    tagline: 'Crew-first mobile redesign — giant actions, job cards, less office noise.',
  },
  {
    id: 'ledger',
    label: 'Material Ledger',
    tagline: 'Inventory/control-room redesign — loadouts, parity, and exceptions up front.',
  },
];

const toneMap = {
  danger: ['#ef4444', 'rgba(239,68,68,.15)'],
  warn: ['#f59e0b', 'rgba(245,158,11,.16)'],
  good: ['#22c55e', 'rgba(34,197,94,.14)'],
};

function Shell({ concept, setConcept, children }) {
  return (
    <div style={styles.page}>
      <div style={styles.orbA} />
      <div style={styles.orbB} />
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>IST DISPATCH · REDESIGN MOCKS</div>
          <h1 style={styles.title}>Pick the new operating system vibe.</h1>
          <p style={styles.subtle}>Three complete UI directions. Static mock data only — production app untouched.</p>
        </div>
        <div style={styles.segmented}>
          {concepts.map((item) => (
            <button key={item.id} onClick={() => setConcept(item.id)} style={{ ...styles.segment, ...(concept === item.id ? styles.segmentActive : {}) }}>
              <span>{item.label}</span>
              <small>{item.id}</small>
            </button>
          ))}
        </div>
      </header>
      {children}
    </div>
  );
}

function Metric({ label, value, foot, color = '#60a5fa' }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricGlow, background: color }} />
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.subtle}>{foot}</div>
    </div>
  );
}

function CommandCenter() {
  return (
    <main style={styles.commandGrid}>
      <section style={{ ...styles.panel, gridColumn: 'span 8' }}>
        <div style={styles.panelHead}>
          <div>
            <div style={styles.eyebrow}>LIVE SCHEDULE</div>
            <h2 style={styles.h2}>Today’s board</h2>
          </div>
          <button style={styles.primaryButton}>+ Add Job</button>
        </div>
        <div style={styles.timeline}>
          {jobs.map((job) => (
            <div key={job.id} style={styles.timelineRow}>
              <div style={styles.timePill}>{job.time}</div>
              <div style={styles.jobCardDark}>
                <div style={styles.rowBetween}>
                  <div>
                    <h3 style={styles.jobTitle}>{job.title}</h3>
                    <p style={styles.subtle}>{job.crew} · {job.type} · {job.material}</p>
                  </div>
                  <span style={styles.statusPill}>{job.status}</span>
                </div>
                <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${job.progress}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside style={{ ...styles.panel, gridColumn: 'span 4' }}>
        <div style={styles.eyebrow}>CREW STATUS</div>
        <h2 style={styles.h2}>Fleet pulse</h2>
        <div style={styles.stack}>{crews.map((crew) => <CrewPulse key={crew.name} crew={crew} />)}</div>
      </aside>
      <Metric label="Open jobs" value="14" foot="4 need PM attention" />
      <Metric label="Inventory alerts" value="6" foot="2 truck mismatches" color="#f59e0b" />
      <Metric label="Weather risk" value="Low" foot="All sites clear" color="#22c55e" />
      <Metric label="Revenue scheduled" value="$42.8k" foot="Today + tomorrow" color="#a78bfa" />
    </main>
  );
}

function CrewPulse({ crew }) {
  return (
    <div style={styles.crewPulse}>
      <div style={{ ...styles.crewAccent, background: crew.accent }} />
      <div style={{ flex: 1 }}>
        <div style={styles.rowBetween}><strong>{crew.name}</strong><span>{crew.load}</span></div>
        <div style={styles.subtle}>{crew.status}</div>
      </div>
    </div>
  );
}

function FieldCards() {
  return (
    <main style={styles.phoneWrap}>
      <section style={styles.phoneShell}>
        <div style={styles.phoneTop}>
          <div>
            <div style={styles.eyebrowLight}>GOOD MORNING, ALEX</div>
            <h2 style={styles.phoneTitle}>2 jobs · 1 material check</h2>
          </div>
          <div style={styles.weatherBadge}>67°</div>
        </div>
        <button style={styles.bigAction}>Start next job</button>
        <div style={styles.mobileTabs}><span>Route</span><span>Materials</span><span>Closeout</span></div>
        {jobs.slice(0, 2).map((job, idx) => (
          <article key={job.id} style={styles.mobileJob}>
            <div style={styles.rowBetween}>
              <div style={styles.routeBubble}>{idx + 1}</div>
              <span style={styles.mobileStatus}>{job.status}</span>
            </div>
            <h3>{job.title}</h3>
            <p>{job.type} · {job.material}</p>
            <div style={styles.mobileActions}>
              <button>On Site</button><button>Log Materials</button><button>Wrap Up</button>
            </div>
          </article>
        ))}
      </section>
      <section style={styles.fieldNotes}>
        <div style={styles.eyebrow}>DESIGN INTENT</div>
        <h2 style={styles.h2}>Make the crew side impossible to mess up.</h2>
        <p style={styles.copy}>This direction strips the app down to the next action. Huge buttons, route-first layout, material warnings in plain English, and closeout as a guided checklist.</p>
        <div style={styles.noteGrid}>
          <div>✓ One-thumb actions</div>
          <div>✓ Job cards collapse cleanly</div>
          <div>✓ Loadout warnings before closeout</div>
          <div>✓ Weather/site context baked in</div>
        </div>
      </section>
    </main>
  );
}

function MaterialLedger() {
  const totalAlerts = useMemo(() => inventory.filter((item) => item.tone !== 'good').length, []);
  return (
    <main style={styles.ledgerGrid}>
      <section style={{ ...styles.panelLight, gridColumn: 'span 5' }}>
        <div style={styles.eyebrowDark}>TRUCK LOADOUT</div>
        <h2 style={styles.h2Dark}>Blow Truck 2</h2>
        <p style={styles.copyDark}>{totalAlerts} items need review before tomorrow’s run.</p>
        <div style={styles.inventoryStack}>
          {inventory.map((item) => {
            const [color, bg] = toneMap[item.tone];
            return (
              <div key={item.name} style={styles.inventoryRow}>
                <div><strong>{item.name}</strong><span>{item.unit}</span></div>
                <b style={{ color, background: bg }}>{item.value}</b>
              </div>
            );
          })}
        </div>
      </section>
      <section style={{ ...styles.panelLight, gridColumn: 'span 7' }}>
        <div style={styles.panelHeadLight}>
          <div>
            <div style={styles.eyebrowDark}>RECONCILIATION</div>
            <h2 style={styles.h2Dark}>Material movement</h2>
          </div>
          <button style={styles.secondaryButton}>Run audit</button>
        </div>
        <div style={styles.ledgerTable}>
          {[
            ['12:12', 'Load truck', '+17 JM R13', 'Alex', 'Clean'],
            ['15:04', 'Job usage', '-12 JM R13', '5852 Bluestem', 'Matched'],
            ['15:04', 'Job usage', '-4 JM R30', '5852 Bluestem', 'Matched'],
            ['18:51', 'Closeout', '-24 Blown FG', '8556 E 32nd', 'Backfilled'],
          ].map((row) => (
            <div key={row.join()} style={styles.ledgerLine}>{row.map((cell, idx) => <span key={idx}>{cell}</span>)}</div>
          ))}
        </div>
      </section>
      <section style={{ ...styles.exceptionRail, gridColumn: 'span 12' }}>
        <strong>Exception-first workflow:</strong> red/yellow material rows open straight into the exact source event, job, or load log instead of burying the office in tables.
      </section>
    </main>
  );
}

export default function DispatchRedesignMocks() {
  const [concept, setConcept] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('concept');
    return concepts.some((item) => item.id === requested) ? requested : 'command';
  });
  const active = concepts.find((item) => item.id === concept);
  return (
    <Shell concept={concept} setConcept={setConcept}>
      <div style={styles.conceptIntro}>
        <span>{active.label}</span>
        <p>{active.tagline}</p>
      </div>
      {concept === 'command' && <CommandCenter />}
      {concept === 'field' && <FieldCards />}
      {concept === 'ledger' && <MaterialLedger />}
    </Shell>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: 24, background: '#07111f', color: '#e5edf8', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', position: 'relative', overflow: 'hidden' },
  orbA: { position: 'fixed', width: 460, height: 460, borderRadius: '50%', background: 'rgba(37,99,235,.28)', filter: 'blur(70px)', top: -160, right: -120, pointerEvents: 'none' },
  orbB: { position: 'fixed', width: 360, height: 360, borderRadius: '50%', background: 'rgba(16,185,129,.16)', filter: 'blur(80px)', bottom: -140, left: -80, pointerEvents: 'none' },
  header: { position: 'relative', zIndex: 1, display: 'flex', gap: 20, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 },
  eyebrow: { color: '#93c5fd', fontSize: 11, letterSpacing: '.18em', fontWeight: 900, textTransform: 'uppercase' },
  eyebrowLight: { color: '#bfdbfe', fontSize: 10, letterSpacing: '.16em', fontWeight: 900, textTransform: 'uppercase' },
  eyebrowDark: { color: '#2563eb', fontSize: 11, letterSpacing: '.16em', fontWeight: 900, textTransform: 'uppercase' },
  title: { margin: '6px 0', fontSize: 'clamp(30px, 5vw, 64px)', lineHeight: .95, letterSpacing: '-.06em' },
  subtle: { color: '#93a4bb', margin: 0, fontSize: 13 },
  copy: { color: '#b6c2d2', lineHeight: 1.6 },
  copyDark: { color: '#64748b', lineHeight: 1.6 },
  segmented: { display: 'flex', gap: 8, padding: 6, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, backdropFilter: 'blur(18px)' },
  segment: { border: 0, color: '#b6c2d2', background: 'transparent', borderRadius: 13, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', fontWeight: 900 },
  segmentActive: { color: '#07111f', background: '#e5edf8' },
  conceptIntro: { position: 'relative', zIndex: 1, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 },
  commandGrid: { position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 },
  panel: { background: 'rgba(15,23,42,.74)', border: '1px solid rgba(148,163,184,.22)', borderRadius: 26, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,.28)', backdropFilter: 'blur(18px)' },
  panelLight: { background: '#f8fafc', color: '#0f172a', border: '1px solid #dbe5f2', borderRadius: 28, padding: 22, boxShadow: '0 24px 70px rgba(15,23,42,.18)' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  panelHeadLight: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  h2: { margin: '4px 0 0', fontSize: 28, letterSpacing: '-.04em' },
  h2Dark: { margin: '4px 0 0', fontSize: 30, letterSpacing: '-.04em', color: '#0f172a' },
  primaryButton: { border: 0, borderRadius: 14, padding: '12px 16px', color: '#07111f', background: '#60a5fa', fontWeight: 900 },
  secondaryButton: { border: '1px solid #cbd5e1', borderRadius: 14, padding: '11px 15px', color: '#0f172a', background: '#fff', fontWeight: 900 },
  timeline: { display: 'grid', gap: 12 },
  timelineRow: { display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, alignItems: 'stretch' },
  timePill: { display: 'grid', placeItems: 'center', borderRadius: 18, background: 'rgba(96,165,250,.12)', color: '#bfdbfe', fontWeight: 900 },
  jobCardDark: { padding: 16, borderRadius: 20, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' },
  rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  jobTitle: { margin: 0, fontSize: 19 },
  statusPill: { padding: '7px 10px', borderRadius: 999, color: '#bbf7d0', background: 'rgba(34,197,94,.14)', fontSize: 12, fontWeight: 900 },
  progressTrack: { height: 7, marginTop: 14, borderRadius: 999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#60a5fa,#34d399)' },
  stack: { display: 'grid', gap: 10, marginTop: 16 },
  crewPulse: { display: 'flex', gap: 12, alignItems: 'center', padding: 13, borderRadius: 18, background: 'rgba(255,255,255,.06)' },
  crewAccent: { width: 5, height: 42, borderRadius: 999 },
  metricCard: { position: 'relative', gridColumn: 'span 3', overflow: 'hidden', padding: 18, minHeight: 110, background: 'rgba(15,23,42,.66)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 24 },
  metricGlow: { position: 'absolute', width: 90, height: 90, borderRadius: '50%', opacity: .22, filter: 'blur(24px)', right: -25, top: -18 },
  cardLabel: { color: '#9fb0c4', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' },
  metricValue: { marginTop: 8, fontSize: 34, fontWeight: 950, letterSpacing: '-.05em' },
  phoneWrap: { position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '430px 1fr', gap: 26, alignItems: 'center', maxWidth: 1120, margin: '0 auto' },
  phoneShell: { minHeight: 720, padding: 18, borderRadius: 44, background: 'linear-gradient(180deg,#eff6ff,#dbeafe)', color: '#0f172a', border: '10px solid #020617', boxShadow: '0 35px 90px rgba(0,0,0,.45)' },
  phoneTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px 18px' },
  phoneTitle: { margin: '4px 0 0', fontSize: 27, letterSpacing: '-.04em' },
  weatherBadge: { width: 58, height: 58, borderRadius: 20, display: 'grid', placeItems: 'center', background: '#fff', color: '#2563eb', fontWeight: 950 },
  bigAction: { width: '100%', border: 0, borderRadius: 24, padding: 19, background: '#2563eb', color: '#fff', fontSize: 18, fontWeight: 950, boxShadow: '0 18px 35px rgba(37,99,235,.28)' },
  mobileTabs: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '16px 0' },
  mobileJob: { padding: 18, borderRadius: 28, background: '#fff', marginBottom: 12, boxShadow: '0 12px 30px rgba(37,99,235,.10)' },
  routeBubble: { width: 36, height: 36, borderRadius: 14, background: '#e0f2fe', display: 'grid', placeItems: 'center', color: '#0369a1', fontWeight: 950 },
  mobileStatus: { borderRadius: 999, padding: '7px 10px', background: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 900 },
  mobileActions: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 },
  fieldNotes: { padding: 28, borderRadius: 34, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' },
  noteGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginTop: 18 },
  ledgerGrid: { position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 16 },
  inventoryStack: { display: 'grid', gap: 10, marginTop: 18 },
  inventoryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0' },
  ledgerTable: { display: 'grid', gap: 9 },
  ledgerLine: { display: 'grid', gridTemplateColumns: '.7fr 1.2fr 1.2fr 1.6fr 1fr', gap: 10, padding: 13, borderRadius: 15, background: '#fff', border: '1px solid #e2e8f0', color: '#334155', fontSize: 13 },
  exceptionRail: { padding: 18, borderRadius: 20, background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,.25)' },
};

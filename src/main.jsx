import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plane, CloudSun, Weight, Gauge, Fuel, Radio, ClipboardCheck, BookOpen, Save, Upload, Download, AlertTriangle } from 'lucide-react';
import './style.css';

const STORAGE_KEY = 'achaFlightCompanionV4';
const rwyHeadings = { '07': 70, '13': 130, '18': 180, '25': 250, '31': 310, '36': 360 };
const lessonPlan = {
  '9': ['Steep turns', 'Slow flight', 'Stalls', 'Recovery', 'Circuits', 'Go-around'],
  '10': ['Precautionary landing', 'PFL intro', 'Circuits', 'Go-around'],
  '11': ['Forced landing', 'Field selection', 'Restart checks', 'Mayday practice'],
  '12': ['Navigation prep', 'Dead reckoning', 'Diversion', 'RT en-route'],
  '13': ['Solo preparation', 'Circuit accuracy', 'Go-around', 'EFATO briefing'],
  '14': ['Solo circuit', 'Normal circuits', 'Radio discipline'],
};
const defaultFlight = {
  date: new Date().toISOString().slice(0, 10), lesson: '9', aircraft: 'PH-SKM', flightType: 'Dual local',
  runway: '25', windDir: 250, windKt: 8, qnh: 1015, temp: 16, visibilityKm: 10, cloudBaseFt: 2000,
  grass: 'dry', slope: 0, tora: 600, toda: 600, lda: 600,
  emptyWeight: 495, pilot: 82, instructor: 89, baggage: 2, fuelLiters: 40,
  durationMin: 75, extraFuel: 5, alternateFuel: 0,
  notams: false, discrepancy: false, stallWarning: false, fuelDrained: false, documents: false, oil: false,
  remarks: ''
};
function n(v) { return Number.isFinite(+v) ? +v : 0; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function windComponents(rwy, dir, speed) {
  const hdg = rwyHeadings[rwy] ?? n(rwy) * 10;
  const angle = ((n(dir) - hdg + 540) % 360) - 180;
  const rad = angle * Math.PI / 180;
  return { angle: Math.round(angle), head: +(n(speed) * Math.cos(rad)).toFixed(1), cross: +(n(speed) * Math.sin(rad)).toFixed(1) };
}
function pressureAltitude(qnh, elevation = 3) { return Math.round(elevation + (1013.25 - n(qnh)) * 27); }
function densityAltitude(pa, temp) { const isa = 15 - (n(pa) / 1000) * 2; return Math.round(n(pa) + 120 * (n(temp) - isa)); }
function fuelReserveLiters(f) {
  const isLocal = f.flightType.toLowerCase().includes('local') || f.flightType.toLowerCase().includes('circuit');
  return isLocal ? 19 / 6 : 19 / 2; // ACHA OM: local day 10 min, XC day 30 min; DV20 19 L/hr
}
function weatherMinima(f, c) {
  const type = f.flightType.toLowerCase();
  if (!type.includes('solo')) return [
    { label: 'Visibility ≥ 3 km', ok: n(f.visibilityKm) >= 3 },
    { label: 'Clouds ≥ 600 ft AGL', ok: n(f.cloudBaseFt) >= 600 },
    { label: 'X-wind ≤ 15 kt', ok: Math.abs(c.wind.cross) <= 15 },
  ];
  const firstSolo = type.includes('first');
  const circuit = type.includes('circuit');
  return [
    { label: 'Visibility ≥ 8 km', ok: n(f.visibilityKm) >= 8 },
    { label: `Wind ≤ ${firstSolo ? 15 : 20} kt`, ok: n(f.windKt) <= (firstSolo ? 15 : 20) },
    { label: `X-wind ≤ ${firstSolo ? 5 : 12} kt`, ok: Math.abs(c.wind.cross) <= (firstSolo ? 5 : 12) },
    { label: 'No tailwind', ok: c.wind.head >= 0 },
    { label: `Clouds ≥ ${circuit ? 1200 : 1500} ft AGL`, ok: n(f.cloudBaseFt) >= (circuit ? 1200 : 1500) },
  ];
}
function calc(f) {
  const fuelKg = n(f.fuelLiters) * 0.75;
  const tow = n(f.emptyWeight) + n(f.pilot) + n(f.instructor) + n(f.baggage) + fuelKg;
  const wind = windComponents(f.runway, f.windDir, f.windKt);
  const pa = pressureAltitude(f.qnh);
  const da = densityAltitude(pa, f.temp);
  const baseRoll = 235;
  const baseTODR = 340; // training helper baseline; final dispatch from AFM/club sheet
  const weightFactor = Math.pow(tow / 675, 2);
  const daFactor = 1 + clamp(da, 0, 6000) / 1000 * 0.08;
  const windFactor = wind.head >= 0 ? Math.max(0.7, 1 - wind.head * 0.025) : 1 + Math.abs(wind.head) * 0.05;
  const grassFactor = f.grass === 'wet' ? 1.25 : f.grass === 'dry' ? 1.20 : 1.0;
  const slopeFactor = 1 + (n(f.slope) > 0 ? n(f.slope) * 0.05 : 0);
  const roll = Math.round(baseRoll * weightFactor * daFactor * windFactor * grassFactor * slopeFactor);
  const todr = Math.round(baseTODR * weightFactor * daFactor * windFactor * grassFactor * slopeFactor);
  const soloFactor = f.flightType.toLowerCase().includes('solo') ? 1.33 : 1;
  const factoredTODR = Math.round(todr * soloFactor);
  const margin = n(f.toda) - factoredTODR;
  const trip = n(f.durationMin) / 60 * 19;
  const taxi = 2.5;
  const contingency = Math.max(trip * 0.10, 19 / 12);
  const reserve = fuelReserveLiters(f);
  const blockReq = taxi + trip + contingency + n(f.alternateFuel) + reserve + n(f.extraFuel);
  const ldr = Math.round(454 * (1 + Math.max(pa, 0) / 2500 * 0.10) * (f.grass === 'wet' ? 1.38 : f.grass === 'dry' ? 1.20 : 1.0));
  const factoredLDR = Math.round(ldr * (f.flightType.toLowerCase().includes('solo') ? 1.43 : 1));
  const landingMargin = n(f.lda) - factoredLDR;
  return { fuelKg, tow, wind, pa, da, roll, todr, factoredTODR, margin, marginPct: Math.round(margin / Math.max(n(f.toda), 1) * 100), trip, taxi, contingency, reserve, blockReq, ldr, factoredLDR, landingMargin };
}
function Field({ label, value, onChange, type = 'number', suffix }) {
  return <label className="field"><span>{label}</span><div><input type={type} value={value} onChange={e => onChange(e.target.value)} />{suffix && <b>{suffix}</b>}</div></label>;
}
function Select({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></label>;
}
function Section({ icon: Icon, title, children }) { return <section className="card"><h2><Icon size={20} />{title}</h2>{children}</section>; }
function App() {
  const [f, setF] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultFlight);
  const c = useMemo(() => calc(f), [f]);
  const minima = useMemo(() => weatherMinima(f, c), [f, c]);
  const ready = c.margin >= 0 && c.landingMargin >= 0 && c.tow <= 730 && minima.every(m => m.ok) && f.notams && f.discrepancy && f.stallWarning && f.fuelDrained;
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(f)), [f]);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const reset = () => confirm('Nieuwe vlucht starten?') && setF(defaultFlight);
  function exportJson() { const blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `acha-flight-${f.date}-les-${f.lesson}.json`; a.click(); }
  function importJson(e) { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => setF(JSON.parse(r.result)); r.readAsText(file); }
  return <main>
    <header className="hero"><div><p className="eyebrow">ACHA + DV20 + EHHV</p><h1><Plane /> Flight Companion v4</h1><p>Pre-flight assistant volgens ACHA workflow. Offline autosave, export/import en GitHub Pages-ready.</p></div><div className={ready ? 'status go' : 'status check'}>{ready ? 'READY' : 'CHECK'}</div></header>
    <nav className="toolbar"><button onClick={reset}>Nieuwe vlucht</button><button onClick={exportJson}><Download size={16}/>Export</button><label className="button"><Upload size={16}/>Import<input hidden type="file" accept="application/json" onChange={importJson}/></label><span><Save size={16}/>Autosave</span></nav>
    <div className="grid">
      <Section icon={CloudSun} title="1. Weather & Runway"><div className="fields"><Field label="Datum" type="date" value={f.date} onChange={v=>set('date',v)}/><Field label="Les" value={f.lesson} onChange={v=>set('lesson',v)}/><Select label="Flight type" value={f.flightType} onChange={v=>set('flightType',v)} options={['Dual local','Solo circuit','First solo circuit','Dual navigation','Solo navigation']}/><Select label="RWY" value={f.runway} onChange={v=>set('runway',v)} options={Object.keys(rwyHeadings)}/><Field label="Wind dir" value={f.windDir} onChange={v=>set('windDir',v)} suffix="°"/><Field label="Wind" value={f.windKt} onChange={v=>set('windKt',v)} suffix="kt"/><Field label="QNH" value={f.qnh} onChange={v=>set('qnh',v)}/><Field label="Temp" value={f.temp} onChange={v=>set('temp',v)} suffix="°C"/><Field label="Vis" value={f.visibilityKm} onChange={v=>set('visibilityKm',v)} suffix="km"/><Field label="Cloud base" value={f.cloudBaseFt} onChange={v=>set('cloudBaseFt',v)} suffix="ft"/><Select label="Surface" value={f.grass} onChange={v=>set('grass',v)} options={['dry','wet','paved']}/></div><div className="result"><b>HW/XW</b><span>{c.wind.head} / {Math.abs(c.wind.cross)} kt</span><b>PA/DA</b><span>{c.pa} / {c.da} ft</span></div></Section>
      <Section icon={Weight} title="2. Flight Loading"><div className="fields"><Field label="Empty W" value={f.emptyWeight} onChange={v=>set('emptyWeight',v)} suffix="kg"/><Field label="Pilot" value={f.pilot} onChange={v=>set('pilot',v)} suffix="kg"/><Field label="FI/Pax" value={f.instructor} onChange={v=>set('instructor',v)} suffix="kg"/><Field label="Baggage" value={f.baggage} onChange={v=>set('baggage',v)} suffix="kg"/><Field label="Fuel" value={f.fuelLiters} onChange={v=>set('fuelLiters',v)} suffix="L"/></div><div className="big"><span>TOW</span><strong>{Math.round(c.tow)} kg</strong><em>{c.tow <= 730 ? '≤ 730 OK' : 'MTOW exceeded'}</em></div></Section>
      <Section icon={Gauge} title="3. Performance"><div className="fields"><Field label="TORA" value={f.tora} onChange={v=>set('tora',v)} suffix="m"/><Field label="TODA" value={f.toda} onChange={v=>set('toda',v)} suffix="m"/><Field label="LDA" value={f.lda} onChange={v=>set('lda',v)} suffix="m"/><Field label="Slope up" value={f.slope} onChange={v=>set('slope',v)} suffix="%"/></div><div className="result"><b>Roll</b><span>{c.roll} m</span><b>TODR</b><span>{c.todr} m</span><b>Fact. TODR</b><span>{c.factoredTODR} m</span><b>Margin</b><span>{c.margin} m ({c.marginPct}%)</span><b>LDR</b><span>{c.factoredLDR} m</span><b>Ldg margin</b><span>{c.landingMargin} m</span></div><p className="note"><AlertTriangle size={14}/> Training helper. Gebruik voor dispatch AFM/clubformulier en FI-goedkeuring.</p></Section>
      <Section icon={Fuel} title="4. Fuel"><div className="fields"><Field label="Duration" value={f.durationMin} onChange={v=>set('durationMin',v)} suffix="min"/><Field label="Alternate" value={f.alternateFuel} onChange={v=>set('alternateFuel',v)} suffix="L"/><Field label="Extra" value={f.extraFuel} onChange={v=>set('extraFuel',v)} suffix="L"/></div><div className="result"><b>Taxi</b><span>{c.taxi.toFixed(1)} L</span><b>Trip</b><span>{c.trip.toFixed(1)} L</span><b>Cont.</b><span>{c.contingency.toFixed(1)} L</span><b>FRF</b><span>{c.reserve.toFixed(1)} L</span><b>Block req.</b><span>{c.blockReq.toFixed(1)} L</span></div></Section>
      <Section icon={ClipboardCheck} title="5. Minima & Checks"><h3>Weather minima</h3><div className="checks">{minima.map(m => <label key={m.label} className={m.ok ? 'ok' : 'bad'}><input type="checkbox" checked={m.ok} readOnly />{m.label}</label>)}</div><h3>ACHA pre-flight</h3><div className="checks">{[['notams','NOTAMs checked'],['discrepancy','Discrepancy log checked'],['stallWarning','Stall warning checked'],['fuelDrained','Fuel drained'],['documents','Documents'],['oil','Oil checked']].map(([k,t]) => <label key={k}><input type="checkbox" checked={!!f[k]} onChange={e=>set(k,e.target.checked)} />{t}</label>)}</div></Section>
      <Section icon={Radio} title="6. Radio"><div className="freq"><span>Hilversum Radio</span><b>131.030</b><span>Dutch Mil</span><b>132.350</b><span>Amsterdam Info</span><b>124.300</b></div></Section>
      <Section icon={BookOpen} title="7. Lesson & Briefing"><h3>Les {f.lesson}</h3><ul>{(lessonPlan[f.lesson] || ['Local training','Aircraft handling','Circuits']).map(x => <li key={x}>{x}</li>)}</ul><h3>EFATO</h3><p>59 kt · land ahead / small deviation · fuel pump ON · carb heat OFF · PIC/FI.</p><textarea value={f.remarks} onChange={e=>set('remarks', e.target.value)} placeholder="Remarks / FI notes" /></Section>
    </div>
    <footer>ACHA Flight Companion v4 · React PWA · local-first · gemaakt voor iPhone + Samsung</footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App />);

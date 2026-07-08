import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plane, CloudSun, Weight, Gauge, Fuel, Radio, ClipboardCheck, Footprints, BookOpen, Download, Upload, Save, Search, PlusCircle, RotateCcw } from 'lucide-react';
import './style.css';

const profiles = {
  'PH-SKM': {
    registration: 'PH-SKM', callsign: 'PH-SKM', aircraft: 'Diamond DV20 Katana', type: 'DV20',
    mtow: 730, mlw: 730, emptyWeight: 495, emptyMoment: 0, fuelCapacity: 79, usableFuel: 77, fuelDensity: 0.75,
    fuelBurn: 19, taxiFuel: 2.5, maxBaggage: 20, maxSeat: 110,
    speeds: { vr: 51, vx: 58, vyTO: 65, vyClean: 70, approach: 59, final: 60, glide730: 70, efato: 59, vfe: 81, va: 104 },
    performance: { baseTODR: 340, baseRoll: 235, baseLDR: 454, baseLandingRoll: 228, refWeight: 675 },
    notes: 'Local DV20 profile. Controleer altijd actuele PH-SKM weighing report en AFM.'
  },
  'PH-DON': {
    registration: 'PH-DON', callsign: 'PH-DON', aircraft: 'Cessna 172', type: 'C172',
    mtow: 1111, mlw: 1111, emptyWeight: 760, emptyMoment: 0, fuelCapacity: 212, usableFuel: 200, fuelDensity: 0.72,
    fuelBurn: 32, taxiFuel: 4.2, maxBaggage: 54, maxSeat: 120,
    speeds: { vr: 55, vx: 62, vyTO: 74, vyClean: 74, approach: 65, final: 65, glide730: 65, efato: 65, vfe: 85, va: 105 },
    performance: { baseTODR: 430, baseRoll: 280, baseLDR: 450, baseLandingRoll: 250, refWeight: 1040 },
    notes: 'C172 profile is indicatief. Vul echte aircraft data in.'
  }
};

const DEFAULT_AIRPORTS = {
  EHHV: {
    icao: 'EHHV', name: 'Hilversum', elevationFt: 3,
    source: 'Local ACHA/eAIP profile - verify current eAIP and NOTAMs before flight',
    runways: {
      '07': { designator:'07', heading:70, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
      '13': { designator:'13', heading:130, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
      '18': { designator:'18', heading:180, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
      '25': { designator:'25', heading:250, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
      '31': { designator:'31', heading:310, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
      '36': { designator:'36', heading:360, surface:'grass', grass:'dry', slope:0, tora:600, toda:600, asda:600, lda:600 },
    }
  }
};
function cloneDefaultAirports(){ return JSON.parse(JSON.stringify(DEFAULT_AIRPORTS)) }
function runwayList(db, airport){ return Object.keys(db?.[airport]?.runways || {}).sort((a,b)=>n(a)-n(b)) }
function getRunway(db, airport, runway){ return db?.[airport]?.runways?.[runway] || null }
function normalizeRunway(v){
  const raw = String(v || '').trim().toUpperCase().replace(/^RWY\s*/, '');
  const m = raw.match(/^(\d{1,2})([LRC])?$/);
  if(!m) return raw || '25';
  return m[1].padStart(2,'0') + (m[2] || '');
}
function estimateHeadingFromRunway(rwy){
  const m = String(rwy).match(/^(\d{2})/);
  const nr = m ? Number(m[1]) : 0;
  return nr === 36 ? 360 : nr * 10;
}
const lessons = {
  '9':['Steep turns','Slow flight','Stalls','Recovery','Circuits','Go-around'],
  '10':['Precautionary landing','PFL intro','Circuits','Go-around'],
  '11':['Forced landing','Field selection','Restart checks','Mayday practice'],
  '12':['Navigation prep','Dead reckoning','Diversion','RT en-route'],
  '13':['Circuit consolidation','Solo preparation','Emergencies','RT'],
  '14':['Solo circuit','Normal circuits','Go-around decision'],
};

const defaultFlight = {
  date: new Date().toISOString().slice(0,10), lesson: '9', callsign: 'PH-SKM', aircraft: 'PH-SKM', flightType: 'Dual local',
  airport: 'EHHV', runway: '25', windDir: 250, windKt: 8, qnh: 1015, temp: 16, visibility: 10, cloudBase: 2000,
  grass: 'dry', runwayHeading: 250, surface: 'grass', slope: 0, tora: 600, toda: 600, asda: 600, lda: 600,
  emptyWeight: profiles['PH-SKM'].emptyWeight, emptyMoment: 0, pilot: 82, instructor: 89, baggage: 2, fuelLiters: 40,
  durationMin: 75, alternateFuel: 0, extraFuel: 5,
  notams:false, discrepancy:false, stallWarning:false, fuelDrained:false, oilChecked:false, docsChecked:false, walkaround:false,
  logBlock:'', logAirborne:'', logLandings:'', logRemarks:'', onlineStatus:'Local profile loaded'
};

function n(v){ return Number.isFinite(+v) ? +v : 0 }
function clamp(x,a,b){ return Math.max(a, Math.min(b,x)) }
function normReg(v){ return String(v || '').trim().toUpperCase().replace(/\s+/g,'-') }
function windComponents(rwy, dir, speed, runwayHeading){
  const hdg = n(runwayHeading) || estimateHeadingFromRunway(rwy);
  const angle = ((n(dir) - hdg + 540) % 360) - 180;
  const rad = angle * Math.PI/180;
  return { angle: Math.round(angle), head: +(n(speed)*Math.cos(rad)).toFixed(1), cross: +(n(speed)*Math.sin(rad)).toFixed(1) };
}
function pressureAlt(qnh, elev=3){ return Math.round(elev + (1013.25 - n(qnh)) * 27) }
function densityAlt(pa,temp){ const isa = 15 - (n(pa)/1000)*2; return Math.round(n(pa) + 120*(n(temp)-isa)) }
function grassTakeoffFactor(grass){ return grass === 'wet' ? 1.25 : grass === 'dry' ? 1.20 : 1.0 }
function grassLandingFactor(grass){ return grass === 'wet' ? 1.38 : grass === 'dry' ? 1.20 : 1.0 }
function isSolo(f){ return String(f.flightType).toLowerCase().includes('solo') }
function isLocal(f){ return String(f.flightType).toLowerCase().includes('local') || String(f.flightType).toLowerCase().includes('circuit') }

function calc(f){
  const p = profiles[normReg(f.aircraft)] || profiles[normReg(f.callsign)] || profiles['PH-SKM'];
  const fuelKg = n(f.fuelLiters) * p.fuelDensity;
  const tow = n(f.emptyWeight) + n(f.pilot) + n(f.instructor) + n(f.baggage) + fuelKg;
  const wc = windComponents(f.runway, f.windDir, f.windKt, f.runwayHeading);
  const pa = pressureAlt(f.qnh);
  const da = densityAlt(pa, f.temp);
  const weightFactor = Math.pow(tow / p.performance.refWeight, 2);
  const daFactor = 1 + clamp(da,0,6000) / 1000 * 0.08;
  const windFactorTO = wc.head >= 0 ? Math.max(0.70, 1 - wc.head * 0.025) : 1 + Math.abs(wc.head) * 0.05;
  const slopeTO = 1 + (n(f.slope) > 0 ? n(f.slope) * 0.05 : 0);
  const todrRaw = Math.round(p.performance.baseTODR * weightFactor * daFactor * windFactorTO * grassTakeoffFactor(f.grass) * slopeTO);
  const rollRaw = Math.round(p.performance.baseRoll * weightFactor * daFactor * windFactorTO * grassTakeoffFactor(f.grass) * slopeTO);
  const soloTO = isSolo(f) ? 1.33 : 1;
  const todr = Math.round(todrRaw * soloTO);
  const landingDA = 1 + clamp(da,0,6000) / 2500 * 0.10;
  const landingWind = wc.head >= 0 ? Math.max(0.75, 1 - wc.head * 0.015) : 1 + Math.abs(wc.head) * 0.05;
  const ldrRaw = Math.round(p.performance.baseLDR * landingDA * landingWind * grassLandingFactor(f.grass));
  const ldr = Math.round(ldrRaw * (isSolo(f) ? 1.43 : 1));
  const tripFuel = n(f.durationMin)/60 * p.fuelBurn;
  const taxi = p.taxiFuel;
  const contingency = Math.max(tripFuel * 0.10, p.fuelBurn / 12);
  const finalReserve = isLocal(f) ? p.fuelBurn / 6 : p.fuelBurn / 2;
  const blockFuel = taxi + tripFuel + contingency + n(f.alternateFuel) + finalReserve + n(f.extraFuel);
  const weatherDualOK = n(f.visibility) >= 3 && n(f.cloudBase) >= 600 && Math.abs(wc.cross) <= 15;
  const weatherSoloCircuitOK = n(f.visibility) >= 8 && n(f.windKt) <= 20 && Math.abs(wc.cross) <= 12 && wc.head >= 0 && n(f.cloudBase) >= 1200;
  const firstSoloOK = n(f.visibility) >= 8 && n(f.windKt) <= 15 && Math.abs(wc.cross) <= 5 && wc.head >= 0 && n(f.cloudBase) >= 1700;
  const mtowOK = tow <= p.mtow;
  const runwayOK = todr <= n(f.toda) && ldr <= n(f.lda);
  const fuelOK = n(f.fuelLiters) >= blockFuel;
  return { p, fuelKg, tow, wc, pa, da, rollRaw, todrRaw, todr, ldrRaw, ldr, marginTO:n(f.toda)-todr, marginLDG:n(f.lda)-ldr, tripFuel, taxi, contingency, finalReserve, blockFuel, mtowOK, runwayOK, fuelOK, weatherDualOK, weatherSoloCircuitOK, firstSoloOK };
}

function Field({label,value,onChange,type='number',suffix,placeholder}){
  return <label className="field"><span>{label}</span><div><input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />{suffix && <b>{suffix}</b>}</div></label>
}
function Select({label,value,onChange,children}){ return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label> }
function Section({id,icon:Icon,title,children}){ return <section className="card" id={id}><h2><Icon size={20}/>{title}</h2>{children}</section> }
function Badge({ok,children}){ return <span className={ok?'badge ok':'badge warn'}>{children}</span> }
function Result({items}){ return <div className="result">{items.map(([k,v],i)=><React.Fragment key={i}><b>{k}</b><span>{v}</span></React.Fragment>)}</div> }

function App(){
  const [airportDb,setAirportDb] = useState(()=>JSON.parse(localStorage.getItem('achaAirportsV6') || 'null') || cloneDefaultAirports());
  const [f,setF] = useState(()=>JSON.parse(localStorage.getItem('achaFlightV6') || 'null') || defaultFlight);
  const [lookupBusy,setLookupBusy] = useState(false);
  const [newRunway,setNewRunway] = useState('');
  const c = useMemo(()=>calc(f),[f]);
  useEffect(()=>localStorage.setItem('achaFlightV6',JSON.stringify(f)),[f]);
  useEffect(()=>localStorage.setItem('achaAirportsV6',JSON.stringify(airportDb)),[airportDb]);
  const set = (k,v)=>setF(prev=>({...prev,[k]:v}));
  const applyRunway = (runway, db = airportDb, airport = f.airport) => {
    const key = normalizeRunway(runway);
    const rw = getRunway(db, airport, key);
    if(!rw){ setF(prev=>({...prev, runway:key, runwayHeading:estimateHeadingFromRunway(key)})); return; }
    setF(prev=>({
      ...prev,
      runway:key,
      runwayHeading:rw.heading,
      surface:rw.surface || 'grass',
      grass:rw.grass || (rw.surface === 'paved' ? 'paved' : 'dry'),
      slope:rw.slope ?? 0,
      tora:rw.tora ?? prev.tora,
      toda:rw.toda ?? prev.toda,
      asda:rw.asda ?? prev.asda,
      lda:rw.lda ?? prev.lda,
    }));
  };
  const setRunwayField = (key, value) => {
    setF(prev => ({...prev, [key === 'heading' ? 'runwayHeading' : key]: value}));
    setAirportDb(prev => {
      const airport = f.airport || 'EHHV';
      const runway = normalizeRunway(f.runway || '25');
      const next = JSON.parse(JSON.stringify(prev));
      next[airport] ||= { icao: airport, name: airport, elevationFt: 0, source: 'User created', runways: {} };
      next[airport].runways[runway] ||= { designator: runway, heading: estimateHeadingFromRunway(runway), surface:'grass', grass:'dry', slope:0, tora:0, toda:0, asda:0, lda:0 };
      next[airport].runways[runway][key] = ['heading','tora','toda','asda','lda','slope'].includes(key) ? n(value) : value;
      return next;
    });
  };
  const addRunway = () => {
    const key = normalizeRunway(newRunway);
    if(!key) return;
    setAirportDb(prev => {
      const airport = f.airport || 'EHHV';
      const next = JSON.parse(JSON.stringify(prev));
      next[airport] ||= { icao: airport, name: airport, elevationFt: 0, source: 'User created', runways: {} };
      next[airport].runways[key] ||= {
        designator:key,
        heading: estimateHeadingFromRunway(key),
        surface: f.surface || 'grass',
        grass: f.grass || 'dry',
        slope: n(f.slope),
        tora: n(f.tora),
        toda: n(f.toda),
        asda: n(f.asda),
        lda: n(f.lda)
      };
      setTimeout(()=>applyRunway(key, next, airport), 0);
      return next;
    });
    setNewRunway('');
  };
  const resetRunways = () => { const db = cloneDefaultAirports(); setAirportDb(db); setTimeout(()=>applyRunway(f.runway, db, f.airport), 0); };
  const applyProfile = (reg)=>{
    const key = normReg(reg);
    const p = profiles[key];
    if(!p){ setF(prev=>({...prev, callsign:key, aircraft:key, onlineStatus:'Geen lokaal profiel gevonden. Vul data handmatig in.'})); return; }
    setF(prev=>({...prev, callsign:key, aircraft:key, emptyWeight:p.emptyWeight, fuelLiters: Math.min(prev.fuelLiters || 40, p.usableFuel), onlineStatus:`Lokaal profiel geladen: ${p.aircraft}`}));
  };
  async function lookupAircraft(){
    const reg = normReg(f.callsign);
    applyProfile(reg);
    setLookupBusy(true);
    try {
      // Static GitHub Pages cannot guarantee registry lookup due to CORS/API limits.
      // This endpoint may return live metadata for some aircraft; local profile remains authoritative for W&B/performance.
      const res = await fetch(`https://api.adsb.lol/v2/registration/${encodeURIComponent(reg)}`, { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        const ac = data?.ac?.[0] || data?.aircraft?.[0] || null;
        if(ac){ setF(prev=>({...prev, onlineStatus:`Online info gevonden: ${ac.t || ac.type || ''} ${ac.desc || ac.r || reg}`.trim()})); }
      }
    } catch(e) { /* expected on some browsers due to CORS/network */ }
    finally { setLookupBusy(false); }
  }
  function exportJson(){ const blob = new Blob([JSON.stringify(f,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`acha-flight-${f.date}-${f.callsign}.json`; a.click(); }
  function importJson(e){ const file=e.target.files?.[0]; if(!file) return; const r=new FileReader(); r.onload=()=>setF(JSON.parse(r.result)); r.readAsText(file); }
  const overallOK = c.mtowOK && c.runwayOK && c.fuelOK && Math.abs(c.wc.cross) <= 15;
  return <main>
    <header className="hero"><div><h1><Plane/> ACHA Flight Companion</h1><p>v6 · editable runways · ACHA workflow · aircraft profiles · online callsign lookup scaffold</p></div><div className={overallOK?'status go':'status nogo'}>{overallOK?'READY':'CHECK'}</div></header>
    <nav className="topnav"><a href="#weather">🌤 Weather</a><a href="#loading">⚖️ Loading</a><a href="#performance">✈️ Performance</a><a href="#fuel">⛽ Fuel</a><a href="#radio">📻 Radio</a><a href="#briefing">📋 Briefing</a><a href="#walkaround">✅ Walkaround</a><a href="#logbook">📒 Logbook</a></nav>
    <section className="card callout"><h2><Search size={20}/> Aircraft / callsign lookup</h2><div className="lookup"><Field label="Callsign / registration" type="text" value={f.callsign} onChange={v=>set('callsign',v)} placeholder="PH-SKM"/><button onClick={lookupAircraft} disabled={lookupBusy}><Search size={16}/>{lookupBusy?'Zoeken...':'Lookup & laad profiel'}</button></div><p>{f.onlineStatus}</p><p className="note">Voor W&B en performance gebruikt de app lokale, gecontroleerde aircraft profiles. Online bronnen zijn aanvullend en kunnen door CORS/API-beperkingen niet altijd werken.</p></section>
    <div className="grid">
      <Section id="weather" icon={CloudSun} title="1. 🌤 Weather & Runway">
        <div className="fields"><Field label="Date" type="date" value={f.date} onChange={v=>set('date',v)}/><Field label="Lesson" value={f.lesson} onChange={v=>set('lesson',v)}/><Select label="Flight type" value={f.flightType} onChange={v=>set('flightType',v)}><option>Dual local</option><option>Solo circuit</option><option>First solo circuit</option><option>Dual navigation</option><option>Solo navigation</option></Select><Field label="Airport" type="text" value={f.airport} onChange={v=>set('airport',String(v).toUpperCase())}/><Select label="RWY" value={f.runway} onChange={v=>applyRunway(v)}>{runwayList(airportDb, f.airport).map(r=><option key={r}>{r}</option>)}</Select><Field label="RWY heading" value={f.runwayHeading} onChange={v=>setRunwayField('heading',v)} suffix="°"/><Field label="Wind dir" value={f.windDir} onChange={v=>set('windDir',v)} suffix="°"/><Field label="Wind" value={f.windKt} onChange={v=>set('windKt',v)} suffix="kt"/><Field label="QNH" value={f.qnh} onChange={v=>set('qnh',v)}/><Field label="Temp" value={f.temp} onChange={v=>set('temp',v)} suffix="°C"/><Field label="Visibility" value={f.visibility} onChange={v=>set('visibility',v)} suffix="km"/><Field label="Cloud base" value={f.cloudBase} onChange={v=>set('cloudBase',v)} suffix="ft"/><Select label="Surface" value={f.grass} onChange={v=>setRunwayField('grass',v)}><option value="dry">Grass dry</option><option value="wet">Grass wet</option><option value="paved">Paved</option></Select></div>
        <div className="runwayTools"><Field label="New runway" type="text" value={newRunway} onChange={v=>setNewRunway(v)} placeholder="09"/><button onClick={addRunway}><PlusCircle size={16}/>Nieuwe runway</button><button onClick={resetRunways}><RotateCcw size={16}/>Reset EHHV</button></div>
        <p className="note">Wijzigingen aan heading, surface, TORA, TODA, ASDA, LDA en slope worden automatisch opgeslagen bij RWY {f.runway}. Selecteer je later dezelfde runway, dan worden jouw waarden weer geladen.</p>
        <Result items={[["Headwind", `${c.wc.head} kt`],["Crosswind", `${Math.abs(c.wc.cross)} kt`],["PA / DA", `${c.pa} / ${c.da} ft`],["Dual minima", c.weatherDualOK?'OK':'CHECK'],["Solo circuit", c.weatherSoloCircuitOK?'OK':'CHECK']]}/>
      </Section>
      <Section id="loading" icon={Weight} title="2. ⚖️ Flight Loading">
        <div className="fields"><Field label="Aircraft" type="text" value={f.aircraft} onChange={v=>set('aircraft',v)}/><Field label="Empty W" value={f.emptyWeight} onChange={v=>set('emptyWeight',v)} suffix="kg"/><Field label="Pilot" value={f.pilot} onChange={v=>set('pilot',v)} suffix="kg"/><Field label="FI/Pax" value={f.instructor} onChange={v=>set('instructor',v)} suffix="kg"/><Field label="Baggage" value={f.baggage} onChange={v=>set('baggage',v)} suffix="kg"/><Field label="Fuel" value={f.fuelLiters} onChange={v=>set('fuelLiters',v)} suffix="L"/></div>
        <div className="big"><span>TOW</span><strong>{Math.round(c.tow)} kg</strong><em>{c.mtowOK ? `≤ ${c.p.mtow} kg OK` : `MTOW ${c.p.mtow} exceeded`}</em></div><p className="note">CG is voorbereid als veld; exacte CG vereist actuele PH-SKM weighing report.</p>
      </Section>
      <Section id="performance" icon={Gauge} title="3. ✈️ Performance Calculator (DV20)">
        <div className="fields"><Field label="TORA" value={f.tora} onChange={v=>setRunwayField('tora',v)} suffix="m"/><Field label="TODA" value={f.toda} onChange={v=>setRunwayField('toda',v)} suffix="m"/><Field label="ASDA" value={f.asda} onChange={v=>setRunwayField('asda',v)} suffix="m"/><Field label="LDA" value={f.lda} onChange={v=>setRunwayField('lda',v)} suffix="m"/><Field label="Slope up" value={f.slope} onChange={v=>setRunwayField('slope',v)} suffix="%"/></div>
        <Result items={[["Roll", `${c.rollRaw} m`],["TODR raw", `${c.todrRaw} m`],[isSolo(f)?"TODR ×1.33":"TODR", `${c.todr} m`],["T/O margin", `${c.marginTO} m`],[isSolo(f)?"LDR ×1.43":"LDR", `${c.ldr} m`],["LDG margin", `${c.marginLDG} m`]]}/>
        <p className="note">Indicatief. Dispatch: gebruik actuele AFM/POH, clubformulier en instructeurcontrole.</p>
      </Section>
      <Section id="fuel" icon={Fuel} title="4. ⛽ Fuel Planning (ACHA)">
        <div className="fields"><Field label="Duration" value={f.durationMin} onChange={v=>set('durationMin',v)} suffix="min"/><Field label="Alternate" value={f.alternateFuel} onChange={v=>set('alternateFuel',v)} suffix="L"/><Field label="Extra" value={f.extraFuel} onChange={v=>set('extraFuel',v)} suffix="L"/></div>
        <Result items={[["Taxi", `${c.taxi.toFixed(1)} L`],["Trip", `${c.tripFuel.toFixed(1)} L`],["Cont.", `${c.contingency.toFixed(1)} L`],["FRF", `${c.finalReserve.toFixed(1)} L`],["Block req.", `${c.blockFuel.toFixed(1)} L`],["On board", `${n(f.fuelLiters).toFixed(1)} L`]]}/>
        <div className="badges"><Badge ok={c.fuelOK}>{c.fuelOK?'Fuel OK':'Fuel CHECK'}</Badge></div>
      </Section>
      <Section id="radio" icon={Radio} title="5. 📻 Radio">
        <div className="freq"><span>Hilversum Radio</span><b>131.030</b><span>Dutch Mil Info</span><b>132.350</b><span>Amsterdam Info</span><b>124.300</b><span>Emergency</span><b>121.500</b></div>
      </Section>
      <Section id="briefing" icon={ClipboardCheck} title="6. 📋 Briefing">
        <div className="brief"><p><b>RWY {f.runway}</b> · wind {f.windDir}/{f.windKt} · HW {c.wc.head} kt · XW {Math.abs(c.wc.cross)} kt</p><p><b>EFATO:</b> {c.p.speeds.efato} kt, land ahead / small deviation, instructor PIC.</p><p><b>Threats:</b> gliders, circuit traffic, birds, thermals, grass condition, NOTAMs.</p><p><b>Lesson {f.lesson}:</b> {(lessons[f.lesson] || ['Local training','Circuits','Handling']).join(', ')}</p></div>
      </Section>
      <Section id="walkaround" icon={Footprints} title="7. ✅ Walkaround">
        <div className="checks">{['notams:NOTAMs checked','discrepancy:Discrepancy log checked','stallWarning:Stall warning checked','fuelDrained:Fuel drained','oilChecked:Oil level reported','docsChecked:Documents/charts checked','walkaround:Walkaround complete'].map(x=>{const [k,t]=x.split(':'); return <label key={k}><input type="checkbox" checked={!!f[k]} onChange={e=>set(k,e.target.checked)}/>{t}</label>})}</div>
      </Section>
      <Section id="logbook" icon={BookOpen} title="8. 📒 Logbook">
        <div className="fields"><Field label="Block time" type="text" value={f.logBlock} onChange={v=>set('logBlock',v)} placeholder="1:25"/><Field label="Airborne" type="text" value={f.logAirborne} onChange={v=>set('logAirborne',v)} placeholder="1:05"/><Field label="Landings" value={f.logLandings} onChange={v=>set('logLandings',v)}/></div>
        <label className="textarea"><span>Remarks / next lesson</span><textarea value={f.logRemarks} onChange={e=>set('logRemarks',e.target.value)} placeholder="Wat ging goed? Wat oefenen?" /></label>
      </Section>
    </div>
    <nav className="bottom"><button onClick={exportJson}><Download size={16}/>Export</button><label className="button"><Upload size={16}/>Import<input hidden type="file" accept="application/json" onChange={importJson}/></label><span><Save size={16}/> Autosave</span></nav>
    <footer>ACHA Flight Companion v6 · local-first · geschikt voor iPhone, Samsung en GitHub Pages</footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>);

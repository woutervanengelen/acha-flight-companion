import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CloudSun, Weight, Gauge, Fuel, Radio, ClipboardCheck, BookOpen, Database, Plane, Save, Download, Trash2, Copy, Printer } from 'lucide-react'
import { aircraftProfiles } from './data/aircraft.js'
import { airports } from './data/airports.js'
import { lessonProfiles } from './data/lessons.js'
import { calculateFuel, calculatePerformance } from './calculations/performance.js'
import { deleteFlight, listFlights, saveFlight } from './db/store.js'
import { exportWordHtml } from './export/wordExport.js'
import './styles/app.css'

const newId = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
const defaultFlight = () => ({
  id: newId(), status: 'Planned', date: new Date().toISOString().slice(0,10), lesson: '9', aircraft: 'PH-SKM', airport: 'EHHV', runway: '25', flightType: 'Dual local',
  windDir: 250, windKt: 8, qnh: 1015, tempC: 16, visibilityKm: 10, cloudBaseFt: 2000,
  pilotKg: 82, instructorKg: 89, baggageKg: 2, fuelLiters: 40, durationMin: 75, extraFuelLiters: 5,
  checks: { notams:false, discrepancy:false, fuelDrained:false, oil:false, stallWarning:false, walkaround:false }, notes: ''
})

function Field({ label, value, onChange, type = 'number', suffix, options }) {
  return <label className="field"><span>{label}</span>{options ? <select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select> : <input type={type} value={value} onChange={e=>onChange(type === 'number' ? e.target.value : e.target.value)} />}{suffix && <small>{suffix}</small>}</label>
}
function Section({ title, icon: Icon, children, full }) { return <section className={`card ${full?'full':''}`}><h2><Icon size={20}/>{title}</h2>{children}</section> }
function App() {
  const [flight, setFlight] = useState(defaultFlight)
  const [flights, setFlights] = useState([])
  const [tab, setTab] = useState('prepare')
  const aircraft = aircraftProfiles[flight.aircraft] || aircraftProfiles['PH-SKM']
  const airport = airports[flight.airport] || airports.EHHV
  const runway = airport.runways[flight.runway] || Object.values(airport.runways)[0]
  const lessons = lessonProfiles[flight.lesson] || ['Local training', 'Circuits', 'Handling']
  const performance = useMemo(()=>calculatePerformance({ flight, aircraft, airport, runway }), [flight, aircraft, airport, runway])
  const fuel = useMemo(()=>calculateFuel(flight), [flight])

  useEffect(()=>{ listFlights().then(setFlights).catch(console.error) }, [])
  useEffect(()=>{ localStorage.setItem('currentFlightDraft', JSON.stringify(flight)) }, [flight])
  const set = (k,v) => setFlight(prev => ({...prev, [k]:v}))
  const setCheck = (k,v) => setFlight(prev => ({...prev, checks:{...prev.checks, [k]:v}}))
  async function save() { await saveFlight(flight); setFlights(await listFlights()) }
  async function remove(id) { await deleteFlight(id); setFlights(await listFlights()) }
  function duplicate(f) { setFlight({ ...f, id:newId(), date:new Date().toISOString().slice(0,10), status:'Planned' }); setTab('prepare') }
  function load(f) { setFlight(f); setTab('prepare') }
  function word() { exportWordHtml({ flight, aircraft, airport, runway, performance, fuel, lessons }) }

  return <main className="app">
    <header className="top"><div className="brand"><h1><Plane/> ACHA Flight Companion</h1><p>Release 1.0 Foundation · lokale database · Word-export · EHHV/DV20 basis</p></div><div className={`status ${performance.margin >= 0 && performance.towKg <= aircraft.mtowKg ? 'go' : 'check'}`}>{performance.margin >= 0 ? 'GO' : 'CHECK'}</div></header>
    <nav className="tabs"><button className={tab==='prepare'?'active':''} onClick={()=>setTab('prepare')}>Vlucht voorbereiden</button><button className={tab==='database'?'active':''} onClick={()=>setTab('database')}>Database</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Databases</button></nav>
    <div className="toolbar"><button onClick={()=>setFlight(defaultFlight())}>Nieuwe vlucht</button><button onClick={save}><Save size={16}/> Opslaan</button><button onClick={word}><Download size={16}/> Word</button><button onClick={()=>window.print()}><Printer size={16}/> Print/PDF</button></div>

    {tab === 'prepare' && <div className="grid">
      <Section icon={CloudSun} title="🌤 Weather & Runway">
        <div className="fields"><Field label="Datum" type="date" value={flight.date} onChange={v=>set('date',v)} /><Field label="Les" value={flight.lesson} onChange={v=>set('lesson',v)} /><Field label="Vluchtsoort" type="text" value={flight.flightType} onChange={v=>set('flightType',v)} /><Field label="Airport" type="text" value={flight.airport} onChange={v=>set('airport',v.toUpperCase())} /><Field label="Runway" value={flight.runway} onChange={v=>set('runway',v)} options={Object.keys(airport.runways)} /><Field label="Windrichting" value={flight.windDir} onChange={v=>set('windDir',v)} suffix="°" /><Field label="Wind" value={flight.windKt} onChange={v=>set('windKt',v)} suffix="kt" /><Field label="QNH" value={flight.qnh} onChange={v=>set('qnh',v)} /><Field label="Temp" value={flight.tempC} onChange={v=>set('tempC',v)} suffix="°C" /><Field label="Cloudbase" value={flight.cloudBaseFt} onChange={v=>set('cloudBaseFt',v)} suffix="ft" /></div>
        <div className="result"><div><b>RWY heading</b><strong>{runway.heading}°</strong></div><div><b>Surface</b><strong>{runway.surface}</strong></div><div><b>HW/XW</b><strong>{performance.wind.headwind} / {Math.abs(performance.wind.crosswind)} kt</strong></div><div><b>PA/DA</b><strong>{performance.pressureAltitudeFt} / {performance.densityAltitudeFt} ft</strong></div></div>
      </Section>
      <Section icon={Weight} title="⚖️ Flight Loading"><div className="fields"><Field label="Aircraft / callsign" type="text" value={flight.aircraft} onChange={v=>set('aircraft',v.toUpperCase())} /><Field label="Pilot" value={flight.pilotKg} onChange={v=>set('pilotKg',v)} suffix="kg" /><Field label="FI/Pax" value={flight.instructorKg} onChange={v=>set('instructorKg',v)} suffix="kg" /><Field label="Baggage" value={flight.baggageKg} onChange={v=>set('baggageKg',v)} suffix="kg" /><Field label="Fuel" value={flight.fuelLiters} onChange={v=>set('fuelLiters',v)} suffix="L" /></div><div className="result"><div><b>Type</b><strong>{aircraft.type}</strong></div><div><b>TOW</b><strong>{Math.round(performance.towKg)} kg</strong></div><div><b>MTOW</b><strong>{aircraft.mtowKg} kg</strong></div><div><b>Fuel weight</b><strong>{performance.fuelKg.toFixed(1)} kg</strong></div></div></Section>
      <Section icon={Gauge} title="✈️ Performance Calculator (DV20)"><div className="result"><div><b>TORA</b><strong>{runway.tora} m</strong></div><div><b>TODA</b><strong>{runway.toda} m</strong></div><div><b>ASDA</b><strong>{runway.asda} m</strong></div><div><b>LDA</b><strong>{runway.lda} m</strong></div><div><b>Ground roll</b><strong>{performance.roll} m</strong></div><div><b>TODR</b><strong>{performance.factoredTodr} m</strong></div><div><b>Margin</b><strong>{performance.margin} m</strong></div><div><b>Margin %</b><strong>{performance.marginPct}%</strong></div></div><p className="note">Check altijd actuele AFM, eAIP en NOTAM voor dispatch.</p></Section>
      <Section icon={Fuel} title="⛽ Fuel Planning (ACHA)"><div className="fields"><Field label="Duration" value={flight.durationMin} onChange={v=>set('durationMin',v)} suffix="min" /><Field label="Extra fuel" value={flight.extraFuelLiters} onChange={v=>set('extraFuelLiters',v)} suffix="L" /></div><div className="result"><div><b>Taxi</b><strong>{fuel.taxi.toFixed(1)} L</strong></div><div><b>Trip</b><strong>{fuel.trip.toFixed(1)} L</strong></div><div><b>Contingency</b><strong>{fuel.contingency.toFixed(1)} L</strong></div><div><b>Final reserve</b><strong>{fuel.finalReserve.toFixed(1)} L</strong></div><div><b>Block required</b><strong>{fuel.block.toFixed(1)} L</strong></div><div><b>On board</b><strong>{flight.fuelLiters} L</strong></div></div></Section>
      <Section icon={Radio} title="📻 Radio"><div className="result">{airport.frequencies.map(fr=><div key={fr.label}><b>{fr.label}</b><strong>{fr.value}</strong></div>)}</div></Section>
      <Section icon={ClipboardCheck} title="✅ Walkaround & Checks"><div className="checks">{Object.entries({notams:'NOTAMs checked',discrepancy:'Discrepancy log checked',fuelDrained:'Fuel drained',oil:'Oil checked',stallWarning:'Stall warning checked',walkaround:'Walkaround complete'}).map(([k,label])=><label key={k}><input type="checkbox" checked={!!flight.checks[k]} onChange={e=>setCheck(k,e.target.checked)} /> {label}</label>)}</div></Section>
      <Section icon={BookOpen} title="📋 Briefing"><h3>Lesson {flight.lesson}</h3><ul>{lessons.map(x=><li key={x}>{x}</li>)}</ul><h3>EFATO</h3><p>59 kt · land ahead / small deviation · instructor/PIC.</p><textarea className="field" style={{width:'100%',minHeight:100}} value={flight.notes} onChange={e=>set('notes',e.target.value)} placeholder="Instructor notes / threats / logbook..." /></Section>
    </div>}

    {tab === 'database' && <Section full icon={Database} title="📒 Flight Database"><div className="list">{flights.map(f=><div className="item" key={f.id}><span><b>{f.date}</b> · Les {f.lesson} · {f.aircraft} · {f.airport}/{f.runway}</span><span><button onClick={()=>load(f)}>Open</button> <button onClick={()=>duplicate(f)}><Copy size={14}/></button> <button onClick={()=>remove(f.id)}><Trash2 size={14}/></button></span></div>)}</div></Section>}
    {tab === 'settings' && <div className="grid"><Section icon={Plane} title="Aircraft database"><pre>{JSON.stringify(aircraftProfiles,null,2)}</pre></Section><Section icon={Database} title="Airport database"><pre>{JSON.stringify(airports,null,2)}</pre></Section></div>}
  </main>
}

createRoot(document.getElementById('root')).render(<App />)

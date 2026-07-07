import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Plane, CloudSun, Weight, Gauge, Fuel, Radio, ClipboardCheck, Save, Upload, Download} from 'lucide-react';
import './style.css';

const defaultFlight = {
  date: new Date().toISOString().slice(0,10), lesson: '9', aircraft: 'PH-SKM', flightType: 'Dual local',
  runway: '25', windDir: 250, windKt: 8, qnh: 1015, temp: 16, visibility: 10, cloudBase: 2000,
  grass: 'dry', slope: 0, tora: 600, toda: 600, lda: 600,
  emptyWeight: 495, emptyMoment: 0, pilot: 82, instructor: 89, baggage: 2, fuelLiters: 40,
  durationMin: 75, extraFuel: 5, notams: false, discrepancy: false, stallWarning: false, fuelDrained: false,
};
const RWY_HEADING = { '07':70, '13':130, '18':180, '25':250, '31':310, '36':360 };
const lessons = {
  '9':['Steep turns','Slow flight','Stalls','Recovery','Circuits','Go-around'],
  '10':['Precautionary landing','PFL intro','Circuits','Go-around'],
  '11':['Forced landing','Field selection','Restart checks','Mayday practice'],
  '12':['Navigation prep','Dead reckoning','Diversion','RT en-route'],
};
function num(v){return Number.isFinite(+v)?+v:0}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function windComponents(rwy, dir, speed){const hdg=RWY_HEADING[rwy]??num(rwy)*10; let angle=((num(dir)-hdg+540)%360)-180; const rad=angle*Math.PI/180; return {angle:Math.round(angle), head: +(num(speed)*Math.cos(rad)).toFixed(1), cross:+(num(speed)*Math.sin(rad)).toFixed(1)} }
function pressureAlt(qnh, elev=3){return Math.round(elev + (1013.25-num(qnh))*27)}
function densityAlt(pa,temp){const isa=15 - (num(pa)/1000)*2; return Math.round(num(pa)+120*(num(temp)-isa))}
function calc(f){
  const fuelKg=num(f.fuelLiters)*0.75; const tow=num(f.emptyWeight)+num(f.pilot)+num(f.instructor)+num(f.baggage)+fuelKg;
  const wc=windComponents(f.runway,f.windDir,f.windKt); const pa=pressureAlt(f.qnh); const da=densityAlt(pa,f.temp);
  let baseRoll=235, baseTODR=340; // conservative interpolation baseline for EHHV low DA; use AFM check for final dispatch
  const weightFactor=Math.pow(tow/675,2); const daFactor=1+clamp(da,0,6000)/1000*0.08;
  const windFactor= wc.head>=0 ? Math.max(0.7,1-(wc.head*0.025)) : 1+Math.abs(wc.head)*0.05;
  const grassFactor=f.grass==='wet'?1.25:f.grass==='dry'?1.20:1.0;
  const slopeFactor=1+(num(f.slope)>0?num(f.slope)*0.05:0);
  let todr=Math.round(baseTODR*weightFactor*daFactor*windFactor*grassFactor*slopeFactor);
  let roll=Math.round(baseRoll*weightFactor*daFactor*windFactor*grassFactor*slopeFactor);
  const soloFactor=f.flightType.toLowerCase().includes('solo')?1.33:1;
  const factoredTODR=Math.round(todr*soloFactor); const margin=num(f.toda)-factoredTODR;
  const tripFuel=num(f.durationMin)/60*19; const taxi=2.5; const contingency=Math.max(tripFuel*0.10,19/12); const finalReserve=f.flightType.includes('local')?19/6:19/2; const blockFuel=taxi+tripFuel+contingency+finalReserve+num(f.extraFuel);
  return {fuelKg,tow,wc,pa,da,roll,todr,factoredTODR,margin,marginPct: Math.round(margin/num(f.toda)*100), taxi,tripFuel,contingency,finalReserve,blockFuel};
}
function Field({label,value,onChange,type='number',suffix}){return <label className="field"><span>{label}</span><div><input type={type} value={value} onChange={e=>onChange(type==='number'?e.target.value:e.target.value)}/>{suffix&&<b>{suffix}</b>}</div></label>}
function Section({icon:Icon,title,children}){return <section className="card"><h2><Icon size={20}/>{title}</h2>{children}</section>}
function App(){const [f,setF]=useState(()=>JSON.parse(localStorage.getItem('achaFlightV3')||'null')||defaultFlight); const c=useMemo(()=>calc(f),[f]);
useEffect(()=>localStorage.setItem('achaFlightV3',JSON.stringify(f)),[f]); const set=(k,v)=>setF({...f,[k]:v});
function exportJson(){const blob=new Blob([JSON.stringify(f,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`acha-flight-${f.date}-les-${f.lesson}.json`; a.click();}
function importJson(e){const file=e.target.files?.[0]; if(!file)return; const r=new FileReader(); r.onload=()=>setF(JSON.parse(r.result)); r.readAsText(file)}
return <main><header><div><h1><Plane/> ACHA Flight Companion</h1><p>React PWA · DV20 · EHHV · autosave</p></div><div className={c.margin>=0&&c.tow<=730&&Math.abs(c.wc.cross)<=15?'status go':'status nogo'}>{c.margin>=0?'GO':'CHECK'}</div></header>
<nav><button onClick={exportJson}><Download size={16}/>Export</button><label className="button"><Upload size={16}/>Import<input hidden type="file" accept="application/json" onChange={importJson}/></label><span><Save size={16}/> Autosave</span></nav>
<div className="grid">
<Section icon={CloudSun} title="1. Weather & Runway"><div className="fields"><Field label="Date" type="date" value={f.date} onChange={v=>set('date',v)}/><Field label="Lesson" value={f.lesson} onChange={v=>set('lesson',v)}/><label className="field"><span>Flight type</span><select value={f.flightType} onChange={e=>set('flightType',e.target.value)}><option>Dual local</option><option>Solo circuit</option><option>Solo navigation</option><option>Dual navigation</option></select></label><label className="field"><span>RWY</span><select value={f.runway} onChange={e=>set('runway',e.target.value)}>{Object.keys(RWY_HEADING).map(r=><option key={r}>{r}</option>)}</select></label><Field label="Wind dir" value={f.windDir} onChange={v=>set('windDir',v)} suffix="°"/><Field label="Wind" value={f.windKt} onChange={v=>set('windKt',v)} suffix="kt"/><Field label="QNH" value={f.qnh} onChange={v=>set('qnh',v)}/><Field label="Temp" value={f.temp} onChange={v=>set('temp',v)} suffix="°C"/><label className="field"><span>Grass</span><select value={f.grass} onChange={e=>set('grass',e.target.value)}><option value="dry">Dry</option><option value="wet">Wet</option><option value="paved">Paved</option></select></label></div><div className="result"><b>HW/XW</b><span>{c.wc.head} / {Math.abs(c.wc.cross)} kt</span><b>PA/DA</b><span>{c.pa} / {c.da} ft</span></div></Section>
<Section icon={Weight} title="2. Flight Loading"><div className="fields"><Field label="Empty W" value={f.emptyWeight} onChange={v=>set('emptyWeight',v)} suffix="kg"/><Field label="Pilot" value={f.pilot} onChange={v=>set('pilot',v)} suffix="kg"/><Field label="FI/Pax" value={f.instructor} onChange={v=>set('instructor',v)} suffix="kg"/><Field label="Baggage" value={f.baggage} onChange={v=>set('baggage',v)} suffix="kg"/><Field label="Fuel" value={f.fuelLiters} onChange={v=>set('fuelLiters',v)} suffix="L"/></div><div className="big"><span>TOW</span><strong>{Math.round(c.tow)} kg</strong><em>{c.tow<=730?'≤ 730 OK':'MTOW exceeded'}</em></div></Section>
<Section icon={Gauge} title="3. Performance"><div className="fields"><Field label="TORA" value={f.tora} onChange={v=>set('tora',v)} suffix="m"/><Field label="TODA" value={f.toda} onChange={v=>set('toda',v)} suffix="m"/><Field label="LDA" value={f.lda} onChange={v=>set('lda',v)} suffix="m"/><Field label="Slope up" value={f.slope} onChange={v=>set('slope',v)} suffix="%"/></div><div className="result"><b>Roll</b><span>{c.roll} m</span><b>TODR</b><span>{c.todr} m</span><b>{f.flightType.includes('Solo')?'TODR ×1.33':'Factored TODR'}</b><span>{c.factoredTODR} m</span><b>Margin</b><span>{c.margin} m ({c.marginPct}%)</span></div><p className="note">Gebruik voor dispatch altijd actuele AFM/clubwaarden; deze app helpt voorbereiden.</p></Section>
<Section icon={Fuel} title="4. Fuel"><div className="fields"><Field label="Duration" value={f.durationMin} onChange={v=>set('durationMin',v)} suffix="min"/><Field label="Extra" value={f.extraFuel} onChange={v=>set('extraFuel',v)} suffix="L"/></div><div className="result"><b>Taxi</b><span>{c.taxi.toFixed(1)} L</span><b>Trip</b><span>{c.tripFuel.toFixed(1)} L</span><b>Cont.</b><span>{c.contingency.toFixed(1)} L</span><b>FRF</b><span>{c.finalReserve.toFixed(1)} L</span><b>Block req.</b><span>{c.blockFuel.toFixed(1)} L</span></div></Section>
<Section icon={Radio} title="5. Radio"><div className="freq"><span>Hilversum Radio</span><b>131.030</b><span>Dutch Mil</span><b>132.350</b><span>Amsterdam Info</span><b>124.300</b></div></Section>
<Section icon={ClipboardCheck} title="6. ACHA Checks"><div className="checks">{['notams:NOTAMs checked','discrepancy:Discrepancy log','stallWarning:Stall warning','fuelDrained:Fuel drained'].map(x=>{const [k,t]=x.split(':'); return <label key={k}><input type="checkbox" checked={!!f[k]} onChange={e=>set(k,e.target.checked)}/>{t}</label>})}</div><h3>Lesson {f.lesson}</h3><ul>{(lessons[f.lesson]||['Local training','Circuits','Handling']).map(x=><li key={x}>{x}</li>)}</ul><h3>EFATO</h3><p>59 kt · land ahead / small deviation · PIC/instructor.</p></Section>
</div><footer>ACHA Flight Companion v3 · local-first · export/import voor iPhone & Samsung</footer></main>}

createRoot(document.getElementById('root')).render(<App/>);

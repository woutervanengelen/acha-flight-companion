export function exportWordHtml({ flight, aircraft, airport, runway, performance, fuel, lessons }) {
  const rows = (items) => items.map(([a,b]) => `<tr><td>${a}</td><td>${b ?? ''}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Flight Preparation</title><style>body{font-family:Arial} table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #777;padding:6px}h1,h2{margin:10px 0}.check{font-family:Arial}</style></head><body>
  <h1>ACHA Flight Preparation</h1>
  <h2>Flight</h2><table>${rows([
    ['Date', flight.date], ['Lesson', flight.lesson], ['Aircraft', aircraft.registration], ['Type', aircraft.type], ['Airport', airport.icao], ['Runway', flight.runway], ['Flight type', flight.flightType]
  ])}</table>
  <h2>Weather & Runway</h2><table>${rows([
    ['Wind', `${flight.windDir}/${flight.windKt} kt`], ['QNH', flight.qnh], ['Temp', `${flight.tempC} °C`], ['TORA', runway.tora], ['TODA', runway.toda], ['ASDA', runway.asda], ['LDA', runway.lda], ['Surface', runway.surface]
  ])}</table>
  <h2>Loading</h2><table>${rows([
    ['Pilot', `${flight.pilotKg} kg`], ['FI/Pax', `${flight.instructorKg} kg`], ['Baggage', `${flight.baggageKg} kg`], ['Fuel', `${flight.fuelLiters} L`], ['TOW', `${Math.round(performance.towKg)} kg`]
  ])}</table>
  <h2>Performance</h2><table>${rows([
    ['Headwind / Crosswind', `${performance.wind.headwind} / ${Math.abs(performance.wind.crosswind)} kt`], ['PA / DA', `${performance.pressureAltitudeFt} / ${performance.densityAltitudeFt} ft`], ['Ground roll', `${performance.roll} m`], ['TODR', `${performance.todr} m`], ['Factored TODR', `${performance.factoredTodr} m`], ['Margin', `${performance.margin} m (${performance.marginPct}%)`]
  ])}</table>
  <h2>Fuel</h2><table>${rows([
    ['Taxi', fuel.taxi.toFixed(1)], ['Trip', fuel.trip.toFixed(1)], ['Contingency', fuel.contingency.toFixed(1)], ['Final reserve', fuel.finalReserve.toFixed(1)], ['Block required', fuel.block.toFixed(1)]
  ])}</table>
  <h2>Radio</h2><table>${rows(airport.frequencies.map(f => [f.label, f.value]))}</table>
  <h2>Lesson / Exercises</h2><ul>${lessons.map(l => `<li>${l}</li>`).join('')}</ul>
  <h2>Checks</h2><p class="check">☐ NOTAMs checked &nbsp; ☐ Discrepancy log &nbsp; ☐ Fuel drained &nbsp; ☐ Oil checked &nbsp; ☐ Stall warning &nbsp; ☐ Walkaround complete</p>
  <h2>Logbook notes</h2><p>${flight.notes || ''}</p>
  </body></html>`
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ACHA_Flight_${flight.date}_Lesson_${flight.lesson}.doc`
  a.click()
}

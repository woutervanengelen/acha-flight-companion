const toNum = (v) => Number.isFinite(+v) ? +v : 0
const clamp = (x, min, max) => Math.max(min, Math.min(max, x))

export function windComponents(runwayHeading, windDir, windKt) {
  const angle = ((toNum(windDir) - toNum(runwayHeading) + 540) % 360) - 180
  const rad = angle * Math.PI / 180
  return {
    angle: Math.round(angle),
    headwind: +(toNum(windKt) * Math.cos(rad)).toFixed(1),
    crosswind: +(toNum(windKt) * Math.sin(rad)).toFixed(1),
  }
}

export function pressureAltitude(qnh, elevationFt = 0) {
  return Math.round(toNum(elevationFt) + (1013.25 - toNum(qnh)) * 27)
}

export function densityAltitude(pressureAltitudeFt, tempC) {
  const isaTemp = 15 - (toNum(pressureAltitudeFt) / 1000) * 2
  return Math.round(toNum(pressureAltitudeFt) + 120 * (toNum(tempC) - isaTemp))
}

export function calculatePerformance({ flight, aircraft, airport, runway }) {
  const fuelKg = toNum(flight.fuelLiters) * 0.75
  const towKg = toNum(aircraft.emptyWeightKg) + toNum(flight.pilotKg) + toNum(flight.instructorKg) + toNum(flight.baggageKg) + fuelKg
  const wind = windComponents(runway.heading, flight.windDir, flight.windKt)
  const pa = pressureAltitude(flight.qnh, airport.elevationFt)
  const da = densityAltitude(pa, flight.tempC)

  const baseRoll = 235
  const baseTodr = 340
  const weightFactor = Math.pow(towKg / 675, 2)
  const daFactor = 1 + clamp(da, 0, 6000) / 1000 * 0.08
  const windFactor = wind.headwind >= 0 ? Math.max(0.7, 1 - wind.headwind * 0.025) : 1 + Math.abs(wind.headwind) * 0.05
  const grassFactor = runway.surface === 'grass-wet' ? 1.25 : runway.surface === 'grass' ? 1.20 : 1.0
  const slopeFactor = 1 + (toNum(runway.slopePct) > 0 ? toNum(runway.slopePct) * 0.05 : 0)
  const roll = Math.round(baseRoll * weightFactor * daFactor * windFactor * grassFactor * slopeFactor)
  const todr = Math.round(baseTodr * weightFactor * daFactor * windFactor * grassFactor * slopeFactor)
  const soloFactor = String(flight.flightType).toLowerCase().includes('solo') ? 1.33 : 1
  const factoredTodr = Math.round(todr * soloFactor)
  const margin = toNum(runway.toda) - factoredTodr

  return { fuelKg, towKg, wind, pressureAltitudeFt: pa, densityAltitudeFt: da, roll, todr, factoredTodr, margin, marginPct: Math.round(margin / toNum(runway.toda) * 100) }
}

export function calculateFuel(flight) {
  const durationHours = toNum(flight.durationMin) / 60
  const trip = durationHours * 19
  const taxi = 2.5
  const contingency = Math.max(trip * 0.10, 19 / 12)
  const finalReserve = String(flight.flightType).toLowerCase().includes('local') ? 19 / 6 : 19 / 2
  const block = taxi + trip + contingency + finalReserve + toNum(flight.extraFuelLiters)
  return { taxi, trip, contingency, finalReserve, block }
}

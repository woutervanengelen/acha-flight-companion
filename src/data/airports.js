export const airports = {
  EHHV: {
    icao: 'EHHV',
    name: 'Hilversum',
    elevationFt: 3,
    circuitFtAal: 700,
    frequencies: [
      { label: 'Hilversum Radio', value: '131.030' },
      { label: 'Dutch Mil Info', value: '132.350' },
      { label: 'Amsterdam Information', value: '124.300' }
    ],
    runways: {
      '07': { heading: 70, surface: 'grass', tora: 600, toda: 600, asda: 600, lda: 600, slopePct: 0 },
      '18': { heading: 180, surface: 'grass', tora: 600, toda: 600, asda: 600, lda: 600, slopePct: 0 },
      '25': { heading: 250, surface: 'grass', tora: 600, toda: 600, asda: 600, lda: 600, slopePct: 0 },
      '31': { heading: 310, surface: 'grass', tora: 600, toda: 600, asda: 600, lda: 600, slopePct: 0 },
      '36': { heading: 360, surface: 'grass', tora: 600, toda: 600, asda: 600, lda: 600, slopePct: 0 }
    }
  }
}

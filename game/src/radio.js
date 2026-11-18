// In-car radio: three synthesized stations, each a tiny step sequencer (bass line + lead)
// played through the audio engine. R cycles stations; the radio only plays while the player
// is in a vehicle. The station name lives on the state for the HUD.

const STATIONS = [
  {
    name: 'NEON 101',
    bpm: 112,
    bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0],
    lead: [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 329.6, 0],
  },
  {
    name: 'PALM FM',
    bpm: 84,
    bass: [87.3, 0, 0, 0, 110, 0, 0, 0, 98, 0, 0, 0, 130.8, 0, 0, 0],
    lead: [349.2, 0, 0, 392, 0, 0, 440, 0, 0, 392, 0, 0, 329.6, 0, 0, 0],
  },
  {
    name: 'GULL ROCK',
    bpm: 132,
    bass: [82.4, 82.4, 0, 82.4, 0, 98, 0, 82.4, 73.4, 73.4, 0, 73.4, 0, 98, 110, 0],
    lead: [164.8, 0, 196, 0, 246.9, 0, 196, 0, 164.8, 0, 196, 0, 220, 0, 246.9, 0],
  },
];

export function createRadio(audio) {
  let playing = false;
  let stationIndex = 0;

  function startStation() {
    if (!audio) return;
    const station = STATIONS[stationIndex];
    audio.radioStart((step) => {
      const i = step % 16;
      const bass = station.bass[i];
      const lead = station.lead[i];
      if (bass) audio.note(bass, 0.22, 'triangle', 0.16);
      if (lead) audio.note(lead, 0.16, 'square', 0.06);
    }, station.bpm);
    playing = true;
  }

  function stopStation() {
    if (audio) audio.radioStop();
    playing = false;
  }

  return {
    stations: STATIONS.map((s) => s.name),
    /** Called every step: R cycles, entering a vehicle starts the music, leaving stops it. */
    update(dt, inVehicle, radioState, actions) {
      if ((actions & 8) && inVehicle) {
        stationIndex = (stationIndex + 1) % STATIONS.length;
        radioState.station = stationIndex;
        radioState.name = STATIONS[stationIndex].name;
        if (playing) {
          stopStation();
          startStation();
        }
      }
      if (inVehicle && !playing) {
        radioState.station = stationIndex;
        radioState.name = STATIONS[stationIndex].name;
        radioState.on = true;
        startStation();
      } else if (!inVehicle && playing) {
        radioState.on = false;
        stopStation();
      }
    },
  };
}

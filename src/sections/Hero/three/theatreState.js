/**
 * Builds a Theatre.js project state (definitionVersion 0.4.0) from a compact keyframe table, so
 * the intro can be authored in code and still be opened, scrubbed and edited in Theatre Studio.
 *
 *   tracks = { ObjectKey: { prop: [[time, value, ease?], …] } }
 *
 * `ease` describes the segment *arriving* at that keyframe. Theatre evaluates a segment with the
 * left keyframe's handles[2..3] and the right keyframe's handles[0..1] (a cubic-bezier).
 */
const EASES = {
  linear: [0.33, 0.33, 0.67, 0.67],
  in: [0.55, 0, 0.8, 0.4],
  out: [0.2, 0.9, 0.35, 1],
  inOut: [0.6, 0, 0.35, 1],
  expoOut: [0.16, 1, 0.3, 1],
};

function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function buildSequence({ length, tracks }) {
  const tracksByObject = {};

  for (const [objectKey, props] of Object.entries(tracks)) {
    const trackIdByPropPath = {};
    const trackData = {};

    for (const [prop, frames] of Object.entries(props)) {
      const trackId = `${objectKey}-${prop}`;
      trackIdByPropPath[JSON.stringify([prop])] = trackId;
      trackData[trackId] = {
        type: 'BasicKeyframedTrack',
        __debugName: `${objectKey}:["${prop}"]`,
        keyframes: frames.map(([position, value], i) => {
          const incoming = EASES[frames[i]?.[2] ?? 'inOut'];
          const outgoing = EASES[frames[i + 1]?.[2] ?? 'inOut'];
          return {
            id: `${trackId}-${i}`,
            position,
            value,
            connectedRight: i < frames.length - 1,
            type: 'bezier',
            handles: [incoming[2], incoming[3], outgoing[0], outgoing[1]],
          };
        }),
      };
    }
    tracksByObject[objectKey] = { trackIdByPropPath, trackData };
  }
  return { type: 'PositionalSequence', length, subUnitsPerUnit: 30, tracksByObject };
}

/** sheets = { SheetId: { length, tracks } } */
export function buildState(sheets) {
  const sheetsById = {};
  for (const [sheetId, sheet] of Object.entries(sheets)) {
    sheetsById[sheetId] = { staticOverrides: { byObject: {} }, sequence: buildSequence(sheet) };
  }
  const state = { sheetsById, definitionVersion: '0.4.0' };
  // A new revision id whenever the choreography changes, so Studio drops stale browser state.
  state.revisionHistory = [hash(JSON.stringify(state))];
  return state;
}

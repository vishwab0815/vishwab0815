// Incident log kept in state.json on the `output` branch. One open incident per key at a time.

const KEEP = 100;

export function openIncident(state, { key, severity, title, detail, auto = false }, now) {
  state.incidents ??= [];
  const existing = state.incidents.find((i) => i.key === key && !i.resolvedAt);
  if (existing) {
    existing.detail = detail; // keep the latest symptom, e.g. a changed HTTP status
    return existing;
  }
  state.nextIncident = (state.nextIncident ?? 0) + 1;
  const incident = {
    id: `INC-${String(state.nextIncident).padStart(4, '0')}`,
    key, severity, title, detail, auto,
    openedAt: new Date(now).toISOString(),
    resolvedAt: null,
    resolution: null,
  };
  state.incidents.push(incident);
  state.incidents = state.incidents.slice(-KEEP);
  return incident;
}

export function resolveIncident(state, key, now, resolution) {
  const open = (state.incidents ?? []).find((i) => i.key === key && !i.resolvedAt);
  if (!open) return null;
  open.resolvedAt = new Date(now).toISOString();
  open.resolution = resolution;
  return open;
}

export const openIncidents = (state, prefix) =>
  (state.incidents ?? []).filter((i) => !i.resolvedAt && i.key.startsWith(prefix));

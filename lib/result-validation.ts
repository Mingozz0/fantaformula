export type PositionRow = { driver_id: number; name: string; grid_position: number | null;
  finish_position: number | null; result_status: string };
export type PositionError = { driverId: number; field: 'grid' | 'finish' | 'status'; message: string };

export function validatePositions(rows: PositionRow[], complete = true): PositionError[] {
  const errors: PositionError[] = [];
  for (const row of rows) {
    if (!['finished', 'dnf', 'dns', 'dsq'].includes(row.result_status)) {
      errors.push({ driverId: row.driver_id, field: 'status', message: `${row.name}: seleziona un esito valido.` });
    }
    if (complete && row.result_status === 'finished' && row.finish_position === null) {
      errors.push({ driverId: row.driver_id, field: 'finish', message: `${row.name}: inserisci la posizione all’arrivo.` });
    }
    if (row.result_status !== 'finished' && row.finish_position !== null) {
      errors.push({ driverId: row.driver_id, field: 'finish', message: `${row.name}: per un pilota non arrivato lascia vuoto l’arrivo.` });
    }
  }
  for (const [field, key, label] of [
    ['grid', 'grid_position', 'partenza'], ['finish', 'finish_position', 'arrivo'],
  ] as const) {
    const positions = new Map<number, PositionRow[]>();
    for (const row of rows) {
      const position = row[key];
      if (position === null) continue;
      if (!Number.isInteger(position) || position < 1 || position > 30) {
        errors.push({ driverId: row.driver_id, field, message: `${row.name}: la posizione di ${label} deve essere un intero da 1 a 30.` });
        continue;
      }
      const group = positions.get(position) ?? [];
      group.push(row);
      positions.set(position, group);
    }
    for (const [position, group] of positions) {
      if (group.length < 2) continue;
      for (const row of group) errors.push({ driverId: row.driver_id, field,
        message: `Posizione di ${label} ${position} già assegnata: ${group.map((entry) => entry.name).join(' e ')}.` });
    }
  }
  return errors;
}

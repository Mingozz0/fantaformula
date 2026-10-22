export function leagueStatusLabel(status: string) {
  return ({ recruiting: 'Iscrizioni aperte', active: 'In corso', completed: 'Conclusa' } as Record<string, string>)[status] ?? 'Da verificare';
}

export function driverStatusLabel(status: string) {
  return ({ finished: 'Arrivato', dnf: 'Ritirato', dns: 'Non partito', not_entered: 'Non iscritto', dsq: 'Squalificato', other: 'Altro esito' } as Record<string, string>)[status] ?? 'Da verificare';
}

export function signedPoints(value: number) {
  return new Intl.NumberFormat('it-IT', { signDisplay: 'exceptZero', maximumFractionDigits: 2 }).format(value);
}

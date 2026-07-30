// Algoritmo SM-2 (SuperMemo 2) para spaced repetition.
//
// Entrada:
//   quality: 0..5 (qualidade da resposta)
//   easiness: fator atual (default 2.5)
//   repetitions: nº de repetições corretas seguidas
//   intervalDays: intervalo anterior em dias
// Saída:
//   { easiness, repetitions, intervalDays, dueAt }
//
// Regra:
//   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
//   EF' = max(1.3, EF')
//   if q < 3: repetitions = 0, interval = 1
//   else: repetitions++; r==1 → 1, r==2 → 6, else round(prev*EF')
//   dueAt = now + interval days

export interface Sm2Input {
  quality: number;
  easiness: number;
  repetitions: number;
  intervalDays: number;
  now?: Date;
}

export interface Sm2Output {
  easiness: number;
  repetitions: number;
  intervalDays: number;
  dueAt: Date;
}

export function sm2(input: Sm2Input): Sm2Output {
  const q = clamp(Math.round(input.quality), 0, 5);
  const prevEf = input.easiness;
  let ef = prevEf + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let reps = input.repetitions;
  let interval: number;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps = reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(input.intervalDays * ef);
    if (interval < 1) interval = 1;
  }

  const now = input.now ?? new Date();
  const due = new Date(now.getTime() + interval * 86400000);

  // Arredonda EF pra 2 casas para evitar drift de precisão.
  return {
    easiness: Math.round(ef * 100) / 100,
    repetitions: reps,
    intervalDays: interval,
    dueAt: due,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

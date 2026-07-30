// Unit tests do SM-2 (puro, sem DB).

import { assertEquals, assertAlmostEquals } from "@std/assert";
import { sm2 } from "../src/lib/sm2.ts";

Deno.test("sm2: primeira repetição correta → intervalo 1 dia", () => {
  const out = sm2({ quality: 5, easiness: 2.5, repetitions: 0, intervalDays: 0 });
  assertEquals(out.repetitions, 1);
  assertEquals(out.intervalDays, 1);
});

Deno.test("sm2: segunda repetição correta → intervalo 6 dias", () => {
  const out = sm2({ quality: 4, easiness: 2.5, repetitions: 1, intervalDays: 1 });
  assertEquals(out.repetitions, 2);
  assertEquals(out.intervalDays, 6);
});

Deno.test("sm2: terceira repetição → round(6 * EF')", () => {
  const out = sm2({ quality: 5, easiness: 2.5, repetitions: 2, intervalDays: 6 });
  assertEquals(out.repetitions, 3);
  // EF' = 2.5 + (0.1 - 0*(0.08)) = 2.6 → round(6 * 2.6) = 16
  assertEquals(out.intervalDays, 16);
  assertAlmostEquals(out.easiness, 2.6, 0.001);
});

Deno.test("sm2: quality < 3 reseta repetições", () => {
  const out = sm2({ quality: 2, easiness: 2.5, repetitions: 5, intervalDays: 30 });
  assertEquals(out.repetitions, 0);
  assertEquals(out.intervalDays, 1);
});

Deno.test("sm2: easiness não pode ser menor que 1.3", () => {
  const out = sm2({ quality: 0, easiness: 1.3, repetitions: 0, intervalDays: 0 });
  assertEquals(out.easiness, 1.3);
});

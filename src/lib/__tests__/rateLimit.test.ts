import { vi, describe, it, expect, afterEach } from "vitest";
import { crearLimitador } from "@/lib/rateLimit";

afterEach(() => vi.useRealTimers());

describe("crearLimitador", () => {
  it("rechaza al pasar el máximo y dice cuántos segundos esperar", () => {
    vi.useFakeTimers();
    const l = crearLimitador(2, 10 * 60_000);
    expect(l.consumir("a").ok).toBe(true);
    expect(l.consumir("a").ok).toBe(true);
    expect(l.consumir("a")).toEqual({ ok: false, retryAfter: 600 });
    // Otra clave tiene su propio cupo
    expect(l.consumir("b").ok).toBe(true);
  });

  it("libera el cupo al pasar la ventana", () => {
    vi.useFakeTimers();
    const l = crearLimitador(1, 60_000);
    l.consumir("a");
    expect(l.consumir("a").ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(l.consumir("a").ok).toBe(true);
  });

  it("disponible no cuenta usos", () => {
    const l = crearLimitador(1, 60_000);
    expect(l.disponible("a").ok).toBe(true);
    expect(l.disponible("a").ok).toBe(true);
    l.consumir("a");
    expect(l.disponible("a").ok).toBe(false);
  });
});

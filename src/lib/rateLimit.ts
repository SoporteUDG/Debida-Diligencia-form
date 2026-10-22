/**
 * Limitador de ventana deslizante en memoria (una instancia del servidor, como
 * el del middleware). `consumir` cuenta un uso por clave; `disponible` solo
 * consulta. Devuelve los segundos a esperar cuando se agotó el cupo.
 */
export interface Limitador {
  /** Cuenta un uso. `retryAfter` (segundos) solo viene cuando se rechaza. */
  consumir(clave: string): { ok: boolean; retryAfter: number };
  /** ¿Queda cupo? No cuenta. */
  disponible(clave: string): { ok: boolean; retryAfter: number };
  reiniciar(): void;
}

export function crearLimitador(max: number, ventanaMs: number): Limitador {
  const usos = new Map<string, number[]>();

  const vigentes = (clave: string, ahora: number): number[] => {
    const lista = (usos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (lista.length) usos.set(clave, lista);
    else usos.delete(clave);
    return lista;
  };
  const espera = (lista: number[], ahora: number) => Math.max(1, Math.ceil((lista[0] + ventanaMs - ahora) / 1000));

  return {
    consumir(clave) {
      const ahora = Date.now();
      const lista = vigentes(clave, ahora);
      if (lista.length >= max) return { ok: false, retryAfter: espera(lista, ahora) };
      lista.push(ahora);
      usos.set(clave, lista);
      return { ok: true, retryAfter: 0 };
    },
    disponible(clave) {
      const ahora = Date.now();
      const lista = vigentes(clave, ahora);
      return lista.length >= max ? { ok: false, retryAfter: espera(lista, ahora) } : { ok: true, retryAfter: 0 };
    },
    reiniciar() {
      usos.clear();
    },
  };
}

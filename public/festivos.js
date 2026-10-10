// Días hábiles judiciales en Colombia (ayuda de cálculo, no reemplaza la verificación).
// Festivos de la Ley 51 de 1983 (traslado al lunes) y los que dependen de la Pascua.
(function (global) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const utc = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
  const sumar = (d, n) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; };
  const alLunes = (d) => { const w = d.getUTCDay(); return w === 1 ? d : sumar(d, (8 - w) % 7); };

  function pascua(a) { // algoritmo anónimo gregoriano
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
    const g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
    const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mes = Math.floor((i + m - 7 * n + 114) / 31), dia = ((i + m - 7 * n + 114) % 31) + 1;
    return utc(a, mes, dia);
  }

  const cache = {};
  function festivos(a) {
    if (cache[a]) return cache[a];
    const p = pascua(a);
    const lista = [
      utc(a, 1, 1), utc(a, 5, 1), utc(a, 7, 20), utc(a, 8, 7), utc(a, 12, 8), utc(a, 12, 25),
      ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => alLunes(utc(a, m, d))),
      sumar(p, -3), sumar(p, -2), // jueves y viernes santo
      sumar(p, 43), sumar(p, 64), sumar(p, 71), // Ascensión, Corpus Christi, Sagrado Corazón
    ];
    return (cache[a] = new Set(lista.map(iso)));
  }

  function inhabil(d) {
    const w = d.getUTCDay(), a = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dia = d.getUTCDate();
    if (w === 0 || w === 6) return 'fin de semana';
    if (festivos(a).has(iso(d))) return 'festivo';
    if ((m === 12 && dia >= 20) || (m === 1 && dia <= 10)) return 'vacancia judicial';
    const p = pascua(a), dif = Math.round((d - p) / 864e5);
    if (dif >= -6 && dif <= -4) return 'Semana Santa';
    return null;
  }

  // Suma n días hábiles a partir del día siguiente a `desde` (YYYY-MM-DD).
  function sumarHabiles(desde, n) {
    let d = new Date(desde + 'T00:00:00Z');
    let cuenta = 0;
    while (cuenta < n) { d = sumar(d, 1); if (!inhabil(d)) cuenta++; }
    return iso(d);
  }

  global.Festivos = { festivos, inhabil, sumarHabiles, pascua };
})(typeof window !== 'undefined' ? window : globalThis);

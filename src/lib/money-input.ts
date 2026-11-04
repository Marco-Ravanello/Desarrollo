// La remuneración mientras se escribe: "450000" se ve "450.000" y "1234,5" se ve "1.234,5".
// Lo que se guarda va sin puntos y con punto decimal ("1234.5"). Sin base de datos, para poder probarlo solo.

/** Lo escrito → cómo se ve: puntos de miles y coma decimal (hasta 2 decimales). */
export function formatMoneyTyping(raw: string): string {
  const clean = raw.replace(/[^\d,]/g, "");
  const comma = clean.indexOf(",");
  const intPart = (comma === -1 ? clean : clean.slice(0, comma)).replace(/^0+(?=\d)/, "");
  const decPart = comma === -1 ? null : clean.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decPart === null) return withDots;
  return `${withDots || "0"},${decPart}`;
}

/** Cómo se ve → lo que se guarda: "1.234,5" → "1234.5". Vacío si no hay número. */
export function moneyToPlain(shown: string): string {
  const clean = shown.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  if (!clean || clean === ".") return "";
  const n = Number(clean);
  return Number.isFinite(n) ? String(n) : "";
}

/** Un número guardado → cómo se ve al abrir el formulario: 450000 → "450.000", 1234.5 → "1.234,5". */
export function moneyFromNumber(n: number | string | null | undefined): string {
  const v = Number(n);
  if (n === null || n === undefined || n === "" || !Number.isFinite(v) || v === 0) return "";
  const [i, d] = v.toFixed(2).split(".");
  const dec = d.replace(/0+$/, "");
  return formatMoneyTyping(dec ? `${i},${dec}` : i);
}

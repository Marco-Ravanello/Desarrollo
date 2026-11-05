// Botón de WhatsApp en la ficha: los teléfonos cargados como vinieron ("11 5004-1004", "011 15 5004-1004",
// "4750-1234 / 15 6123-4567") pasan al formato que pide WhatsApp (+54 9 y el número con código de área).
// En Tres de Febrero, un número de 8 cifras sin código es del 11.

export type WhatsappNumber = {
  /** Para el enlace: 5491150041004. */
  wa: string;
  /** Para mostrar: +54 9 11 5004-1004. */
  display: string;
  /** Como estaba escrito. */
  original: string;
};

/** Un número argentino a 10 cifras (código de área + número), o null si no se puede. */
export function nationalNumber(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54") && d.length >= 12) {
    d = d.slice(2);
    if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // "15 6123-4567": celular del 11 escrito a la vieja usanza.
  if (d.length === 10 && d.startsWith("15")) d = d.slice(2);
  // "11 15 5004-1004": el 15 va después del código de área (2, 3 o 4 cifras).
  if (d.length === 12) {
    if (d.startsWith("1115")) d = "11" + d.slice(4);
    else {
      const at = [3, 4, 2].find((n) => d.slice(n, n + 2) === "15");
      if (at === undefined) return null;
      d = d.slice(0, at) + d.slice(at + 2);
    }
  }
  if (d.length === 8) d = "11" + d;
  if (d.length !== 10 || d.startsWith("0")) return null;
  return d;
}

/** "+54 9 11 5004-1004". Las de otros códigos se separan en 3 cifras (221, 351…): solo para leerlas mejor. */
function displayNumber(national: string): string {
  if (national.startsWith("11")) return `+54 9 11 ${national.slice(2, 6)}-${national.slice(6)}`;
  return `+54 9 ${national.slice(0, 3)} ${national.slice(3, -4)}-${national.slice(-4)}`;
}

/** El número de WhatsApp de un teléfono, o null si no parece un número argentino. */
export function whatsappNumber(raw: string): WhatsappNumber | null {
  const national = nationalNumber(raw);
  if (!national) return null;
  return { wa: `549${national}`, display: displayNumber(national), original: raw.trim() };
}

/** Si en el campo hay más de un teléfono ("4750-1234 / 15 6123-4567"), cada uno, sin repetir. Como mucho 3. */
export function whatsappNumbers(text: string | null | undefined): WhatsappNumber[] {
  const parts = (text || "").split(/\s*(?:[/;,|]|\by\b|\bo\b)\s*/i).filter((p) => /\d/.test(p));
  const out: WhatsappNumber[] = [];
  for (const p of parts) {
    const n = whatsappNumber(p);
    if (n && !out.some((o) => o.wa === n.wa)) out.push(n);
  }
  return out.slice(0, 3);
}

/** El enlace que abre el chat (WhatsApp en el celular, WhatsApp Web o la aplicación en la computadora). */
export const whatsappHref = (n: WhatsappNumber) => `https://wa.me/${n.wa}`;

// Clave temporal al azar, fácil de dictar o copiar: "abcd-2345-efgh" (sin l, o, 0 ni 1,
// que se confunden). Cumple las reglas de contraseña. Sirve en el navegador y en el servidor.

const LETTERS = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

function pick(alphabet: string, count: number): string {
  let out = "";
  const limit = Math.floor(0x100000000 / alphabet.length) * alphabet.length;
  const buf = new Uint32Array(1);
  while (out.length < count) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) out += alphabet[buf[0] % alphabet.length];
  }
  return out;
}

export function generateTemporaryPassword(): string {
  return `${pick(LETTERS, 4)}-${pick(DIGITS, 4)}-${pick(LETTERS, 4)}`;
}

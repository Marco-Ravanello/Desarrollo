import prisma from "@/lib/prisma";
import { AIResponse } from "@/services/assistant/types";
import { handleFichaSocialAIQuery } from "@/services/assistant/intent-handlers";

// Palabras de la consulta que no forman parte de un nombre ("quiero la información sobre ...").
const STOPWORDS = new Set([
  "quiero", "queria", "quisiera", "necesito", "necesitamos", "dame", "danos", "decime", "deci", "decir",
  "mostrame", "mostrar", "muestra", "mostra", "busca", "buscar", "buscame", "busque", "consultar", "consulta",
  "informacion", "info", "datos", "dato", "detalle", "detalles", "todo", "toda", "todos", "todas",
  "tenemos", "tengamos", "tenes", "tiene", "tienen", "tengo", "hay", "haya", "existe", "figura", "aparece",
  "sobre", "acerca", "del", "las", "los", "una", "uno", "unos", "unas", "que", "quien", "quienes", "como",
  "cual", "cuales", "donde", "cuando", "para", "por", "con", "sin", "sus", "esta", "este", "esto", "estos",
  "esas", "esos", "ese", "esa", "eso", "hola", "favor", "porfa", "porfavor", "puedes", "podes", "podrias",
  "sabes", "saber", "ver", "persona", "personas", "vecino", "vecina", "vecinos", "ciudadano", "ciudadana",
  "senor", "senora", "ficha", "legajo", "registro", "registros", "municipal", "base", "sistema", "algo",
  "alguna", "alguno", "mas", "muy", "tambien", "cargado", "cargada", "nombre", "apellido", "llamado",
  "llamada", "dni", "documento", "social", "padron", "programa", "programas", "esta", "estan",
]);

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export function extractNameWords(query: string): string[] {
  const words = normalize(query)
    .split(/[^A-Z]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()));
  return Array.from(new Set(words)).slice(0, 6);
}

type PadronMatch = { dni: string; nombre_completo: string; barrio: string | null; localidad: string | null; cantidad_programas: number; score: number };

/**
 * Busca en el padrón unificado personas cuyo nombre contenga al menos dos de las
 * palabras de la consulta, como palabras completas y sin importar tildes.
 * Devuelve solo las de mayor coincidencia.
 */
async function findPadronByName(words: string[]): Promise<{ matches: PadronMatch[]; total: number }> {
  if (words.length < 2) return { matches: [], total: 0 };

  const scoreExpr = words.map((_, i) => `(CASE WHEN nombre_norm ~ $${i + 1} THEN 1 ELSE 0 END)`).join(" + ");
  const patterns = words.map((w) => `\\m${w}\\M`);

  const rows: PadronMatch[] = await prisma.$queryRawUnsafe(
    `WITH base AS (
       SELECT dni, nombre_completo, barrio, localidad, cantidad_programas,
              translate(upper(coalesce(nombre_completo, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') AS nombre_norm
       FROM padron_unificado
     ), scored AS (
       SELECT dni, nombre_completo, barrio, localidad, cantidad_programas, (${scoreExpr})::int AS score
       FROM base
     )
     SELECT * FROM scored WHERE score >= 2 ORDER BY score DESC, cantidad_programas DESC LIMIT 50;`,
    ...patterns
  );

  if (rows.length === 0) return { matches: [], total: 0 };
  const best = rows[0].score;
  const top = rows.filter((r) => r.score === best);
  return { matches: top.slice(0, 5), total: top.length };
}

/**
 * Si la consulta nombra a una persona del padrón, arma la respuesta con sus datos.
 * Devuelve null cuando no hay coincidencias, para que el asistente siga con el resto de las búsquedas.
 */
export async function lookupPersonByName(query: string): Promise<AIResponse | null> {
  const words = extractNameWords(query);
  let result: { matches: PadronMatch[]; total: number };
  try {
    result = await findPadronByName(words);
  } catch (e) {
    console.error("Error buscando nombre en padron_unificado:", e);
    return null;
  }
  if (result.matches.length === 0) return null;

  if (result.total === 1) {
    const ficha = await handleFichaSocialAIQuery(result.matches[0].dni);
    if (ficha.intent === "ficha_social_lookup") {
      const person = await prisma.person.findFirst({
        where: { dni: result.matches[0].dni },
        include: { cases: { include: { area: true } } },
      }).catch(() => null);

      let answer = ficha.answer;
      if (person && person.cases.length > 0) {
        answer += `\n#### Expedientes Sociales (${person.cases.length}):\n`;
        person.cases.forEach((c, idx) => {
          answer += `${idx + 1}. **${c.title}** — Estado: \`${c.status}\`, Prioridad: \`${c.priority}\`, Área: ${c.area?.name || "General"}\n`;
        });
      }
      return { ...ficha, answer };
    }
  }

  let answer = `### Personas encontradas en el Padrón Social Unificado\n\n`;
  answer += `Hay **${result.total} personas** cuyo nombre coincide con la búsqueda. Indique el DNI para ver la ficha completa:\n\n`;
  answer += `| Ciudadano | DNI | Barrio / Localidad | Programas |\n| :--- | :---: | :--- | :---: |\n`;
  result.matches.forEach((p) => {
    answer += `| **${p.nombre_completo}** | ${p.dni} | ${p.barrio || p.localidad || "Sin dato"} | ${p.cantidad_programas || 0} |\n`;
  });
  if (result.total > result.matches.length) {
    answer += `\n*Mostrando ${result.matches.length} de ${result.total} coincidencias.*`;
  }

  return {
    intent: "padron_name_search",
    answer,
    dataSummary: {
      hasResults: true,
      sources: result.matches.map((p) => ({ type: "Padrón Social Unificado", name: p.nombre_completo, url: "/ficha-social" })),
      actions: [{ label: "Ver Ficha Social 360°", actionType: "NAVIGATE", payload: { path: "/ficha-social" } }],
    },
  };
}

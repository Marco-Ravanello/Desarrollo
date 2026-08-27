/**
 * Servicio de Integración: Ficha Social Unificada & Cruce de Datos (Muni 3F)
 * Conecta con el motor de cruces y búsqueda 360° en Python.
 */

export interface FichaSocialRegistro {
  rol: string;
  datos_beneficiario?: {
    nombre?: string;
    dni?: string;
    fecha_nac?: string;
    edad?: number | string;
    genero?: string;
  };
  datos_contacto?: {
    telefono?: string;
    direccion?: string;
    localidad?: string;
    barrio?: string;
  };
  datos_adicionales?: Record<string, any>;
}

export interface FichaSocialProgramaDetalle {
  roles: string[];
  cantidad_registros: number;
  registros: FichaSocialRegistro[];
}

export interface RelacionFamiliar {
  dni: string;
  nombre_completo: string;
  tipo_relacion: string;
  programas: string[];
  telefono?: string;
  direccion?: string;
}

export interface FichaSocialPersonaResponse {
  encontrado: boolean;
  dni?: string;
  nombre_detectado?: string;
  total_programas?: number;
  programas_activos?: string[];
  detalle_programas?: Record<string, FichaSocialProgramaDetalle>;
  relaciones_familiares?: RelacionFamiliar[];
  mensaje?: string;
  fuente_origen?: "MICROSERVICIO_PYTHON" | "DATOS_LOCALES_EMULADOS";
}

export interface SugerenciaBusqueda {
  dni: string;
  nombre: string;
  origen: string;
}

export interface ProgramaCatalogoItem {
  id: string;
  nombre: string;
  area: string;
  descripcion: string;
  total_personas: number;
  total_beneficiarios: number;
  total_titulares: number;
}

export interface CruceProgramasResultado {
  total_coincidencias: number;
  programas_consultados: string[];
  modo: "interseccion" | "union";
  limite: number;
  offset: number;
  resultados: {
    dni: string;
    nombre: string;
    programas: string[];
    cantidad_programas: number;
    roles: Record<string, string>;
    contacto?: {
      telefono?: string;
      direccion?: string;
      barrio?: string;
      localidad?: string;
    };
  }[];
  distribucion_barrios?: { barrio: string; cantidad: number }[];
  distribucion_programas?: { programa: string; cantidad: number }[];
}

const API_BASE_URL = process.env.FICHA_SOCIAL_API_URL || "http://localhost:8000";

const MOCK_PROGRAMAS: ProgramaCatalogoItem[] = [
  { id: "jardines", nombre: "Jardines Municipales", area: "Educación y Primera Infancia", descripcion: "Inscripción en jardines de infantes y maternales municipales", total_personas: 3420, total_beneficiarios: 2850, total_titulares: 1950 },
  { id: "alimentar", nombre: "Tarjeta Alimentar", area: "Desarrollo Social", descripcion: "Asignación universal por hijo y módulo alimentario de emergencia", total_personas: 8940, total_beneficiarios: 7200, total_titulares: 4100 },
  { id: "centros_familia", nombre: "Centros de Familia", area: "Desarrollo Humano", descripcion: "Acompañamiento integral, talleres familiares y apoyo psicosocial", total_personas: 2150, total_beneficiarios: 1980, total_titulares: 850 },
  { id: "ninez", nombre: "Servicios Locales de Niñez", area: "Protección de Derechos", descripcion: "Intervenciones legales y seguimiento de vulnerabilidad infanto-juvenil", total_personas: 1280, total_beneficiarios: 980, total_titulares: 720 },
  { id: "envion", nombre: "Programa Envión", area: "Juventud y Empleo", descripcion: "Inclusión formativa, laboral y becas para jóvenes de 12 a 21 años", total_personas: 1650, total_beneficiarios: 1650, total_titulares: 0 },
  { id: "escuelas_arte", nombre: "Escuelas de Arte y Música", area: "Cultura", descripcion: "Formación artística en centros culturales y orquestas infantojuveniles", total_personas: 1890, total_beneficiarios: 1890, total_titulares: 940 },
  { id: "deportes", nombre: "Polideportivos y Deportes", area: "Deportes", descripcion: "Actividades recreativas, colonias de verano y ligas barriales", total_personas: 4200, total_beneficiarios: 4200, total_titulares: 1200 },
  { id: "ril_desarrollo", nombre: "RIL Desarrollo Humano", area: "Secretaría General", descripcion: "Registro territorial de familias vulnerables en asentamientos y villas", total_personas: 5600, total_beneficiarios: 5600, total_titulares: 2400 },
];

export function cleanDni(input: string): string {
  if (!input) return "";
  const cleaned = input.toString().replace(/[^0-9]/g, "");
  if (cleaned.length === 11 && ["20", "23", "24", "27", "30", "33"].some(p => cleaned.startsWith(p))) {
    return cleaned.substring(2, 10);
  }
  return cleaned;
}

export async function searchFichaSocialByDni(rawDni: string): Promise<FichaSocialPersonaResponse> {
  const dni = cleanDni(rawDni);
  if (!dni) {
    return { encontrado: false, mensaje: "Debe ingresar un DNI o CUIL válido." };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${API_BASE_URL}/api/buscar?dni=${dni}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { ...data, fuente_origen: "MICROSERVICIO_PYTHON" };
    }
  } catch (error) {}

  return getMockFichaSocial(dni);
}

export async function getSuggestions(query: string): Promise<SugerenciaBusqueda[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${API_BASE_URL}/api/sugerencias?q=${encodeURIComponent(query.trim())}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
  } catch (error) {}

  const mockDnis = [
    { dni: "38452147", nombre: "Pérez, Juan Carlos", origen: "Jardines Municipales / Tarjeta Alimentar" },
    { dni: "40123456", nombre: "González, María Elena", origen: "Centro de Familia / Envión" },
    { dni: "35987654", nombre: "Rodríguez, Lucas Agustín", origen: "Polideportivos / RIL" },
    { dni: "58963214", nombre: "Pérez, Mateo (Menor)", origen: "Jardines Municipales N° 901" },
    { dni: "32145879", nombre: "Fernández, Patricia Laura", origen: "Servicios Locales de Niñez" },
  ];

  const q = query.toLowerCase().trim();
  return mockDnis.filter(d => d.dni.includes(q) || d.nombre.toLowerCase().includes(q));
}

export async function getProgramCatalog(): Promise<ProgramaCatalogoItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${API_BASE_URL}/api/analisis/programas`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
  } catch (error) {}

  return MOCK_PROGRAMAS;
}

export async function calculateCrossPrograms(
  programas: string[],
  modo: "interseccion" | "union" = "interseccion",
  options?: { offset?: number; limit?: number; q?: string }
): Promise<CruceProgramasResultado> {
  const { offset = 0, limit = 50, q = "" } = options || {};
  const progsParam = programas.join("||");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `${API_BASE_URL}/api/analisis/cruce?programas=${encodeURIComponent(progsParam)}&modo=${modo}&offset=${offset}&limit=${limit}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
  } catch (error) {}

  return getMockCruceResultado(programas, modo, offset, limit, q);
}

export function getExportCsvUrl(programas: string[], modo: "interseccion" | "union" = "interseccion"): string {
  const progsParam = encodeURIComponent(programas.join("||"));
  return `${API_BASE_URL}/api/analisis/exportar_csv?programas=${progsParam}&modo=${modo}`;
}

function getMockFichaSocial(dni: string): FichaSocialPersonaResponse {
  const isJuan = dni === "38452147" || dni.endsWith("7");
  const nombre = isJuan ? "Juan Carlos Pérez" : "María Elena González";

  return {
    encontrado: true,
    dni,
    nombre_detectado: nombre,
    total_programas: 3,
    programas_activos: ["Jardines Municipales", "Tarjeta Alimentar", "Centro de Familia"],
    fuente_origen: "DATOS_LOCALES_EMULADOS",
    detalle_programas: {
      "Jardines Municipales": {
        roles: ["Titular / Responsable Adulto"],
        cantidad_registros: 1,
        registros: [
          {
            rol: "Titular / Responsable Adulto",
            datos_beneficiario: {
              nombre: "Mateo Pérez",
              dni: "58963214",
              fecha_nac: "2021-04-12",
              edad: 5,
              genero: "Masculino"
            },
            datos_contacto: {
              telefono: "11-4589-6321",
              direccion: "Av. San Martín 1234, Piso 2",
              localidad: "Caseros",
              barrio: "Villa Pineral"
            },
            datos_adicionales: {
              "Sede": "Jardín Maternal N° 901",
              "Turno": "Mañana",
              "Sala": "Sala de 4 años",
              "Estado": "Regular"
            }
          }
        ]
      },
      "Tarjeta Alimentar": {
        roles: ["Titular del Beneficio"],
        cantidad_registros: 1,
        registros: [
          {
            rol: "Titular del Beneficio",
            datos_beneficiario: { nombre, dni, genero: isJuan ? "Masculino" : "Femenino" },
            datos_contacto: {
              telefono: "11-4589-6321",
              direccion: "Av. San Martín 1234",
              localidad: "Caseros",
              barrio: "Villa Pineral"
            },
            datos_adicionales: {
              "Hijos Vinculados": 1,
              "Monto Mensual Asignado": "$ 54.000 ARS",
              "Entidad Pagadora": "Banco Provincia"
            }
          }
        ]
      },
      "Centro de Familia": {
        roles: ["Beneficiario Directo"],
        cantidad_registros: 1,
        registros: [
          {
            rol: "Beneficiario Directo",
            datos_beneficiario: { nombre, dni },
            datos_contacto: {
              telefono: "11-4589-6321",
              direccion: "Av. San Martín 1234",
              barrio: "Villa Pineral"
            },
            datos_adicionales: {
              "Sede": "Centro Comunitario N° 3",
              "Programa Específico": "Taller de Crianza y Apoyo Nutricional",
              "Asistente Social": "Lic. Romina Suárez"
            }
          }
        ]
      }
    },
    relaciones_familiares: [
      {
        dni: "58963214",
        nombre_completo: "Mateo Pérez",
        tipo_relacion: "Hijo/a o Menor a cargo",
        programas: ["Jardines Municipales"],
        telefono: "11-4589-6321",
        direccion: "Av. San Martín 1234"
      },
      {
        dni: "39112233",
        nombre_completo: "Lucía Florencia Gómez",
        tipo_relacion: "Cónyuge / Madre del menor",
        programas: ["Tarjeta Alimentar"],
        telefono: "11-9874-5612",
        direccion: "Av. San Martín 1234"
      }
    ]
  };
}

function getMockCruceResultado(
  programas: string[],
  modo: "interseccion" | "union",
  offset: number,
  limit: number,
  q: string
): CruceProgramasResultado {
  const mockPersonas = [
    {
      dni: "38452147",
      nombre: "Pérez, Juan Carlos",
      programas: ["Jardines Municipales", "Tarjeta Alimentar", "Centro de Familia"],
      cantidad_programas: 3,
      roles: { "Jardines Municipales": "Titular", "Tarjeta Alimentar": "Titular", "Centro de Familia": "Beneficiario" },
      contacto: { telefono: "11-4589-6321", direccion: "Av. San Martín 1234", barrio: "Villa Pineral", localidad: "Caseros" }
    },
    {
      dni: "40123456",
      nombre: "González, María Elena",
      programas: ["Tarjeta Alimentar", "Centro de Familia", "Programa Envión"],
      cantidad_programas: 3,
      roles: { "Tarjeta Alimentar": "Titular", "Centro de Familia": "Titular", "Programa Envión": "Tutor" },
      contacto: { telefono: "11-6543-2198", direccion: "Calle 102 N° 450", barrio: "Ejército de los Andes", localidad: "Ciudadela" }
    },
    {
      dni: "35987654",
      nombre: "Rodríguez, Lucas Agustín",
      programas: ["Jardines Municipales", "Polideportivos y Deportes"],
      cantidad_programas: 2,
      roles: { "Jardines Municipales": "Titular", "Polideportivos y Deportes": "Beneficiario" },
      contacto: { telefono: "11-3322-1100", direccion: "Alberdi 890", barrio: "Santos Lugares", localidad: "Santos Lugares" }
    },
    {
      dni: "32145879",
      nombre: "Fernández, Patricia Laura",
      programas: ["Tarjeta Alimentar", "Servicios Locales de Niñez", "RIL Desarrollo Humano"],
      cantidad_programas: 3,
      roles: { "Tarjeta Alimentar": "Titular", "Servicios Locales de Niñez": "Adulto a Cargo", "RIL Desarrollo Humano": "Censo Familiar" },
      contacto: { telefono: "11-7788-9900", direccion: "Churruca 2140", barrio: "Puerta 8", localidad: "Churruca" }
    },
    {
      dni: "37456123",
      nombre: "López, Sergio Damián",
      programas: ["Jardines Municipales", "Tarjeta Alimentar"],
      cantidad_programas: 2,
      roles: { "Jardines Municipales": "Titular", "Tarjeta Alimentar": "Titular" },
      contacto: { telefono: "11-5544-3322", direccion: "Av. Gaona 3400", barrio: "Villa Raffo", localidad: "Villa Raffo" }
    },
    {
      dni: "41987321",
      nombre: "Martínez, Camila Belén",
      programas: ["Programa Envión", "Escuelas de Arte y Música"],
      cantidad_programas: 2,
      roles: { "Programa Envión": "Beneficiario", "Escuelas de Arte y Música": "Alumna" },
      contacto: { telefono: "11-2211-9988", direccion: "Wenceslao de Tata 4500", barrio: "Caseros Centro", localidad: "Caseros" }
    },
  ];

  const filtered = mockPersonas.filter(p => {
    if (q) {
      const matchQ = p.dni.includes(q) ||
        p.nombre.toLowerCase().includes(q.toLowerCase()) ||
        p.contacto.barrio.toLowerCase().includes(q.toLowerCase()) ||
        p.contacto.localidad.toLowerCase().includes(q.toLowerCase());
      if (!matchQ) return false;
    }

    if (programas.length === 0) return true;

    if (modo === "interseccion") {
      return programas.every(prog => p.programas.includes(prog));
    } else {
      return programas.some(prog => p.programas.includes(prog));
    }
  });

  return {
    total_coincidencias: filtered.length,
    programas_consultados: programas,
    modo,
    limite: limit,
    offset,
    resultados: filtered.slice(offset, offset + limit),
    distribucion_barrios: [
      { barrio: "Villa Pineral", cantidad: 45 },
      { barrio: "Ejército de los Andes", cantidad: 82 },
      { barrio: "Puerta 8", cantidad: 38 },
      { barrio: "Churruca", cantidad: 29 },
      { barrio: "Santos Lugares", cantidad: 18 },
      { barrio: "Caseros Centro", cantidad: 14 },
    ],
    distribucion_programas: programas.map(p => ({
      programa: p,
      cantidad: Math.floor(Math.random() * 400) + 120
    }))
  };
}

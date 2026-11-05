/**
 * Novedades de la app, de la más nueva a la más vieja. Después de cada actualización con cambios
 * que se ven, se agrega una entrada arriba: al entrar, cada persona ve una vez la más nueva
 * (components/layout/novedades-aviso.tsx) y todas quedan en /novedades.
 * Textos cortos, en voseo y sin nombres técnicos.
 */
export interface Novedad {
  /** Fecha en formato aaaa-mm-dd. */
  fecha: string;
  /** Si hay más de una actualización el mismo día: 2, 3… (la primera no lo lleva). */
  parte?: number;
  titulo: string;
  cambios: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    fecha: "2026-11-05",
    parte: 4,
    titulo: "El Asistente de IA anota lo que todavía no sabe responder",
    cambios: [
      "Cuando el asistente no entiende una pregunta, la anota para que podamos enseñársela. Se guarda solo la pregunta, sin la respuesta ni tu nombre, y los DNI y teléfonos quedan tapados.",
      "Esas preguntas se borran solas a los 60 días.",
    ],
  },
  {
    fecha: "2026-11-05",
    parte: 3,
    titulo: "El Asistente de IA entiende más preguntas de expedientes",
    cambios: [
      "Le podés preguntar por los expedientes con movimiento o sin movimiento en los días que quieras: \"los que tuvieron movimiento esta semana\" o \"sin movimiento hace 60 días\".",
      "Si preguntás \"¿cuáles son?\", te muestra hasta 20 expedientes con su área, su prioridad y su última intervención. Tocá uno para abrirlo.",
      "Sigue la charla: después de una respuesta podés preguntar \"¿y cuáles?\", \"¿y de Niñez?\" o \"¿y los urgentes?\" sin repetir todo.",
    ],
  },
  {
    fecha: "2026-11-05",
    parte: 2,
    titulo: "El Asistente de IA guarda tus conversaciones",
    cambios: [
      "Tus conversaciones con el asistente quedan guardadas: las ves al costado en \"Conversaciones anteriores\" y podés seguir cualquiera. Solo vos las ves, y se borran solas 10 días después de la última pregunta.",
      "Las respuestas muestran arriba los números importantes en grande, como en el Inicio. Tocalos para abrir esa lista.",
      "Cada área, persona, legajo, programa, barrio o curso de una respuesta es un enlace a su página.",
      "Los gráficos muestran el número arriba de cada barra y usan los colores de siempre (por ejemplo, rojo para lo urgente). Los datos se descargan en Excel.",
    ],
  },
  {
    fecha: "2026-11-05",
    titulo: "El Asistente de IA entiende mejor y te pide confirmar",
    cambios: [
      "Entiende las preguntas escritas a tu manera: elige qué consultar y con qué filtros, por ejemplo \"expedientes urgentes sin movimiento de Niñez\".",
      "Antes de agendar una tarea o pedir un vehículo te muestra lo que va a cargar, y se guarda recién cuando tocás \"Confirmar\". Los vehículos quedan pendientes hasta que los aprueben, como en la pantalla de reservas.",
      "Quien dirige un área ve en las respuestas solo los datos de su área, como en el resto de la app.",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 7,
    titulo: "Un Asistente de IA más cómodo",
    cambios: [
      "La conversación va al centro, con letra más grande, y tus preguntas se ven en azul.",
      "Al entrar te muestra preguntas de ejemplo por tema, y ahora también contesta sobre licencias, programas, barrios, cursos y tus tareas.",
      "Mientras busca te dice dónde está buscando, y podés frenar la respuesta.",
      "Las respuestas usan palabras más simples.",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 6,
    titulo: "La situación de revista sigue a las licencias",
    cambios: [
      "Cuando arranca una licencia o unas vacaciones cargadas, la situación del legajo cambia sola.",
      "Al terminar no vuelve sola a Activo: Recursos Humanos avisa quién terminó y hay que confirmar con \"Ya volvió\".",
      "La situación de revista ahora es Activo, Licencia, Licencia sin goce, Vacaciones o Baja. El tipo de licencia se ve en el legajo.",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 5,
    titulo: "Licencias y ausencias del personal",
    cambios: [
      "Cada legajo tiene su historial de licencias y vacaciones, con fechas, tipo y cuántos días tomó en el año. Se cargan con \"Registrar licencia\".",
      "Nueva pantalla \"Ausencias del mes\" en Recursos Humanos: quién falta cada día, por área.",
      "La remuneración muestra los puntos de miles mientras la escribís.",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 4,
    titulo: "Cada legajo en su propia página",
    cambios: [
      "Ver legajo y Editar legajo se abren en su propia página, con el mismo diseño que Nuevo agente. También podés tocar el nombre en la lista.",
      "Las partes del legajo tienen nombres más formales: Datos personales, Datos de contacto, Contacto de emergencia, Área de trabajo, Contrato y remuneración, Situación de revista e Información adicional.",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 3,
    titulo: "Nuevo agente, más fácil de cargar",
    cambios: [
      "Nuevo agente tiene su propia página, en dos columnas y con \"Crear legajo\" siempre a la vista.",
      "Podés cargar teléfono, correo, domicilio, fecha de nacimiento y a quién avisar si le pasa algo.",
      "El horario se elige con los días y las horas de entrada y salida.",
      "Lo que no hace falta siempre (foto, tareas, salud, estudios y licencia de conducir) queda en \"Agregar más datos\".",
    ],
  },
  {
    fecha: "2026-11-04",
    parte: 2,
    titulo: "Sin el aviso de emergencia climática",
    cambios: [
      "Sacamos el botón para prender la emergencia climática y la franja roja que aparecía arriba: no cambiaban nada más en la app.",
      "Las fichas de tormenta, las entregas y el stock de contingencia siguen igual en Emergencia climática.",
    ],
  },
  {
    fecha: "2026-11-04",
    titulo: "Reservar un vehículo, ahora con calendario",
    cambios: [
      "Al reservar ves la semana del vehículo con los horarios ocupados pintados: aprobados, pendientes y en uso.",
      "Elegís el horario arrastrando en la grilla (en el celular, tocás la salida y después la vuelta).",
      "En \"¿Cuál está libre?\" ves todos los vehículos de un día y elegís el que está libre a la hora que necesitás.",
    ],
  },
  {
    fecha: "2026-11-03",
    parte: 5,
    titulo: "Expedientes más ágiles y tareas más fáciles de compartir",
    cambios: [
      "En cada expediente hay un botón \"Nueva intervención\" arriba y otro para imprimirlo con el membrete de la Municipalidad.",
      "Al abrir un expediente nuevo, te avisa si la persona ya tiene uno abierto en esa área.",
      "En la lista de Expedientes, con un área elegida, podés tildar varios y dejar a una persona a cargo de todos juntos.",
      "Podés guardar los filtros que usás seguido con un nombre y volver a ellos con un toque.",
      "Al compartir una tarea desde la Agenda, buscás a la persona por su nombre o su área.",
    ],
  },
  {
    fecha: "2026-11-03",
    parte: 4,
    titulo: "Cruces de programas, mapa de barrios y cursos más claros",
    cambios: [
      "En Cruces de programas elegís los programas como etiquetas y el resultado se actualiza solo, con una frase que dice qué se está contando.",
      "Hay tres tipos de cruce: Coincidencia (en todos los programas), Cobertura (en al menos uno) y Exclusión (en el programa base y en ninguno de los demás).",
      "En la lista de personas del cruce, cada una muestra sus programas con el nombre completo. El número grande no cambia al buscar en la lista.",
      "En Barrios hay un mapa del distrito con cada barrio pintado según su gente o sus expedientes abiertos. Tocá un barrio para abrirlo. En la tabla, los ceros ahora son una raya.",
      "En los cursos, la asistencia de cada inscripto dice \"3 presentes · 1 ausente\" en lugar de abreviaturas, y el aviso de que el curso no terminó aparece una sola vez.",
    ],
  },
  {
    fecha: "2026-11-03",
    parte: 3,
    titulo: "Lo de hoy bajo el saludo y números que llevan a su lista",
    cambios: [
      "Debajo del saludo del Inicio, una frase con lo que tenés para hoy: tareas, expedientes sin movimiento y derivaciones por responder. Cada parte lleva a su lista.",
      "Las tarjetas de números de Expedientes, de las páginas de cada área, de Stock y de Recursos Humanos abren la lista con ese filtro: tocar \"Urgentes\" muestra esos expedientes.",
      "La pestaña del navegador muestra cuántos avisos sin leer tenés, por ejemplo \"(3) Inicio\".",
      "Quien entra por primera vez ve una bienvenida con lo básico de su rol. Se puede volver a ver desde el botón \"?\" de arriba.",
    ],
  },
  {
    fecha: "2026-11-03",
    parte: 2,
    titulo: "Un Inicio a tu medida, atajos y una guía en cada pantalla",
    cambios: [
      "Con \"Ordenar tarjetas\" elegís el orden de las tarjetas del Inicio y podés esconder las que no usás.",
      "Las tareas vencidas se ven en rojo en el Inicio. Quien administra la flota también ve ahí los vehículos con la VTV o el seguro vencido.",
      "El botón \"?\" de arriba abre la guía \"¿Cómo hago para…?\" de la pantalla en la que estás.",
      "Atajos de teclado: / para buscar, N para un expediente nuevo, G para la guía y ? para ver todos.",
    ],
  },
  {
    fecha: "2026-11-03",
    titulo: "Gráficos e iniciales con los colores de la Municipalidad",
    cambios: [
      "Los gráficos usan primero el azul y el naranja de la Municipalidad, y después celeste, verde azulado, violeta y gris, para que se distingan bien.",
      "Los círculos con las iniciales de cada persona tienen tonos más suaves y parejos.",
    ],
  },
  {
    fecha: "2026-11-02",
    titulo: "Más claro y con los colores de la Municipalidad",
    cambios: [
      "La ficha de cada persona arranca con una credencial azul: nombre, DNI, edad, expedientes abiertos y programas, con los botones Llamar, Editar datos y Nuevo expediente.",
      "La Ficha Social 360° salió del menú: a cada persona la encontrás en el Registro Único o con el buscador de arriba. Cruces de programas está en Registro Único › Programas.",
      "La Sala de Situación tiene \"Pantalla completa\", para verla en una tele o un proyector.",
      "En el Inicio, los números van en azul y el naranja marca solo lo que pide atención.",
      "En las listas largas, los títulos de las columnas quedan a la vista mientras bajás.",
      "La planilla de emergencia muestra los totales arriba, y cada familia se carga en una ficha con campos grandes.",
      "En la pantalla de ingreso está \"¿Te olvidaste la contraseña?\", con a quién pedir una clave temporal.",
      "El encabezado y la barra lateral usan el azul y el naranja de la Municipalidad, y los nombres del padrón se ven con mayúscula inicial.",
    ],
  },
  {
    fecha: "2026-10-30",
    titulo: "Pantallas más prolijas",
    cambios: [
      "Los estados (abierto, en espera, urgente, cerrado…) tienen el mismo color en toda la app.",
      "Las tablas son más aireadas y la fila se marca al pasar el mouse.",
      "Los formularios largos, como Nueva orden de compra, están ordenados en secciones y los datos obligatorios se marcan igual en todos.",
      "Cada sección del menú tiene su color, para ubicarte más rápido.",
    ],
  },
];

/** La entrada más nueva (la que se muestra una vez al entrar). */
/** Dónde guarda cada navegador la última novedad que ya se vio. */
export const NOVEDADES_VISTAS_KEY = "muni-novedades-vistas";

export const ULTIMA_NOVEDAD: Novedad | null = NOVEDADES[0] ?? null;

/** "2 de noviembre de 2026" a partir de "2026-11-02". */
export function fechaNovedad(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Identifica cada entrada (lo que se guarda como "ya vista"): la fecha, y la parte si hubo más de una ese día. */
export function claveNovedad(n: Novedad): string {
  return n.parte && n.parte > 1 ? `${n.fecha}-${n.parte}` : n.fecha;
}

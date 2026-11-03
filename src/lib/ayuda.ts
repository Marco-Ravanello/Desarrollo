// Guía rápida "¿Cómo hago para…?" de cada pantalla (botón "?" del encabezado, tecla G).
// Textos cortos, en voseo, con los nombres de los botones tal como se ven en la app.
// Sin base de datos, para poder probarlo solo.

export interface Pregunta {
  p: string;
  /** Pasos, en orden. */
  r: string[];
}

export interface GuiaPantalla {
  /** Nombre de la pantalla, como en el menú. */
  pantalla: string;
  preguntas: Pregunta[];
}

const BUSCAR: Pregunta = {
  p: "¿Cómo encuentro a una persona o un expediente?",
  r: [
    "Tocá \"Buscar o ir a…\" arriba del menú, o apretá la tecla /.",
    "Escribí el DNI, el apellido o el número de expediente.",
    "Elegí el resultado para abrirlo.",
  ],
};

/** De la más específica a la más general: gana la primera cuyo patrón coincide. */
const GUIAS: { patron: RegExp; guia: GuiaPantalla }[] = [
  {
    patron: /^\/dashboard\/?$/,
    guia: {
      pantalla: "Inicio",
      preguntas: [
        {
          p: "¿Qué muestra el Inicio?",
          r: [
            "Arriba están los números principales de tu rol: tocá uno para ver la lista que cuenta.",
            "El naranja marca lo que pide atención y el rojo, lo vencido.",
          ],
        },
        {
          p: "¿Cómo cambio el orden de las tarjetas?",
          r: [
            "Tocá \"Ordenar tarjetas\", arriba a la derecha.",
            "Subí o bajá cada tarjeta con las flechas, o destildala para esconderla.",
            "Tocá \"Guardar\". Con \"Volver al orden original\" queda como estaba.",
          ],
        },
        BUSCAR,
      ],
    },
  },
  {
    patron: /^\/people\/new/,
    guia: {
      pantalla: "Cargar persona",
      preguntas: [
        {
          p: "¿Cómo cargo a una persona nueva?",
          r: [
            "Completá el DNI, el nombre y el apellido (son obligatorios).",
            "En el domicilio elegí la calle y la localidad de la lista, así la persona queda ubicada en el mapa.",
            "Tocá \"Cargar persona\". Si el DNI ya está cargado, la app te avisa y no lo pisa.",
          ],
        },
      ],
    },
  },
  {
    patron: /^\/people\/programas/,
    guia: {
      pantalla: "Programas",
      preguntas: [
        {
          p: "¿Cómo veo quiénes están en un programa?",
          r: ["Tocá el programa en la lista.", "En su página están las personas, los barrios y las altas y bajas de cada mes."],
        },
        {
          p: "¿Cómo doy de alta o de baja a alguien en un programa?",
          r: [
            "Abrí la ficha de la persona y entrá en la pestaña \"Programas\".",
            "Tocá \"Dar de alta en un programa\", o la baja del programa que corresponda, y anotá el motivo.",
          ],
        },
        {
          p: "¿Cómo cruzo dos o más programas?",
          r: ["En Programas, tocá \"Cruces de programas\".", "Elegí los programas y mirá quiénes están en todos o en alguno."],
        },
      ],
    },
  },
  {
    patron: /^\/people\/[^/]+/,
    guia: {
      pantalla: "Ficha de la persona",
      preguntas: [
        {
          p: "¿Cómo corrijo los datos de la persona?",
          r: [
            "Tocá \"Editar datos\" en la franja azul de arriba.",
            "Cambiá lo que haga falta (el DNI no se puede cambiar) y guardá.",
            "Si cambia el domicilio, la app la vuelve a ubicar en el mapa. Los cambios quedan en \"Historia\".",
          ],
        },
        {
          p: "¿Cómo abro un expediente para esta persona?",
          r: ["Tocá \"Nuevo expediente\" en la franja azul. La persona ya queda elegida."],
        },
        {
          p: "¿Dónde veo todo lo que se hizo con ella?",
          r: [
            "\"Expedientes\": los abiertos y cerrados.",
            "\"Historia\": intervenciones, cambios de datos, visitas y entregas, del más nuevo al más viejo.",
            "\"Familia\": su grupo familiar y la atención municipal de cada integrante.",
          ],
        },
      ],
    },
  },
  {
    patron: /^\/people\/?$/,
    guia: {
      pantalla: "Registro Único",
      preguntas: [
        {
          p: "¿Cómo busco a alguien en el padrón?",
          r: [
            "Escribí el DNI, el apellido, el nombre o la dirección en el buscador de la lista.",
            "Si querés, filtrá por barrio o por programa y tocá \"Buscar\".",
            "Tocá \"Ver ficha\" para abrir a la persona.",
          ],
        },
        {
          p: "¿Cómo cargo a una persona que no está?",
          r: ["Tocá \"Cargar persona\" arriba a la derecha."],
        },
      ],
    },
  },
  {
    patron: /^\/cases\/new/,
    guia: {
      pantalla: "Nuevo expediente",
      preguntas: [
        {
          p: "¿Cómo abro un expediente?",
          r: [
            "Buscá a la persona por DNI o apellido y elegila.",
            "Escribí la carátula y la descripción, y elegí el área y la prioridad.",
            "Si corresponde, marcá las etiquetas (adulto mayor, discapacidad…).",
            "Tocá \"Abrir expediente\".",
          ],
        },
      ],
    },
  },
  {
    patron: /^\/cases\/derivaciones/,
    guia: {
      pantalla: "Derivaciones",
      preguntas: [
        {
          p: "¿Cómo respondo una derivación?",
          r: ["Abrí la derivación.", "Aceptala para que el expediente pase a tu área, o rechazala explicando por qué."],
        },
      ],
    },
  },
  {
    patron: /^\/cases\/equipo/,
    guia: {
      pantalla: "Carga del equipo",
      preguntas: [
        {
          p: "¿Cómo reparto los expedientes sin profesional?",
          r: ["En \"Sin profesional a cargo\", tocá \"Asignar a\".", "La app sugiere primero a quien tiene menos expedientes abiertos."],
        },
      ],
    },
  },
  {
    patron: /^\/cases\/[^/]+/,
    guia: {
      pantalla: "Expediente",
      preguntas: [
        {
          p: "¿Cómo registro lo que se hizo?",
          r: ["Tocá \"Nueva intervención\".", "Elegí el tipo, escribí qué se hizo y guardá. Queda en \"Historia\"."],
        },
        {
          p: "¿Cómo lo paso a otra área?",
          r: ["Tocá \"Derivar\" arriba.", "Elegí el área y explicá el motivo. El área tiene que aceptarla."],
        },
        {
          p: "¿Cómo agendo volver a llamar o visitar?",
          r: ["Tocá \"Agendar seguimiento\" y elegí el día.", "Ese día te llega un aviso a la campanita."],
        },
        {
          p: "¿Cómo lo cierro?",
          r: ["Tocá \"Cerrar expediente\" y escribí el motivo.", "Si hace falta, después se puede reabrir."],
        },
      ],
    },
  },
  {
    patron: /^\/cases\/?$/,
    guia: {
      pantalla: "Expedientes",
      preguntas: [
        {
          p: "¿Cómo veo solo los míos?",
          r: ["Tocá \"Mis expedientes\" en los filtros."],
        },
        {
          p: "¿Cómo encuentro los que están quietos?",
          r: ["En los filtros, tildá \"Solo los que no tuvieron intervenciones hace 30 días o más\"."],
        },
        {
          p: "¿Cómo abro uno nuevo?",
          r: ["Tocá \"Nuevo expediente\" o apretá la tecla N."],
        },
      ],
    },
  },
  {
    patron: /^\/maps/,
    guia: {
      pantalla: "Mapa Social",
      preguntas: [
        {
          p: "¿Cómo filtro lo que muestra el mapa?",
          r: [
            "Elegí barrio, programa o capa (padrón, expedientes abiertos, fichas de emergencia).",
            "Podés comparar hasta tres programas: cada uno tiene su color.",
          ],
        },
        {
          p: "¿Qué hago con las personas que no aparecen?",
          r: ["Entrá en \"Ubicar en el mapa\" y buscá las direcciones que faltan, o revisalas una por una."],
        },
      ],
    },
  },
  {
    patron: /^\/barrios\/recorridas/,
    guia: {
      pantalla: "Recorrida",
      preguntas: [
        {
          p: "¿Cómo anoto lo que pasó en cada visita?",
          r: ["Elegí el resultado de cada persona y agregá una nota si hace falta.", "Al final, anotá los hallazgos y lo pendiente."],
        },
      ],
    },
  },
  {
    patron: /^\/barrios\/[^/]+\/recorrida/,
    guia: {
      pantalla: "Preparar recorrida",
      preguntas: [
        {
          p: "¿Cómo armo la lista para salir al barrio?",
          r: [
            "Elegí los motivos (expedientes quietos, urgentes, seguimientos…) y, si querés, una calle.",
            "La lista sale ordenada por calle y vereda. Quienes fueron visitados hace menos de 30 días no aparecen.",
          ],
        },
      ],
    },
  },
  {
    patron: /^\/barrios/,
    guia: {
      pantalla: "Barrios",
      preguntas: [
        {
          p: "¿Qué veo en la página de un barrio?",
          r: ["El resumen con programas, expedientes abiertos y lugares de referencia.", "Las pestañas Mapa, Recorridas y Personas del barrio."],
        },
        {
          p: "¿Cómo preparo una recorrida?",
          r: ["Dentro del barrio, tocá \"Preparar recorrida\"."],
        },
      ],
    },
  },
  {
    patron: /^\/tasks/,
    guia: {
      pantalla: "Mis tareas",
      preguntas: [
        {
          p: "¿Cómo agrego una tarea?",
          r: ["Tocá \"Agregar tarea\".", "Poné el título, la fecha, la prioridad y, si querés, con quién compartirla o que se repita.", "Guardá."],
        },
        {
          p: "¿Cómo la marco como hecha?",
          r: ["Tocá el círculo al lado de la tarea. Si se repite, aparece sola la próxima."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/calendar/,
    guia: {
      pantalla: "Agenda",
      preguntas: [
        {
          p: "¿Cómo agrego algo a la agenda?",
          r: ["En la vista Semana o Día, tocá un horario libre: se abre una tarea nueva con ese día y hora."],
        },
        {
          p: "¿Cómo elijo qué se ve?",
          r: ["Usá los botones Vehículos, Entregas y Tareas para mostrar u ocultar cada cosa."],
        },
      ],
    },
  },
  {
    patron: /^\/cursos/,
    guia: {
      pantalla: "Cursos y talleres",
      preguntas: [
        {
          p: "¿Cómo inscribo a alguien?",
          r: ["Abrí el curso y usá \"Inscribir por DNI\"."],
        },
        {
          p: "¿Cómo tomo asistencia?",
          r: ["Abrí el curso y tocá \"Tomar asistencia de hoy\".", "Marcá a cada persona. Quien no se marca queda ausente."],
        },
        {
          p: "¿Cómo saco los certificados?",
          r: ["Cuando el curso está terminado, entrá en \"Certificados\": salen para quien llegó a la asistencia mínima."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/purchase-orders/,
    guia: {
      pantalla: "Órdenes de compra",
      preguntas: [
        {
          p: "¿Cómo cargo una orden?",
          r: ["Tocá \"Nueva orden\".", "Elegí el proveedor, cargá qué se compra con cantidad y precio, y guardá."],
        },
        {
          p: "¿Cómo registro lo que llegó?",
          r: ["Abrí la orden y tocá \"Registrar entrega\" con las cantidades recibidas."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/vehicles/,
    guia: {
      pantalla: "Vehículos",
      preguntas: [
        {
          p: "¿Cómo reservo un vehículo?",
          r: ["Entrá en \"Reservar\", elegí el vehículo, el día y el horario, y contá para qué es."],
        },
        {
          p: "¿Cómo cargo combustible?",
          r: ["Entrá en Combustible y tocá \"Nueva carga\". También podés cargar la foto del ticket."],
        },
        {
          p: "¿Cómo actualizo la VTV o el seguro?",
          r: ["Abrí el vehículo y cargá la fecha nueva. Los avisos de vencimiento se reinician solos."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/emergency/,
    guia: {
      pantalla: "Emergencia climática",
      preguntas: [
        {
          p: "¿Cómo cargo una familia afectada?",
          r: ["Completá los datos de la familia en la ficha y lo que se le entregó.", "Guardá. Se puede imprimir la constancia de entrega."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/users/,
    guia: {
      pantalla: "Usuarios",
      preguntas: [
        {
          p: "¿Cómo creo un usuario?",
          r: ["Tocá \"Nuevo usuario\" (solo Superadmin).", "Completá nombre, usuario, rol y área. La clave temporal se muestra una sola vez."],
        },
        {
          p: "¿Qué hago si alguien se olvidó la contraseña?",
          r: ["Tocá \"Clave temporal\" en su fila y pasale la clave. Al entrar, tiene que elegir una nueva."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/stock/,
    guia: {
      pantalla: "Stock de insumos",
      preguntas: [
        {
          p: "¿Cómo agrego un insumo?",
          r: ["Tocá \"Nuevo insumo\" y cargá cuántos hay hoy y el mínimo para reponer."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/hr/,
    guia: {
      pantalla: "Recursos Humanos",
      preguntas: [
        {
          p: "¿Cómo cargo un agente?",
          r: ["Tocá \"Nuevo agente\" y completá el legajo."],
        },
      ],
    },
  },
  {
    patron: /^\/admin\/reports/,
    guia: {
      pantalla: "Reportes",
      preguntas: [
        {
          p: "¿Cómo cambio el período?",
          r: ["Elegí las fechas \"Desde\" y \"Hasta\" y tocá \"Aplicar\", o usá los botones de período."],
        },
        {
          p: "¿Cómo bajo los datos?",
          r: ["Cada tabla tiene su botón \"Exportar\"."],
        },
      ],
    },
  },
];

const GENERAL: GuiaPantalla = {
  pantalla: "Esta pantalla",
  preguntas: [
    BUSCAR,
    {
      p: "¿Cómo vuelvo a la pantalla anterior?",
      r: ["Usá el camino de arriba (por ejemplo \"Inicio › Expedientes\") o el menú de la izquierda."],
    },
  ],
};

/** La guía de la pantalla abierta. Las que no tienen guía propia muestran la general. */
export function guiaPara(pathname: string): GuiaPantalla {
  return GUIAS.find((g) => g.patron.test(pathname))?.guia ?? GENERAL;
}

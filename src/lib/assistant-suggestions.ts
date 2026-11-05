// Las preguntas de ejemplo de la bienvenida del asistente, por tema. Están escritas como las haría una
// persona, y cada una tiene que tener respuesta (hay una prueba que lo revisa).

export type SuggestionTopic = {
  id: "expedientes" | "personas" | "rrhh" | "compras" | "vehiculos" | "cursos";
  title: string;
  questions: string[];
};

export const ASSISTANT_TOPICS: SuggestionTopic[] = [
  {
    id: "expedientes",
    title: "Expedientes",
    questions: [
      "¿Cuántos expedientes abiertos hay y cuántos son urgentes?",
      "Mostrame un gráfico de expedientes por área",
      "Mostrame un gráfico de expedientes por prioridad",
    ],
  },
  {
    id: "personas",
    title: "Programas y barrios",
    questions: ["¿Cuántas personas hay en cada programa?", "¿Cuántas personas y expedientes abiertos hay en cada barrio?"],
  },
  {
    id: "rrhh",
    title: "Recursos Humanos",
    questions: ["¿Quién está de licencia o de vacaciones hoy?", "¿Cuánto se gasta en sueldos del personal activo?"],
  },
  {
    id: "compras",
    title: "Compras, stock y convenios",
    questions: ["¿Cómo viene la ejecución del presupuesto?", "¿Qué insumos tienen poco stock?", "¿Cuántos convenios hay vigentes?"],
  },
  {
    id: "vehiculos",
    title: "Vehículos",
    questions: ["¿Cómo está la flota de vehículos?", "¿Qué vehículos tienen la VTV o el seguro vencido?"],
  },
  {
    id: "cursos",
    title: "Cursos y tareas",
    questions: ["¿Qué cursos y talleres están abiertos?", "¿Qué tareas tengo pendientes?"],
  },
];

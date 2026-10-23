import prisma from "@/lib/prisma";
import { isTaskVisibleTo } from "@/lib/agenda";

/**
 * Las tareas con fecha que esta persona puede ver en la Agenda: las suyas y las que le compartieron.
 * Se filtra acá, en el servidor, para que las tareas (y los seguimientos de expedientes) de los demás
 * no lleguen al navegador.
 */
export async function getAgendaTasks(userId: string) {
  const rows = await prisma.task.findMany({
    where: {
      dueDate: { not: null },
      OR: [{ userId }, { viewerIds: { contains: userId } }],
    },
    include: {
      user: { select: { id: true, name: true, area: { select: { name: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });
  // "contains" busca el texto; acá se confirma que el id esté entero en la lista.
  return rows.filter((t) => isTaskVisibleTo(t, userId));
}

import prisma from "@/lib/prisma";

// Uso interno del servidor. No está en un archivo "use server" para que no se
// pueda llamar desde el navegador y crear avisos a nombre de otra persona.
export async function createNotification(userId: string, title: string, message: string, link?: string) {
  return await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      link,
      read: false
    }
  });
}

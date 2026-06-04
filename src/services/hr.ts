import prisma from "@/lib/prisma";
export async function getHRRecords() { return await prisma.hRRecord.findMany({ include: { area: true }, orderBy: { lastName: 'asc' } }); }
export async function createHRRecord(data: any) { return await prisma.hRRecord.create({ data: { firstName: data.firstName, lastName: data.lastName, dni: data.dni, fileNumber: data.fileNumber, startDate: data.startDate ? new Date(data.startDate) : null, position: data.position, areaId: data.areaId || null, status: data.status || 'ACTIVO' } }); }

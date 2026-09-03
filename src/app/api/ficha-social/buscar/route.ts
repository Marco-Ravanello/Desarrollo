import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function cleanDni(input: string): string {
  if (!input) return "";
  const cleaned = input.toString().replace(/[^0-9]/g, "");
  if (cleaned.length === 11 && ["20", "23", "24", "27", "30", "33"].some((p) => cleaned.startsWith(p))) {
    return cleaned.substring(2, 10);
  }
  return cleaned;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDni = searchParams.get("dni") || "";
    const dni = cleanDni(rawDni);

    if (!dni) {
      return NextResponse.json({ encontrado: false, mensaje: "DNI o CUIL inválido" }, { status: 400 });
    }

    const padronRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM padron_unificado WHERE dni = $1 LIMIT 1;`,
      dni
    );

    if (!padronRows || padronRows.length === 0) {
      return NextResponse.json({
        encontrado: false,
        dni,
        mensaje: `No se encontraron registros para el DNI ${dni} en las bases de programas sociales.`
      });
    }

    const persona = padronRows[0];

    const partRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM participaciones_programas WHERE dni = $1 ORDER BY programa ASC;`,
      dni
    );

    const relaciones: any[] = [];
    if (persona.nombres_familiares) {
      const famNombres = persona.nombres_familiares.split(";").map((n: string) => n.trim()).filter(Boolean);
      const famDnis = (persona.dnis_familiares || "").split(",").map((d: string) => d.trim()).filter(Boolean);

      famNombres.forEach((item: string, idx: number) => {
        let tipoRel = "Familiar";
        let nombre = item;
        const match = item.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          nombre = match[1].trim();
          tipoRel = match[2].trim();
        }
        const relDni = famDnis[idx] || famDnis[0] || "N/R";
        relaciones.push({
          dni: relDni,
          nombre_completo: nombre,
          tipo_relacion: tipoRel,
          programas: (persona.programas_activos || "").split("|").map((p: string) => p.trim()).filter(Boolean),
          telefono: persona.telefono || "",
          direccion: persona.direccion || ""
        });
      });
    }

    const detalleProgramas: Record<string, any> = {};

    if (partRows && partRows.length > 0) {
      partRows.forEach((p: any) => {
        const progName = p.programa || "Programa Municipal";
        if (!detalleProgramas[progName]) {
          detalleProgramas[progName] = {
            roles: [],
            cantidad_registros: 0,
            registros: []
          };
        }

        if (p.roles && !detalleProgramas[progName].roles.includes(p.roles)) {
          detalleProgramas[progName].roles.push(p.roles);
        }

        detalleProgramas[progName].cantidad_registros += (p.cantidad_registros || 1);

        const datosAdicionales: Record<string, any> = {};
        if (p.detalle_destacado) {
          const pairs = p.detalle_destacado.split("|");
          pairs.forEach((pair: string) => {
            const kv = pair.split(":");
            if (kv.length >= 2) {
              datosAdicionales[kv[0].trim()] = kv.slice(1).join(":").trim();
            } else if (pair.trim()) {
              datosAdicionales["Información"] = pair.trim();
            }
          });
        }

        detalleProgramas[progName].registros.push({
          rol: p.roles || "Beneficiario",
          datos_beneficiario: {
            nombre: p.nombre_completo || persona.nombre_completo,
            dni: p.dni
          },
          datos_contacto: {
            telefono: p.telefono || persona.telefono,
            direccion: p.direccion || persona.direccion,
            barrio: p.barrio || persona.barrio,
            localidad: p.localidad || persona.localidad
          },
          datos_adicionales: datosAdicionales
        });
      });
    } else if (persona.programas_activos) {
      const progs = persona.programas_activos.split("|").map((p: string) => p.trim()).filter(Boolean);
      progs.forEach((progName: string) => {
        detalleProgramas[progName] = {
          roles: (persona.roles || "").split(",").map((r: string) => r.trim()).filter(Boolean),
          cantidad_registros: 1,
          registros: [
            {
              rol: persona.roles || "Beneficiario",
              datos_beneficiario: { nombre: persona.nombre_completo, dni: persona.dni },
              datos_contacto: {
                telefono: persona.telefono,
                direccion: persona.direccion,
                barrio: persona.barrio,
                localidad: persona.localidad
              },
              datos_adicionales: {
                "Edad": persona.edad_aprox || "No registrada",
                "Email": persona.email || "No registrado"
              }
            }
          ]
        };
      });
    }

    const progsActivos = (persona.programas_activos || "")
      .split("|")
      .map((p: string) => p.trim())
      .filter(Boolean);

    return NextResponse.json({
      encontrado: true,
      dni: persona.dni,
      nombre_detectado: persona.nombre_completo,
      total_programas: persona.cantidad_programas || progsActivos.length,
      programas_activos: progsActivos,
      detalle_programas: detalleProgramas,
      relaciones_familiares: relaciones,
      fuente_origen: "NEON_POSTGRESQL_3F"
    });
  } catch (error: any) {
    return NextResponse.json({ encontrado: false, error: error.message }, { status: 500 });
  }
}

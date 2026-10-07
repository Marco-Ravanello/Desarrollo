import * as XLSX from "xlsx";
import { StormVictimItem, EmergencyOperatorInfo } from "@/types/emergency";

export function exportStormSheetToExcel(
  records: StormVictimItem[],
  operator: EmergencyOperatorInfo,
  filename: string = "Relevamiento_Territorial_Tormenta_3F.xlsx"
) {
  const wb = XLSX.utils.book_new();

  const data: any[][] = [];

  data.push(["MUNICIPALIDAD DE TRES DE FEBRERO - RELEVAMIENTO TERRITORIAL Y FICHA DE TORMENTA"]);
  data.push([`RESPONSABLE: ${operator.name.toUpperCase()}`]);
  data.push([`ÁREA: ${operator.areaName.toUpperCase()}`]);
  data.push([`FECHA DE EMISIÓN: ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`]);
  data.push([]);

  data.push([
    "#",
    "Nombre y Apellido",
    "DNI",
    "Grupo Fam.",
    "Niños",
    "Domicilio / Referencia",
    "Colchón", "",
    "Cama", "",
    "Cucheta", "",
    "Frazada", "",
    "Observaciones / Contacto",
    "Prioridad",
    "Agentes / Intervención"
  ]);

  data.push([
    "", "", "", "", "", "",
    "Requiere", "Cant.",
    "Requiere", "Cant.",
    "Requiere", "Cant.",
    "Requiere", "Cant.",
    "", "", ""
  ]);

  records.forEach((r, idx) => {
    const domRef = [r.domicilio, r.referencia ? `(Ref: ${r.referencia})` : "", r.barrio ? `[${r.barrio}]` : ""]
      .filter(Boolean)
      .join(" ");

    const obsContact = [r.observaciones, r.contacto ? `Tel: ${r.contacto}` : ""]
      .filter(Boolean)
      .join(" - ");

    data.push([
      idx + 1,
      r.nombreApellido || "",
      r.dni || "-",
      r.grupoFamiliar ? "Sí" : "No",
      r.ninos || "0",
      domRef,
      r.requiereColchon ? "Sí" : "No",
      r.cantidadColchon || 0,
      r.requiereCama ? "Sí" : "No",
      r.cantidadCama || 0,
      r.requiereCucheta ? "Sí" : "No",
      r.cantidadCucheta || 0,
      r.requiereFrazada ? "Sí" : "No",
      r.cantidadFrazada || 0,
      obsContact,
      r.prioridad || "MEDIA",
      r.descripcionIntervencion || r.agentes || ""
    ]);
  });

  data.push([]);

  const totalColchones = records.reduce((a, b) => a + (b.cantidadColchon || 0), 0);
  const totalCamas = records.reduce((a, b) => a + (b.cantidadCama || 0), 0);
  const totalCuchetas = records.reduce((a, b) => a + (b.cantidadCucheta || 0), 0);
  const totalFrazadas = records.reduce((a, b) => a + (b.cantidadFrazada || 0), 0);

  data.push([
    "TOTALES", "", "", "", "", "",
    "", totalColchones,
    "", totalCamas,
    "", totalCuchetas,
    "", totalFrazadas,
    "", "", ""
  ]);

  data.push([]);
  data.push(["--- FICHAS DE TORMENTA DETALLADAS ---"]);
  records.forEach((r, idx) => {
    data.push([`FICHA N° ${idx + 1} - ${r.nombreApellido} (DNI: ${r.dni || "N/A"})`]);
    data.push([`Barrio: ${r.barrio || "-"} | Domicilio: ${r.domicilio} ${r.referencia ? `(Ref: ${r.referencia})` : ""}`]);
    data.push([`Edad: ${r.edad || "-"} | Contacto: ${r.contacto || "-"} | Grupo Fam: ${r.grupoFamiliar ? "Sí" : "No"} | Niños: ${r.ninos || "0"}`]);
    data.push([`Prioridad: ${r.prioridad} | Agentes: ${r.agentes || operator.name}`]);
    data.push([`Elementos: Colchones: ${r.cantidadColchon}, Camas: ${r.cantidadCama}, Cuchetas: ${r.cantidadCucheta}, Frazadas: ${r.cantidadFrazada}`]);
    data.push([`Descripción de Intervención: ${r.descripcionIntervencion || "Sin detalle"}`]);
    data.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 16 } },
    { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } },
    { s: { r: 5, c: 8 }, e: { r: 5, c: 9 } },
    { s: { r: 5, c: 10 }, e: { r: 5, c: 11 } },
    { s: { r: 5, c: 12 }, e: { r: 5, c: 13 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Planilla Contingencia");
  XLSX.writeFile(wb, filename);
}

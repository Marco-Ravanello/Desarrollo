"use client";

import { useMemo } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { Download, FileCheck2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { textoNormal } from "@/lib/formato";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmergencyStockItem, StormDeliveryListItem, StormVictimItem } from "@/types/emergency";
import { stormBarrioLabel } from "@/lib/storm-barrios";
import {
  EMERGENCY_CATEGORIES,
  deliveredByCategory,
  deliveryStatus,
  extraQuantityText,
  pendingByCategory,
  pendingExtras,
  quantityText,
  requestedByCategory,
  requestedExtras,
} from "@/lib/emergency-categories";

interface StormSummaryTabProps {
  records: StormVictimItem[];
  stock: EmergencyStockItem[];
  onDeliver?: (record: StormVictimItem) => void;
  /** Últimas entregas, con su constancia para imprimir. */
  deliveries?: StormDeliveryListItem[];
}

const PRIORITY_ORDER: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const children = (r: StormVictimItem) => parseInt(r.ninos || "0") || 0;

function missingText(r: StormVictimItem, extraNames: Map<string, string>) {
  const pending = pendingByCategory(r);
  return [
    ...EMERGENCY_CATEGORIES.filter((c) => pending[c.key] > 0).map((c) => quantityText(c.key, pending[c.key])),
    ...Object.entries(pendingExtras(r)).map(([id, n]) => extraQuantityText(id, n, extraNames)),
  ].join(", ");
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Barras por barrio: familias que esperan entrega y familias con todo entregado. */
function BarrioChart({ rows }: { rows: { barrio: string; esperan: number; completas: number; falta: number }[] }) {
  const visible = rows.filter((r) => r.esperan + r.completas > 0);
  const max = Math.max(1, ...visible.map((r) => r.esperan + r.completas));
  if (visible.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-muted-foreground">Falta entregar por barrio</h4>
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Esperan entrega</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Entregadas completas</span>
        </div>
      </div>
      <ul className="space-y-2" aria-label="Familias por barrio">
        {visible.map((r) => (
          <li key={r.barrio} className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] items-center gap-3 text-xs sm:grid-cols-[12rem_minmax(0,1fr)_9rem]">
            <span className="truncate font-semibold text-foreground" title={r.barrio}>{r.barrio}</span>
            <div className="flex h-4 gap-[2px]" role="img" aria-label={`${r.barrio}: ${r.esperan} esperan entrega, ${r.completas} entregadas completas`}>
              {r.esperan > 0 && (
                <div
                  className="h-full rounded-[4px] bg-amber-500"
                  style={{ width: `${(r.esperan / max) * 100}%` }}
                  title={`${r.esperan} ${r.esperan === 1 ? "familia espera" : "familias esperan"} entrega (${r.falta} elementos)`}
                />
              )}
              {r.completas > 0 && (
                <div
                  className="h-full rounded-[4px] bg-emerald-600"
                  style={{ width: `${(r.completas / max) * 100}%` }}
                  title={`${r.completas} ${r.completas === 1 ? "familia" : "familias"} con todo entregado`}
                />
              )}
            </div>
            <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">
              <b className="text-foreground">{r.esperan}</b> esperan · {r.completas} completas
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const pendingTotal = (r: StormVictimItem) => sum(Object.values(pendingByCategory(r))) + sum(Object.values(pendingExtras(r)));

/** Resumen de la emergencia para la conducción: qué se pidió, qué se entregó y qué falta. */
export function StormSummaryTab({ records, stock, onDeliver, deliveries = [] }: StormSummaryTabProps) {
  const extraNames = useMemo(() => new Map(stock.filter((s) => s.category === "ADICIONAL").map((s) => [s.id, s.name])), [stock]);

  const byItem = useMemo(() => {
    const fixed = EMERGENCY_CATEGORIES.map((c) => {
      const pedido = sum(records.map((r) => requestedByCategory(r)[c.key]));
      const entregado = sum(records.map((r) => deliveredByCategory(r)[c.key]));
      const falta = sum(records.map((r) => pendingByCategory(r)[c.key]));
      const deposito = stock.find((s) => s.category === c.key)?.availableStock ?? 0;
      return { key: c.key as string, title: c.title, pedido, entregado, falta, deposito };
    });
    // Otros insumos que se pidieron en alguna ficha.
    const extraIds = Array.from(new Set(records.flatMap((r) => Object.keys(requestedExtras(r)))));
    const extras = extraIds.map((id) => ({
      key: id,
      title: extraNames.get(id) || "Insumo eliminado",
      pedido: sum(records.map((r) => requestedExtras(r)[id] || 0)),
      entregado: sum(records.map((r) => r.entregadoOtros?.[id] || 0)),
      falta: sum(records.map((r) => pendingExtras(r)[id] || 0)),
      deposito: stock.find((s) => s.id === id)?.availableStock ?? 0,
    }));
    return [...fixed, ...extras];
  }, [records, stock, extraNames]);

  const byBarrio = useMemo(() => {
    const map = new Map<string, StormVictimItem[]>();
    for (const r of records) {
      const barrio = stormBarrioLabel(r.barrio);
      map.set(barrio, [...(map.get(barrio) || []), r]);
    }
    return Array.from(map.entries())
      .map(([barrio, rs]) => ({
        barrio,
        fichas: rs.length,
        alta: rs.filter((r) => r.prioridad === "ALTA").length,
        ninos: sum(rs.map(children)),
        falta: sum(rs.map(pendingTotal)),
        esperan: rs.filter((r) => ["PENDIENTE", "PARCIAL"].includes(deliveryStatus(r))).length,
        completas: rs.filter((r) => deliveryStatus(r) === "ENTREGADO").length,
      }))
      .sort((a, b) => b.falta - a.falta || b.fichas - a.fichas);
  }, [records]);

  const byPriority = useMemo(
    () =>
      (["ALTA", "MEDIA", "BAJA"] as const).map((p) => {
        const rs = records.filter((r) => r.prioridad === p);
        return {
          prioridad: p,
          fichas: rs.length,
          pendientes: rs.filter((r) => ["PENDIENTE", "PARCIAL"].includes(deliveryStatus(r))).length,
        };
      }),
    [records]
  );

  const pendingRecords = useMemo(
    () =>
      records
        .filter((r) => ["PENDIENTE", "PARCIAL"].includes(deliveryStatus(r)))
        .sort(
          (a, b) =>
            (PRIORITY_ORDER[a.prioridad] ?? 1) - (PRIORITY_ORDER[b.prioridad] ?? 1) ||
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        ),
    [records]
  );

  const handleExport = () => {
    if (records.length === 0) {
      toast.error("No hay fichas para resumir.");
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        byItem.map((i) => ({ Elemento: i.title, Pedido: i.pedido, Entregado: i.entregado, "Falta entregar": i.falta, "En depósito": i.deposito }))
      ),
      "Por elemento"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        byBarrio.map((b) => ({
          Barrio: b.barrio,
          Fichas: b.fichas,
          "Prioridad alta": b.alta,
          Niños: b.ninos,
          "Elementos sin entregar": b.falta,
          "Fichas entregadas completas": b.completas,
        }))
      ),
      "Por barrio"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byPriority.map((p) => ({ Prioridad: p.prioridad, Fichas: p.fichas, "Con entrega pendiente": p.pendientes }))),
      "Por prioridad"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        pendingRecords.map((r) => ({
          Prioridad: r.prioridad,
          "Nombre y apellido": r.nombreApellido,
          DNI: r.dni || "",
          Barrio: r.barrio || "",
          Domicilio: r.domicilio,
          Contacto: r.contacto || "",
          "Falta entregar": missingText(r, extraNames),
          "Cargada el": r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-AR") : "",
        }))
      ),
      "Falta entregar"
    );
    XLSX.writeFile(wb, `Resumen_Emergencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Resumen descargado en Excel");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Resumen de la emergencia</h3>
          <p className="text-xs text-muted-foreground">
            {records.length} fichas · {pendingRecords.length} con elementos sin entregar
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="rounded-xl text-xs font-bold h-10">
          <Download className="mr-2 h-4 w-4" /> Exportar resumen a Excel
        </Button>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground">Por elemento</h4>
        <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Elemento</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Entregado</TableHead>
                <TableHead className="text-right">Falta entregar</TableHead>
                <TableHead className="text-right">En depósito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byItem.map((i) => (
                <TableRow key={i.key}>
                  <TableCell className="font-semibold">{i.title}</TableCell>
                  <TableCell className="text-right">{i.pedido}</TableCell>
                  <TableCell className="text-right">{i.entregado}</TableCell>
                  <TableCell className="text-right font-bold">{i.falta}</TableCell>
                  <TableCell className="text-right">
                    {i.deposito}
                    {i.falta > i.deposito && (
                      <Badge variant="outline" className="ml-2 text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">
                        No alcanza: faltan {i.falta - i.deposito}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <BarrioChart rows={byBarrio} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">Por barrio</h4>
          <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Barrio</TableHead>
                  <TableHead className="text-right">Fichas</TableHead>
                  <TableHead className="text-right">Prioridad alta</TableHead>
                  <TableHead className="text-right">Niños</TableHead>
                  <TableHead className="text-right">Sin entregar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byBarrio.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Todavía no hay fichas.</TableCell>
                  </TableRow>
                )}
                {byBarrio.map((b) => (
                  <TableRow key={b.barrio}>
                    <TableCell className="font-semibold">{b.barrio}</TableCell>
                    <TableCell className="text-right">{b.fichas}</TableCell>
                    <TableCell className="text-right">{b.alta}</TableCell>
                    <TableCell className="text-right">{b.ninos}</TableCell>
                    <TableCell className="text-right font-bold">{b.falta}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">Por prioridad</h4>
          <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Fichas</TableHead>
                  <TableHead className="text-right">Con entrega pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPriority.map((p) => (
                  <TableRow key={p.prioridad}>
                    <TableCell className="font-semibold">{textoNormal(p.prioridad)}</TableCell>
                    <TableCell className="text-right">{p.fichas}</TableCell>
                    <TableCell className="text-right font-bold">{p.pendientes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground">Falta entregar (primero prioridad alta y las más antiguas)</h4>
        <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Barrio / domicilio</TableHead>
                <TableHead>Falta</TableHead>
                {onDeliver && <TableHead className="text-right">Entrega</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={onDeliver ? 5 : 4} className="text-center text-muted-foreground">
                    No hay entregas pendientes.
                  </TableCell>
                </TableRow>
              )}
              {pendingRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold ${r.prioridad === "ALTA" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30" : ""}`}
                    >
                      {textoNormal(r.prioridad)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold uppercase">{r.nombreApellido}</TableCell>
                  <TableCell className="text-xs">
                    {r.barrio && <span className="font-bold">{r.barrio} · </span>}
                    {r.domicilio}
                  </TableCell>
                  <TableCell className="text-xs">{missingText(r, extraNames)}</TableCell>
                  {onDeliver && (
                    <TableCell className="text-right">
                      {r.fromTable && (
                        <Button size="sm" variant="outline" onClick={() => onDeliver(r)} className="h-8 rounded-lg text-xs font-bold">
                          <PackageCheck className="mr-1 h-3.5 w-3.5" /> Entregar
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {deliveries.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">Entregas realizadas</h4>
          <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Barrio / domicilio</TableHead>
                  <TableHead>Se entregó</TableHead>
                  <TableHead>Entregó</TableHead>
                  <TableHead className="text-right">Constancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fechaHora(d.date)}</TableCell>
                    <TableCell className="font-semibold">
                      {d.nombre}
                      {d.dni && <span className="block text-xs font-normal normal-case text-muted-foreground">DNI {d.dni}</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.barrio && <span className="font-bold">{d.barrio} · </span>}
                      {d.domicilio}
                    </TableCell>
                    <TableCell className="text-xs">{d.summary}</TableCell>
                    <TableCell className="text-xs">{d.deliveredBy}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 rounded-lg text-xs font-bold">
                        <Link href={`/admin/emergency/constancia/${d.id}`} target="_blank">
                          <FileCheck2 className="mr-1 h-3.5 w-3.5" /> Constancia
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {deliveries.length >= 100 && (
            <p className="text-xs text-muted-foreground">Se muestran las últimas 100 entregas.</p>
          )}
        </section>
      )}
    </div>
  );
}

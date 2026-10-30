"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Copia el texto de cada encabezado (th) a sus celdas (data-label) para que,
 * en celulares, cada fila se muestre como una tarjeta con "Etiqueta: valor".
 */
function useMobileCardLabels(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const table = containerRef.current?.querySelector("table")
    if (!enabled || !table) return

    const label = () => {
      const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th")).map(
        (th) => th.textContent?.trim() ?? ""
      )
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
        let col = 0
        Array.from(tr.cells).forEach((td) => {
          const span = td.colSpan || 1
          const text = span > 1 ? "" : headers[col] ?? ""
          if (td.getAttribute("data-label") !== text) td.setAttribute("data-label", text)
          col += span
        })
      })
    }

    label()
    const observer = new MutationObserver(label)
    observer.observe(table, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [containerRef, enabled])
}

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** En celulares, mostrar cada fila como tarjeta (por defecto sí). */
  mobileCards?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, mobileCards = true, ...props }, ref) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  useMobileCardLabels(containerRef, mobileCards)

  return (
    <div ref={containerRef} className={cn("relative w-full overflow-auto", mobileCards && "table-cards")}>
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
})
Table.displayName = "Table"

/** Envoltorio para tablas escritas a mano con <table>: en celulares las muestra como tarjetas. */
function TableCards({ className, children }: { className?: string; children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  useMobileCardLabels(containerRef, true)
  return (
    <div ref={containerRef} className={cn("relative w-full overflow-auto table-cards", className)}>
      {children}
    </div>
  )
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-muted/40 [&_tr]:border-b [&_tr]:border-border/60 [&_tr:hover]:bg-transparent", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

// Filas aireadas, la fila se resalta al pasar el mouse y los números van a la derecha (numeric).
// Las tablas escritas a mano usan las mismas clases (TABLE_HEAD_CLASS, TABLE_CELL_CLASS, TABLE_ROW_CLASS).
export const TABLE_ROW_CLASS = "border-b border-border/50 transition-colors hover:bg-muted/60 data-[state=selected]:bg-muted"
export const TABLE_HEAD_CLASS = "h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap"
export const TABLE_CELL_CLASS = "px-4 py-3 align-middle"
export const NUMERIC_CLASS = "text-right tabular-nums"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn(TABLE_ROW_CLASS, className)} {...props} />
))
TableRow.displayName = "TableRow"

interface CellProps {
  /** Columna de números o montos: alineada a la derecha y con cifras del mismo ancho. */
  numeric?: boolean
}

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement> & CellProps>(({ className, numeric, ...props }, ref) => (
  <th ref={ref} className={cn(TABLE_HEAD_CLASS, "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", numeric && "text-right", className)} {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement> & CellProps>(({ className, numeric, ...props }, ref) => (
  <td ref={ref} className={cn(TABLE_CELL_CLASS, "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", numeric && NUMERIC_CLASS, className)} {...props} />
))
TableCell.displayName = "TableCell"

export { Table, TableCards, TableHeader, TableBody, TableHead, TableRow, TableCell }

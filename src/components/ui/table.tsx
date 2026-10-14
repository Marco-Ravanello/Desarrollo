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
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border/60", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("h-10 px-2 text-left align-middle text-xs font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
))
TableCell.displayName = "TableCell"

export { Table, TableCards, TableHeader, TableBody, TableHead, TableRow, TableCell }

export type EmergencyPriority = "ALTA" | "MEDIA" | "BAJA";

export interface StormVictimItem {
  id: string;
  itemNumber: number;
  personId?: string | null;
  nombreApellido: string;
  dni?: string | null;
  edad?: string | null;
  grupoFamiliar: boolean;
  ninos?: string | null;
  domicilio: string;
  referencia?: string | null;
  barrio?: string | null;
  requiereColchon: boolean;
  cantidadColchon: number;
  requiereCama: boolean;
  cantidadCama: number;
  requiereCucheta: boolean;
  cantidadCucheta: number;
  requiereFrazada: boolean;
  cantidadFrazada: number;
  observaciones?: string | null;
  contacto?: string | null;
  agentes?: string | null;
  prioridad: EmergencyPriority;
  descripcionIntervencion?: string | null;
  estado?: string;
  caseId?: string | null;
  /** Usuario que cargó la ficha. */
  createdById?: string | null;
  /** Identificador generado en el dispositivo (evita duplicados al reenviar fichas sin conexión). */
  clientId?: string | null;
  /** Otros insumos pedidos (agregados desde Stock de Contingencia): { idInsumo: cantidad }. */
  otrosElementos?: Record<string, number> | null;
  /** Lo entregado hasta ahora (suma de las entregas registradas). */
  entregadoColchon?: number;
  entregadoCama?: number;
  entregadoCucheta?: number;
  entregadoFrazada?: number;
  entregadoOtros?: Record<string, number>;
  ultimaEntrega?: Date | string | null;
  /** Ficha guardada en la tabla de fichas (las de respaldo viejas no admiten entregas). */
  fromTable?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface EmergencyStockItem {
  id: string;
  name: string;
  description?: string | null;
  category: "COLCHON" | "CAMA" | "CUCHETA" | "FRAZADA" | "ADICIONAL" | "GENERAL";
  availableStock: number;
  minStock: number;
  demandedQuantity: number;
  unit: string;
  status: "CRITICO" | "CORRECTO" | "EXCESO";
  areaName?: string;
}

export interface EmergencyExtraItem {
  id: string;
  name: string;
  unit: string;
}

/** Una entrega registrada, para la lista de entregas con su constancia. */
export interface StormDeliveryListItem {
  id: string;
  /** Número que figura en la constancia impresa. */
  number: string;
  date: string;
  nombre: string;
  dni: string | null;
  barrio: string | null;
  domicilio: string;
  summary: string;
  deliveredBy: string;
}

export interface EmergencyOperatorInfo {
  userId: string;
  name: string;
  email: string;
  areaId: string;
  areaName: string;
}

export interface EmergencyOperationsData {
  operator: EmergencyOperatorInfo;
  viewer: {
    /** Relevador de emergencia: ve solo las fichas que cargó. */
    onlyOwnRecords: boolean;
    canViewStock: boolean;
    canEdit: boolean;
    /** Puede registrar entregas (descuentan stock). */
    canDeliver: boolean;
  };
  stock: EmergencyStockItem[];
  /** Insumos agregados que se pueden pedir en las fichas (sin stock: lo ve también el relevador). */
  extraItems: EmergencyExtraItem[];
  records: StormVictimItem[];
  /** Últimas entregas registradas (no las ve el relevador). */
  deliveries: StormDeliveryListItem[];
  metrics: {
    totalVictims: number;
    totalChildren: number;
    totalColchones: number;
    totalCamas: number;
    totalCuchetas: number;
    totalFrazadas: number;
    highPriorityCount: number;
  };
}

export interface SearchPersonSuggestion {
  personId?: string;
  nombreApellido: string;
  dni: string;
  domicilio?: string;
  barrio?: string;
  edad?: string;
  contacto?: string;
  grupoFamiliar: boolean;
  ninos?: string;
  source: "person" | "padron";
}

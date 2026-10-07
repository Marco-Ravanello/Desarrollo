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
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface EmergencyStockItem {
  id: string;
  name: string;
  description?: string | null;
  category: "COLCHON" | "CAMA" | "CUCHETA" | "FRAZADA" | "GENERAL";
  availableStock: number;
  minStock: number;
  demandedQuantity: number;
  unit: string;
  status: "CRITICO" | "CORRECTO" | "EXCESO";
  areaName?: string;
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
  stock: EmergencyStockItem[];
  records: StormVictimItem[];
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

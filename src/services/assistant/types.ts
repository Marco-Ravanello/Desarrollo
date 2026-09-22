export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  answer: string;
  intent: string;
  dataSummary?: any;
}

export interface SemanticFilters {
  isSeniors?: boolean;
  isChildren?: boolean;
  isWorkers?: boolean;
  isBrokenVehicles?: boolean;
  isBigOrders?: boolean;
}

export interface UniversalSearchResult {
  contextText: string;
  sources: { type: string; name: string; url?: string }[];
  actions: { label: string; actionType: string; payload?: any }[];
  dataSummary: any;
}

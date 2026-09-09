export interface LocalityInfo {
  id: string;
  name: string;
  coordinates: [number, number];
  zoom: number;
}

export const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.6030, -58.5580];
export const TRES_DE_FEBRERO_DEFAULT_ZOOM = 13;

export const MUNICIPAL_LOCALITIES: LocalityInfo[] = [
  {
    id: "all",
    name: "Todo el Partido (Tres de Febrero)",
    coordinates: TRES_DE_FEBRERO_CENTER,
    zoom: 13
  },
  {
    id: "caseros",
    name: "Caseros (Sede Central)",
    coordinates: [-34.6080, -58.5630],
    zoom: 15
  },
  {
    id: "ciudad_jardin",
    name: "Ciudad Jardín Lomas del Palomar",
    coordinates: [-34.5980, -58.5830],
    zoom: 15
  },
  {
    id: "el_palomar",
    name: "El Palomar",
    coordinates: [-34.6130, -58.5880],
    zoom: 15
  },
  {
    id: "villa_bosch",
    name: "Villa Bosch",
    coordinates: [-34.5880, -58.5680],
    zoom: 15
  },
  {
    id: "santos_lugares",
    name: "Santos Lugares",
    coordinates: [-34.6000, -58.5480],
    zoom: 15
  },
  {
    id: "saenz_pena",
    name: "Sáenz Peña",
    coordinates: [-34.6080, -58.5380],
    zoom: 15
  },
  {
    id: "loma_hermosa",
    name: "Loma Hermosa",
    coordinates: [-34.5680, -58.5980],
    zoom: 15
  },
  {
    id: "martin_coronado",
    name: "Martín Coronado",
    coordinates: [-34.5830, -58.5830],
    zoom: 15
  },
  {
    id: "pablo_podesta",
    name: "Pablo Podestá",
    coordinates: [-34.5780, -58.6080],
    zoom: 15
  },
  {
    id: "churruca",
    name: "Churruca",
    coordinates: [-34.5700, -58.6180],
    zoom: 15
  },
  {
    id: "remedios_de_escalada",
    name: "Remedios de Escalada",
    coordinates: [-34.5630, -58.6100],
    zoom: 15
  },
  {
    id: "11_de_septiembre",
    name: "11 de Septiembre",
    coordinates: [-34.5600, -58.6250],
    zoom: 15
  },
  {
    id: "jose_ingenieros",
    name: "José Ingenieros",
    coordinates: [-34.6200, -58.5320],
    zoom: 15
  },
  {
    id: "villa_raffo",
    name: "Villa Raffo",
    coordinates: [-34.6180, -58.5250],
    zoom: 15
  }
];

/**
 * Mapa de heladeras y botelleros de YUKU (del «Mapa de heladeras» del
 * 17/11/2026). Cada estante es una fila; cada carril, una referencia (o una
 * familia de sakes) con sus botellas una detrás de otra.
 *
 * `ficha` es un pedazo del nombre en la Guía (sin tildes, en minúscula) para
 * enlazar la botella con su ficha. Si no hay ficha, se omite.
 */

import { normalizarBusqueda } from "@/src/lib/guia-bebidas";

export type TipoBotella = "champ" | "blanco" | "tinto" | "sake" | "otro";

export type ItemCarril = {
  nombre: string;
  /** Cuántas van en frío en ese carril. Sin número: el sake no tiene stock cargado. */
  n?: number;
  ficha?: string;
};

export type Carril = {
  /** Lo que se lee en el dibujo. */
  corto: string;
  tipo: TipoBotella;
  items: ItemCarril[];
};

export type Estante = {
  codigo: string;
  familia: string;
  /** Solo en el botellero: arriba / medio / abajo. */
  nivel?: "arriba" | "medio" | "abajo";
  /** De pie (sake) o acostadas (vino, lo normal). */
  dePie?: boolean;
  /** Huecos por estante. */
  capacidad: number;
  carriles: Carril[];
  /** Estante sin botellas dibujadas: se describe con texto. */
  texto?: string;
  detalle?: ItemCarril[];
};

export type Zona = { titulo: string; temp: number; estantes: Estante[] };

export type Heladera = {
  letra: string;
  nombre: string;
  lugar: "Almacén" | "Barra";
  nota?: string;
  zonas: Zona[];
};

const uno = (
  corto: string,
  tipo: TipoBotella,
  nombre: string,
  n: number,
  ficha?: string,
): Carril => ({ corto, tipo, items: [{ nombre, n, ficha }] });

export const HELADERAS: Heladera[] = [
  {
    letra: "A",
    nombre: "Cavin de doble zona",
    lugar: "Almacén",
    zonas: [
      {
        titulo: "Zona alta · Blancos de Borgoña",
        temp: 11,
        estantes: [
          {
            codigo: "A1",
            familia: "Chablis y Aligoté",
            capacidad: 7,
            carriles: [
              uno("Aligoté", "blanco", "Maison Réno Aligoté", 3, "aligote"),
              uno("Mont de Milieu", "blanco", "Malandes Mont de Milieu", 2, "mont de milieu"),
              uno("Les Clos", "blanco", "Malandes Les Clos", 2, "les clos"),
            ],
          },
          {
            codigo: "A2",
            familia: "Côte de Beaune",
            capacidad: 7,
            carriles: [
              uno("Bigotes", "blanco", "Cossard Bigotes", 3, "bigotes"),
              uno("Carillon", "blanco", "Carillon Puligny-Montrachet", 1, "carillon"),
              uno("Boyer de Bar", "blanco", "Boyer de Bar Meursault", 3, "boyer de bar"),
            ],
          },
          {
            codigo: "A3",
            familia: "Côte de Beaune, grandes",
            capacidad: 7,
            carriles: [
              uno("Drouhin Meursault", "blanco", "Drouhin Hospices Meursault", 3, "hospices de beaune"),
              uno("Folatières", "blanco", "Cossard Les Folatières", 2, "folatieres"),
              uno("Corton-Ch.", "blanco", "Chapuis Corton-Charlemagne", 2, "charlemagne"),
            ],
          },
        ],
      },
      {
        titulo: "Zona baja · Resto de blancos",
        temp: 10,
        estantes: [
          {
            codigo: "A4",
            familia: "España y Mâconnais",
            capacidad: 7,
            carriles: [
              uno("Selma", "blanco", "Selma de Nin", 4, "selma"),
              uno("Qué Bonito", "blanco", "Qué Bonito Cacareaba", 1),
              uno("Rijckaert", "blanco", "Rijckaert Pouilly-Fuissé", 2, "rijckaert"),
            ],
          },
          {
            codigo: "A5",
            familia: "Riesling y Azores",
            capacidad: 9,
            carriles: [
              uno("FIO", "blanco", "FIO Falkenberg Riesling", 2, "falkenberg"),
              uno("Kreydenweiss", "blanco", "Kreydenweiss Wiebelsberg", 2, "kreydenweiss"),
              uno("Schaefer", "blanco", "Schaefer Domprobst Auction", 3, "schaefer"),
              uno("Pico", "blanco", "Pico Arinto dos Açores", 2, "arinto"),
            ],
          },
          {
            codigo: "A6",
            familia: "Alsacia y Jura",
            capacidad: 7,
            carriles: [
              uno("Deiss", "blanco", "Deiss Schlossberg", 3, "deiss"),
              uno("Les Terrasses", "blanco", "Renardière Les Terrasses", 4, "les terrasses"),
            ],
          },
          {
            codigo: "A7",
            familia: "Loira, Godello y Jerez",
            capacidad: 7,
            carriles: [
              uno("Nozay", "blanco", "Clos de Nozay", 3, "nozay"),
              uno("Cantariña", "blanco", "Cantariña, El Godello de Consuelo", 2, "godello"),
              uno("Fino", "blanco", "Viña Corrales Fino", 2, "corrales"),
            ],
          },
          {
            codigo: "A8",
            familia: "España, grandes",
            capacidad: 7,
            carriles: [
              uno("El Sauco", "blanco", "El Sauco", 2, "sauco"),
              uno("Pomares", "blanco", "Pomares Parcela en Aios", 4, "aios"),
            ],
          },
        ],
      },
    ],
  },
  {
    letra: "B",
    nombre: "Vinoteca mediana",
    lugar: "Almacén",
    zonas: [
      {
        titulo: "Tintos",
        temp: 15,
        estantes: [
          {
            codigo: "B1",
            familia: "Ligeros de España",
            capacidad: 5,
            carriles: [
              uno("12 Volts", "tinto", "12 Volts", 3, "12 volts"),
              uno("Lalama", "tinto", "Lalama", 1, "lalama"),
              uno("Lo Noir", "tinto", "Lo Noir", 1, "lo noir"),
            ],
          },
          {
            codigo: "B2",
            familia: "Ligeros",
            capacidad: 5,
            carriles: [
              uno("La Robina", "tinto", "La Robina", 1, "robina"),
              uno("Bruma", "tinto", "Bruma de Arenero", 1, "bruma"),
              uno("Saint-Cyr", "tinto", "Saint-Cyr Moulin-à-Vent", 2, "saint-cyr"),
              uno("Trousseau", "tinto", "Renardière Trousseau", 1, "trousseau"),
            ],
          },
          {
            codigo: "B3",
            familia: "Pinot: Jura y Borgoña",
            capacidad: 5,
            carriles: [
              uno("Renardière Pinot", "tinto", "Renardière Pinot Noir", 1, "renardiere, pinot"),
              uno("Cossard Gevrey", "tinto", "Cossard Gevrey Genevrières", 2, "genevrieres"),
              uno("Corton", "tinto", "Chapuis Corton", 2, "corton grand cru"),
            ],
          },
          {
            codigo: "B4",
            familia: "Borgoña",
            capacidad: 5,
            carriles: [
              uno("Duband", "tinto", "Duband Gevrey-Chambertin", 1, "duband"),
              uno("Cossard Morey", "tinto", "Cossard Morey Monts Luisants", 2, "monts luisants"),
              uno("Vosne", "tinto", "Drouhin Vosne-Romanée 1er", 2, "vosne"),
            ],
          },
          {
            codigo: "B5",
            familia: "Piamonte y Douro",
            capacidad: 5,
            carriles: [
              uno("Valmaggiore", "tinto", "Sandrone Valmaggiore", 1, "valmaggiore"),
              uno("Barolo", "tinto", "Sandrone Barolo Le Vigne", 2, "barolo"),
              uno("Charme", "tinto", "Niepoort Charme", 2, "charme"),
            ],
          },
          {
            codigo: "B6",
            familia: "Rioja y Ribera",
            capacidad: 5,
            carriles: [
              uno("904", "tinto", "Rioja Alta 904", 1, "904"),
              uno("890", "tinto", "Rioja Alta 890", 2, "890"),
              uno("Contador", "tinto", "Contador", 1, "contador"),
              uno("Peñas Aladas", "tinto", "Peñas Aladas", 1, "penas aladas"),
            ],
          },
        ],
      },
    ],
  },
  {
    letra: "C",
    nombre: "Vinoteca mini",
    lugar: "Almacén",
    zonas: [
      {
        titulo: "Refuerzos por copa",
        temp: 10,
        estantes: [
          {
            codigo: "C1",
            familia: "Copa de blanco",
            capacidad: 3,
            carriles: [uno("Ekam", "blanco", "Ekam", 3, "ekam")],
          },
          {
            codigo: "C2",
            familia: "Copa de blanco",
            capacidad: 3,
            carriles: [
              uno("Petit Chablis", "blanco", "Billaud-Simon Petit Chablis", 3, "petit chablis"),
            ],
          },
          {
            codigo: "C3",
            familia: "Copa de tinto",
            capacidad: 3,
            carriles: [
              uno("Chapuis", "tinto", "Chapuis Côte d'Or Rouge", 3, "cote d'or rouge"),
            ],
          },
        ],
      },
    ],
  },
  {
    letra: "E",
    nombre: "Vinoteca de doble zona",
    lugar: "Barra",
    zonas: [
      {
        titulo: "Zona alta · Champagne joven",
        temp: 8,
        estantes: [
          {
            codigo: "E1",
            familia: "Entrada y rosé",
            capacidad: 5,
            carriles: [
              uno("Gonet", "champ", "Gonet-Médeville Blanc de Noirs", 1, "blanc de noirs"),
              uno("Heidsieck", "champ", "Charles Heidsieck Brut Réserve", 1, "heidsieck"),
              uno("Coulon", "champ", "Roger Coulon Heri Hodie", 1, "coulon"),
              uno("Marcoult", "champ", "Marcoult B. de Barbonne", 1, "marcoult"),
              uno("Shaman Rosé", "champ", "Marguet Shaman Rosé", 1, "shaman"),
            ],
          },
          {
            codigo: "E2",
            familia: "Chardonnay, Pinot y Meunier",
            capacidad: 5,
            carriles: [
              uno("Dosage Zéro", "champ", "Lenoble Dosage Zéro", 1, "dosage zero"),
              uno("Longitude", "champ", "Larmandier-Bernier Longitude", 1, "longitude"),
              uno("Doyard", "champ", "Doyard Révolution", 1, "doyard"),
              uno("Jacquesson", "champ", "Jacquesson 749", 1, "jacquesson"),
              uno("Wirth", "champ", "Wirth Michel Meuniers de Raoul", 1, "meuniers de raoul"),
            ],
          },
        ],
      },
      {
        titulo: "Zona baja · Champagne de crianza larga y grandes",
        temp: 11,
        estantes: [
          {
            codigo: "E3",
            familia: "Solera y Pinot",
            capacidad: 6,
            carriles: [
              uno("Mémoire", "champ", "Huré Mémoire", 3, "memoire"),
              uno("Egly", "champ", "Egly-Ouriet Grand Cru", 3, "egly"),
            ],
          },
          {
            codigo: "E4",
            familia: "Sin dosage",
            capacidad: 6,
            carriles: [
              uno("Vouette", "champ", "Vouette & Sorbée Blanc d'Argile", 3, "argile"),
              uno("Sapience", "champ", "Marguet Sapience", 3, "sapience"),
            ],
          },
          {
            codigo: "E5",
            familia: "Grandes",
            capacidad: 6,
            carriles: [
              uno("Krug", "champ", "Krug Grande Cuvée", 2, "krug"),
              uno("Les Aventures", "champ", "Lenoble Les Aventures", 2, "les aventures"),
              uno("Gimonnet", "champ", "Gimonnet Special Club", 2, "gimonnet"),
            ],
          },
        ],
      },
    ],
  },
  {
    letra: "D",
    nombre: "Botellero Saro",
    lugar: "Barra",
    nota: "D1 y D2 son las dos puertas. El sake va de pie y por familia, sin cantidades. Hanatomoe, Biden y Akishika se sirven templados: salen del frío unos minutos antes.",
    zonas: [
      {
        titulo: "D1 · puerta",
        temp: 5,
        estantes: [
          {
            codigo: "D1",
            nivel: "arriba",
            dePie: true,
            familia: "Sake All Round, Fruity y Funky",
            capacidad: 6,
            carriles: [
              {
                corto: "All Round",
                tipo: "sake",
                items: [
                  { nombre: "Kido Junmai Ginjo", ficha: "kido junmai ginjo" },
                  { nombre: "Niida Shizenshu", ficha: "niida" },
                ],
              },
              { corto: "Fruity", tipo: "sake", items: [{ nombre: "Kizan" }] },
              {
                corto: "Funky",
                tipo: "sake",
                items: [
                  { nombre: "AFS", ficha: "afs" },
                  { nombre: "Natsu no Omoide", ficha: "natsu no omoide" },
                  { nombre: "Ine Mankai", ficha: "ine mankai" },
                ],
              },
            ],
          },
          {
            codigo: "D1",
            nivel: "medio",
            familia: "Corpinnat y rosé",
            capacidad: 5,
            carriles: [
              uno("Recaredo", "champ", "Recaredo Serral del Vell", 1, "recaredo"),
              uno("Llopart", "champ", "Llopart Ex Vite", 1, "llopart"),
              uno("Bufadors", "champ", "Bufadors Vinya del Rascarà", 1, "bufadors"),
              uno("Shaman Rosé", "champ", "Marguet Shaman Rosé", 2, "shaman"),
            ],
          },
          {
            codigo: "D1",
            nivel: "abajo",
            familia: "Sake cerrado de respaldo",
            capacidad: 0,
            carriles: [],
            texto: "Una botella cerrada de cada sake que rota",
          },
        ],
      },
      {
        titulo: "D2 · puerta",
        temp: 5,
        estantes: [
          {
            codigo: "D2",
            nivel: "arriba",
            dePie: true,
            familia: "Sake Clean & Elegant, Rustic y Añejo, y la copa de blanco",
            capacidad: 9,
            carriles: [
              {
                corto: "Clean & Elegant",
                tipo: "sake",
                items: [
                  { nombre: "Kido Daiginjo 50", ficha: "kido daiginjo 50" },
                  { nombre: "Nabeshima 50", ficha: "nabeshima 50" },
                  { nombre: "Senkin Modern", ficha: "senkin modern" },
                  { nombre: "Nabeshima Junmai Daiginjo +" },
                ],
              },
              {
                corto: "Rustic",
                tipo: "sake",
                items: [{ nombre: "Hanatomoe", ficha: "hanatomoe" }],
              },
              {
                corto: "Añejo",
                tipo: "sake",
                items: [
                  { nombre: "Biden 1999", ficha: "biden" },
                  { nombre: "Akishika 2003", ficha: "akishika" },
                ],
              },
              uno("Ekam", "blanco", "Ekam", 2, "ekam"),
            ],
          },
          {
            codigo: "D2",
            nivel: "medio",
            familia: "Respaldo de los champagnes que más salen",
            capacidad: 5,
            carriles: [
              uno("Gonet", "champ", "Gonet-Médeville Blanc de Noirs", 2, "blanc de noirs"),
              uno("Longitude", "champ", "Larmandier-Bernier Longitude", 2, "longitude"),
              uno("Coulon", "champ", "Roger Coulon Heri Hodie", 1, "coulon"),
            ],
          },
          {
            codigo: "D2",
            nivel: "abajo",
            familia: "Cerveza, aperitivo y sin alcohol",
            capacidad: 0,
            carriles: [],
            texto: "Cerveza, aperitivo y sin alcohol",
            detalle: [
              { nombre: "Cerveza OSO Citrus", ficha: "oso brewery" },
              { nombre: "Cerveza 0,0" },
              { nombre: "Yuzu Spritz", ficha: "yuzu spritz" },
              { nombre: "Umeshu Heiwa", ficha: "umeshu clasico" },
              { nombre: "Umeshu Amaretto", ficha: "amaretto" },
              { nombre: "Iyoshi Cola", ficha: "iyoshi" },
              { nombre: "Vichy Catalan", ficha: "vichy" },
              { nombre: "Solán de Cabras", ficha: "solan" },
            ],
          },
        ],
      },
    ],
  },
];

/** Categoría de la Guía que corresponde a cada color de cinta. */
export const CATEGORIAS_DE_TIPO: Record<TipoBotella, string[]> = {
  champ: ["espumoso"],
  blanco: ["blanco"],
  tinto: ["tinto"],
  sake: ["sake"],
  otro: ["aperitivo", "sin-alcohol"],
};

export const LABEL_TIPO: Record<TipoBotella, string> = {
  champ: "Espumosos",
  blanco: "Blancos",
  tinto: "Tintos",
  sake: "Sake",
  otro: "Otros",
};

export type Ubicacion = {
  letra: string;
  lugar: Heladera["lugar"];
  codigo: string;
  nivel?: Estante["nivel"];
  temp: number;
  n?: number;
  /** Para marcarla en el dibujo. */
  zona: number;
  estante: number;
  carril?: number;
};

/** Dónde está cada cosa, por nombre (para el buscador y para la ficha). */
export type Referencia = {
  nombre: string;
  tipo: TipoBotella;
  ficha?: string;
  ubicaciones: Ubicacion[];
};

export function indiceReferencias(): Referencia[] {
  const porNombre = new Map<string, Referencia>();
  HELADERAS.forEach((h) =>
    h.zonas.forEach((z, zi) =>
      z.estantes.forEach((e, ei) => {
        const agregar = (
          item: ItemCarril,
          tipo: TipoBotella,
          carril?: number,
        ) => {
          const ref = porNombre.get(item.nombre) ?? {
            nombre: item.nombre,
            tipo,
            ficha: item.ficha,
            ubicaciones: [],
          };
          ref.ubicaciones.push({
            letra: h.letra,
            lugar: h.lugar,
            codigo: e.codigo,
            nivel: e.nivel,
            temp: z.temp,
            n: item.n,
            zona: zi,
            estante: ei,
            carril,
          });
          porNombre.set(item.nombre, ref);
        };
        e.carriles.forEach((c, ci) =>
          c.items.forEach((i) => agregar(i, c.tipo, ci)),
        );
        e.detalle?.forEach((i) => agregar(i, "otro"));
      }),
    ),
  );
  return [...porNombre.values()];
}

/** ¿Este pedazo de nombre (`ficha`) corresponde a esta bebida de la Guía? */
export function esFichaDe(
  ficha: string | undefined,
  tipo: TipoBotella,
  bebida: { nombre: string; categoria: string },
): boolean {
  return Boolean(
    ficha &&
      CATEGORIAS_DE_TIPO[tipo].includes(bebida.categoria) &&
      normalizarBusqueda(bebida.nombre).includes(ficha),
  );
}

/** Dónde está una bebida de la Guía (vacío si no está en frío). */
export function ubicacionesDeBebida(bebida: {
  nombre: string;
  categoria: string;
}): Ubicacion[] {
  return indiceReferencias()
    .filter((r) => esFichaDe(r.ficha, r.tipo, bebida))
    .flatMap((r) => r.ubicaciones);
}

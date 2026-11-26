/**
 * Contenido de la sección "Elaboración" de la guía de bebidas: cómo se hace cada
 * bebida paso a paso y qué paso cambia con cada palabra de la etiqueta.
 * Los términos y ejemplos "en carta" salen de la guía; el detalle de cada paso es
 * elaboración estándar de cada bebida.
 */

export type Paso = { titulo: string; texto: string };

export type Efecto =
  | { paso: string; tipo: "cambia"; texto: string }
  | { paso: string; tipo: "salta"; texto: string }
  /** Agrega un paso extra justo después de `paso`. */
  | { paso: string; tipo: "nuevo"; titulo: string; texto: string };

export type Termino = {
  id: string;
  label: string;
  grupo: string;
  /** Qué significa, en una frase. */
  resumen: string;
  /** Cómo se nota en la copa. */
  enCopa?: string;
  /** Ejemplos de la carta. */
  enCarta?: string;
  efectos: Efecto[];
};

export type Ruta = { id: string; label: string; resumen: string; pasos: string[] };

export type Proceso = {
  id: "sake" | "vino" | "whisky";
  label: string;
  intro: string;
  pasos: Record<string, Paso>;
  rutas: Ruta[];
  terminos: Termino[];
};

const SAKE: Proceso = {
  id: "sake",
  label: "Sake",
  intro:
    "El sake es un fermentado de arroz. Casi todas las palabras de la etiqueta nombran un paso que se hizo distinto o que directamente no se hizo. Tocá un término para ver dónde cae.",
  pasos: {
    pulido: {
      titulo: "Pulido del arroz",
      texto:
        "Se lima el exterior del grano, donde están las proteínas y grasas. El seimaibuai dice cuánto grano queda: 60 % significa que se eliminó el 40 %.",
    },
    vapor: {
      titulo: "Lavado, remojo y vapor",
      texto: "El arroz pulido se lava, se remoja el tiempo justo y se cuece al vapor, no hervido.",
    },
    koji: {
      titulo: "Koji",
      texto:
        "Una parte del arroz se inocula con el moho koji. Sus enzimas convierten el almidón en azúcar. El habitual es el koji amarillo.",
    },
    shubo: {
      titulo: "Pie de cuba (shubo o moto)",
      texto:
        "Arroz, koji, agua y levadura en un tanque chico para multiplicar la levadura. Necesita ácido láctico que la proteja de bacterias. Lo moderno (sokujo) es añadirlo directamente: unas dos semanas.",
    },
    moromi: {
      titulo: "Fermentación principal (moromi)",
      texto:
        "Al pie de cuba se le suma arroz, koji y agua en tres tandas. El almidón pasa a azúcar y el azúcar a alcohol al mismo tiempo, en la misma cuba, durante tres a cinco semanas.",
    },
    prensado: {
      titulo: "Prensado",
      texto:
        "Se separa el sake de los sólidos del arroz (kasu). Sale en tres fracciones: arabashiri (la primera), nakagumi (el corazón) y seme (la última).",
    },
    carbon: {
      titulo: "Filtrado con carbón",
      texto: "Se pasa por carbón activo, que quita color y lima aristas de aroma y sabor.",
    },
    pasteurizacion: {
      titulo: "Pasteurización (hi-ire)",
      texto:
        "Se calienta a unos 65 °C para frenar enzimas y microbios. Lo normal es hacerlo dos veces: antes del reposo y al embotellar.",
    },
    reposo: {
      titulo: "Reposo",
      texto: "Unos meses en tanque para que el sake se asiente y se redondee.",
    },
    dilucion: {
      titulo: "Dilución con agua",
      texto: "Recién prensado ronda el 17–20 % de alcohol. Se le agrega agua para dejarlo cerca del 15 %.",
    },
    embotellado: { titulo: "Embotellado", texto: "A la botella y, en la barra, a la cámara a 5 °C." },
  },
  rutas: [
    {
      id: "sake",
      label: "Sake",
      resumen: "El proceso estándar, con pie de cuba moderno (sokujo).",
      pasos: [
        "pulido",
        "vapor",
        "koji",
        "shubo",
        "moromi",
        "prensado",
        "carbon",
        "pasteurizacion",
        "reposo",
        "dilucion",
        "embotellado",
      ],
    },
  ],
  terminos: [
    {
      id: "junmai",
      label: "Junmai",
      grupo: "Categoría",
      resumen: "Sake hecho solo con arroz, agua, koji y levadura, sin alcohol añadido.",
      enCopa: "Más cuerpo y sabor a arroz que su equivalente con alcohol añadido.",
      enCarta: "Casi toda la barra es junmai.",
      efectos: [
        {
          paso: "moromi",
          tipo: "cambia",
          texto: "No se añade alcohol destilado en ningún momento: todo el alcohol sale de la fermentación.",
        },
      ],
    },
    {
      id: "no-junmai",
      label: "Honjozo / Ginjo / Daiginjo (sin «junmai»)",
      grupo: "Categoría",
      resumen: "Si la etiqueta no dice junmai, lleva una pequeña adición de alcohol destilado.",
      enCopa: "Más ligero y con el aroma más suelto.",
      efectos: [
        {
          paso: "moromi",
          tipo: "nuevo",
          titulo: "Alcohol añadido",
          texto: "Justo antes de prensar se agrega un poco de alcohol destilado, que arrastra aromas y aligera el cuerpo.",
        },
      ],
    },
    {
      id: "ginjo",
      label: "Ginjo",
      grupo: "Categoría",
      resumen: "Arroz pulido al 60 % o menos y fermentación lenta en frío.",
      enCopa: "Más aromático y fino: fruta, flor.",
      enCarta: "Kido Junmai Ginjo, Niida Shizenshu Ginjo, Nabeshima 50.",
      efectos: [
        { paso: "pulido", tipo: "cambia", texto: "Queda como máximo el 60 % del grano." },
        { paso: "moromi", tipo: "cambia", texto: "Fermenta más frío y más despacio, lo que genera los aromas frutales." },
      ],
    },
    {
      id: "daiginjo",
      label: "Daiginjo",
      grupo: "Categoría",
      resumen: "Un ginjo con el arroz pulido al 50 % o menos.",
      enCopa: "El perfil más limpio y delicado; menos cuerpo.",
      enCarta: "Kido Daiginjo 50 y 40, Tedorigawa Tokujo Arabashiri, Ginrei Gassan.",
      efectos: [
        { paso: "pulido", tipo: "cambia", texto: "Queda como máximo el 50 % del grano: se pierde la mitad o más." },
        { paso: "moromi", tipo: "cambia", texto: "Fermentación fría y lenta, como en ginjo." },
      ],
    },
    {
      id: "kimoto",
      label: "Kimoto",
      grupo: "Pie de cuba",
      resumen: "Pie de cuba tradicional: el ácido láctico lo generan bacterias naturales, machacando el arroz.",
      enCopa: "Más acidez, umami y estructura.",
      enCarta: "Niida Shizenshu, Nichi-Nichi, Senkin Nature y Modern.",
      efectos: [
        {
          paso: "shubo",
          tipo: "cambia",
          texto:
            "No se añade ácido láctico. Se machaca el arroz con el koji con pértigas para que las bacterias lácticas del ambiente lo produzcan. Lleva alrededor del doble de tiempo.",
        },
      ],
    },
    {
      id: "yamahai",
      label: "Yamahai",
      grupo: "Pie de cuba",
      resumen: "Como el kimoto, pero sin machacar el arroz.",
      enCopa: "Más salvaje, lácteo, con cuerpo.",
      enCarta: "AFS, Hanatomoe, Biden, Akishika 2003.",
      efectos: [
        {
          paso: "shubo",
          tipo: "cambia",
          texto:
            "Tampoco se añade ácido láctico, y además se suprime el machacado: se deja que las enzimas del koji deshagan el arroz solas mientras las bacterias lácticas hacen su trabajo.",
        },
      ],
    },
    {
      id: "bodaimoto",
      label: "Bodaimoto",
      grupo: "Pie de cuba",
      resumen: "Método medieval de los templos de Nara, origen del kimoto.",
      enCopa: "Agridulce y antiguo.",
      enCarta: "Daigo no Shizuku.",
      efectos: [
        {
          paso: "shubo",
          tipo: "cambia",
          texto: "Se deja arroz crudo en agua hasta que se agria sola; esa agua ácida es la que arranca el pie de cuba.",
        },
      ],
    },
    {
      id: "koji-blanco",
      label: "Koji blanco",
      grupo: "Pie de cuba",
      resumen: "Se usa el koji del shochu en lugar del amarillo.",
      enCopa: "Acidez cítrica muy marcada.",
      enCarta: "Natsu no Omoide, Seafood.",
      efectos: [
        {
          paso: "koji",
          tipo: "cambia",
          texto: "El koji blanco, además de las enzimas, produce ácido cítrico.",
        },
      ],
    },
    {
      id: "arabashiri",
      label: "Arabashiri",
      grupo: "Después de fermentar",
      resumen: "La primera fracción que sale de la prensa.",
      enCarta: "Tedorigawa Tokujo Arabashiri.",
      efectos: [
        {
          paso: "prensado",
          tipo: "cambia",
          texto: "Se embotella solo lo primero que cae, casi sin presión. Nakagumi es el corazón y seme el final.",
        },
      ],
    },
    {
      id: "muroka",
      label: "Muroka",
      grupo: "Después de fermentar",
      resumen: "Sin filtrar con carbón.",
      enCopa: "Conserva color y todo el sabor, con más aristas.",
      enCarta: "AFS, Senkin Modern.",
      efectos: [{ paso: "carbon", tipo: "salta", texto: "No pasa por carbón activo." }],
    },
    {
      id: "nama",
      label: "Nama",
      grupo: "Después de fermentar",
      resumen: "Sin pasteurizar. Siempre en frío.",
      enCopa: "Más vivo y fresco; evoluciona en días una vez abierto.",
      enCarta: "Tedorigawa Arabashiri, AFS, Daigo no Shizuku.",
      efectos: [
        {
          paso: "pasteurizacion",
          tipo: "salta",
          texto: "No se calienta nunca: las enzimas siguen activas, por eso no sale de la cámara.",
        },
      ],
    },
    {
      id: "koshu",
      label: "Koshu",
      grupo: "Después de fermentar",
      resumen: "Sake añejado.",
      enCopa: "Color ámbar, fruto seco, caramelo, salsa de soja.",
      enCarta: "Biden, Akishika 2003, Chokyu 1997.",
      efectos: [{ paso: "reposo", tipo: "cambia", texto: "En lugar de unos meses, descansa años." }],
    },
    {
      id: "genshu",
      label: "Genshu",
      grupo: "Después de fermentar",
      resumen: "Sin diluir con agua.",
      enCopa: "Más alcohol y más concentración.",
      enCarta: "Tedorigawa Arabashiri, AFS, Senkin Modern, Daigo no Shizuku.",
      efectos: [{ paso: "dilucion", tipo: "salta", texto: "Se embotella con el alcohol que tenía al salir de la prensa." }],
    },
    {
      id: "kijoshu",
      label: "Kijoshu",
      grupo: "Después de fermentar",
      resumen: "Parte del agua de la elaboración se sustituye por sake.",
      enCopa: "Dulce y denso.",
      enCarta: "Chokyu 1997.",
      efectos: [
        {
          paso: "moromi",
          tipo: "cambia",
          texto: "En la fermentación, parte del agua se reemplaza por sake ya hecho: la levadura no llega a comerse todo el azúcar.",
        },
      ],
    },
  ],
};

const VINO: Proceso = {
  id: "vino",
  label: "Vino",
  intro:
    "La gran diferencia entre un blanco, un tinto y un espumoso es cuándo se prensa y qué pasa después. Elegí un tipo de vino y después un término de la carta.",
  pasos: {
    vendimia: { titulo: "Vendimia", texto: "Se cosecha la uva en su punto de madurez." },
    "prensado-blanco": {
      titulo: "Prensado, antes de fermentar",
      texto: "La uva se prensa enseguida y fermenta solo el mosto, sin pieles: por eso no toma color ni tanino.",
    },
    desfangado: {
      titulo: "Desfangado",
      texto: "El mosto reposa en frío para que decanten los sólidos más gruesos.",
    },
    fermentacion: {
      titulo: "Fermentación",
      texto:
        "La levadura convierte el azúcar del mosto en alcohol. En los blancos de la carta, en inox, fudres o barricas usadas.",
    },
    lias: {
      titulo: "Crianza",
      texto: "El vino descansa, a menudo sobre sus lías (las levaduras muertas), que le dan textura.",
    },
    clarificado: {
      titulo: "Clarificado y filtrado",
      texto: "Se limpia el vino para que quede brillante y estable.",
    },
    embotellado: {
      titulo: "Embotellado",
      texto: "Con una pequeña dosis de sulfuroso para protegerlo.",
    },
    despalillado: {
      titulo: "Despalillado y estrujado",
      texto: "Se separan los granos del raspón y se rompen suavemente. La uva va entera, con piel, a la cuba.",
    },
    maceracion: {
      titulo: "Fermentación con las pieles",
      texto:
        "Acá está la diferencia con el blanco: el mosto fermenta junto con las pieles, que le dan el color y el tanino. Cuanto más tiempo y más extracción, más estructura.",
    },
    "prensado-tinto": {
      titulo: "Prensado, después de fermentar",
      texto: "Recién ahora se prensa, para separar el vino de las pieles.",
    },
    malolactica: {
      titulo: "Maloláctica",
      texto: "Unas bacterias transforman el ácido málico (manzana verde) en láctico (más suave). Redondea el vino.",
    },
    "crianza-tinto": {
      titulo: "Crianza",
      texto: "Meses o años en barrica, fudre o depósito antes de la botella.",
    },
    "vino-base": {
      titulo: "Vino base",
      texto: "Primera fermentación: se hace un vino tranquilo, seco y muy ácido.",
    },
    assemblage: {
      titulo: "Mezcla (assemblage)",
      texto:
        "Se mezclan uvas, parcelas y, en los sin añada (NV), vinos de reserva de años anteriores con la cosecha base.",
    },
    tirage: {
      titulo: "Tirage y segunda fermentación",
      texto:
        "Se embotella con azúcar y levaduras y fermenta por segunda vez dentro de la botella. El gas no puede salir: ahí nace la burbuja.",
    },
    "crianza-lias": {
      titulo: "Crianza sobre lías",
      texto:
        "Las levaduras muertas quedan en la botella meses o años: pan, brioche, fruto seco y burbuja más fina. Mínimo en Champagne: 15 meses para un NV; en Corpinnat, 18.",
    },
    deguelle: {
      titulo: "Removido y degüelle",
      texto: "Se llevan las lías al cuello de la botella y se expulsan.",
    },
    dosage: {
      titulo: "Dosage",
      texto: "Se rellena con el licor de expedición, que puede llevar algo de azúcar, y se pone el corcho definitivo.",
    },
    "fermentacion-seco": {
      titulo: "Fermentación hasta seco",
      texto: "El mosto de palomino fermenta hasta no dejar azúcar.",
    },
    encabezado: {
      titulo: "Encabezado",
      texto: "Se ajusta el vino a unos 15 % de alcohol, el punto en que la flor puede vivir.",
    },
    flor: {
      titulo: "Crianza bajo velo de flor",
      texto:
        "En botas sin llenar del todo, una capa de levaduras (la flor) cubre el vino, lo protege del oxígeno y se come el glicerol: de ahí lo seco, salino y punzante. Se cría en solera: el vino joven va rellenando las botas más viejas.",
    },
    saca: {
      titulo: "Saca y embotellado",
      texto: "Se saca una parte de la solera y se embotella. La fecha de saca dice cuán fresco está.",
    },
  },
  rutas: [
    {
      id: "blanco",
      label: "Blanco",
      resumen: "Se prensa primero y fermenta solo el mosto.",
      pasos: ["vendimia", "prensado-blanco", "desfangado", "fermentacion", "lias", "clarificado", "embotellado"],
    },
    {
      id: "tinto",
      label: "Tinto",
      resumen: "Fermenta con las pieles y se prensa después.",
      pasos: [
        "vendimia",
        "despalillado",
        "maceracion",
        "prensado-tinto",
        "malolactica",
        "crianza-tinto",
        "embotellado",
      ],
    },
    {
      id: "espumoso",
      label: "Espumoso",
      resumen: "Método tradicional (Champagne, Corpinnat): la burbuja nace en la botella.",
      pasos: [
        "vendimia",
        "prensado-blanco",
        "vino-base",
        "assemblage",
        "tirage",
        "crianza-lias",
        "deguelle",
        "dosage",
      ],
    },
    {
      id: "fino",
      label: "Fino",
      resumen: "Jerez: un blanco seco criado bajo velo de flor.",
      pasos: ["vendimia", "prensado-blanco", "fermentacion-seco", "encabezado", "flor", "saca"],
    },
  ],
  terminos: [
    {
      id: "minima-blanco",
      label: "Mínima intervención",
      grupo: "Blanco",
      resumen: "Viña en ecológico o biodinámico y nada añadido ni quitado en bodega.",
      enCopa: "Puede abrir con algo de reducción o una punta de gas: se va con aire.",
      enCarta: "Cossard, Chapuis & Chapuis, Selma de Nin.",
      efectos: [
        { paso: "fermentacion", tipo: "cambia", texto: "Fermenta con las levaduras propias de la uva, sin correcciones." },
        { paso: "clarificado", tipo: "salta", texto: "Ni se clarifica ni se filtra." },
        { paso: "embotellado", tipo: "cambia", texto: "Muy poco o ningún sulfuroso añadido." },
      ],
    },
    {
      id: "kabinett",
      label: "Con dulzor (Kabinett)",
      grupo: "Blanco",
      resumen: "Riesling del Mosela de la categoría de madurez más ligera, que suele llevar azúcar residual.",
      enCopa: "Poco alcohol y dulzor sostenido por mucha acidez. Hay que avisar que no es seco.",
      enCarta: "Willi Schaefer Graacher Domprobst Kabinett.",
      efectos: [
        {
          paso: "fermentacion",
          tipo: "cambia",
          texto: "La fermentación se detiene antes de que la levadura consuma todo el azúcar: queda dulzor y menos alcohol.",
        },
      ],
    },
    {
      id: "minima-tinto",
      label: "Mínima intervención",
      grupo: "Tinto",
      resumen: "Viña en ecológico o biodinámico y nada añadido ni quitado en bodega.",
      enCopa: "Puede abrir con algo de reducción o una punta de gas: se va con aire.",
      enCarta: "Cossard, Chapuis & Chapuis, Saint-Cyr, Renardière.",
      efectos: [
        { paso: "maceracion", tipo: "cambia", texto: "Fermenta con las levaduras propias de la uva, sin correcciones." },
        { paso: "embotellado", tipo: "cambia", texto: "Sin clarificar ni filtrar, y con muy poco o ningún sulfuroso." },
      ],
    },
    {
      id: "qvevri",
      label: "Ánfora (qvevri)",
      grupo: "Tinto",
      resumen: "Tinaja de barro en lugar de barrica o depósito.",
      enCopa: "Fruta muy pura, sin notas de madera.",
      enCarta: "Cossard Gevrey-Chambertin Les Genevrières «Qvevris».",
      efectos: [
        { paso: "maceracion", tipo: "cambia", texto: "Fermenta en ánfora de barro." },
        { paso: "crianza-tinto", tipo: "cambia", texto: "Y se cría en la misma ánfora: el barro no aporta sabor." },
      ],
    },
    {
      id: "ligero",
      label: "Tinto ligero",
      grupo: "Tinto",
      resumen: "Pinot noir, gamay, trousseau, garnacha de altura, mencía: lo que manda en la carta.",
      enCopa: "Color claro y tanino fino, que no se pelea con el umami ni con el pescado.",
      enCarta: "Chapuis Côte d'Or, Renardière, Saint-Cyr, Lalama.",
      efectos: [
        {
          paso: "maceracion",
          tipo: "cambia",
          texto: "Uvas de piel fina y extracción suave: sale poco color y poco tanino.",
        },
      ],
    },
    {
      id: "guarda",
      label: "Tinto de guarda",
      grupo: "Tinto",
      resumen: "Rioja, Ribera del Duero, Barolo: las grandes botellas.",
      enCopa: "Más tanino y estructura. Conviene decantar los jóvenes.",
      enCarta: "La Rioja Alta 904 y 890, Peñas Aladas, Contador, Barolo Le Vigne.",
      efectos: [
        { paso: "maceracion", tipo: "cambia", texto: "Más tiempo con las pieles: más tanino y estructura." },
        { paso: "crianza-tinto", tipo: "cambia", texto: "Crianza larga, de años, en madera y después en botella." },
      ],
    },
    {
      id: "blanc-de-blancs",
      label: "Blanc de blancs",
      grupo: "Espumoso",
      resumen: "Blanco hecho solo con uva blanca (chardonnay).",
      enCopa: "Tensión, cítrico, tiza.",
      enCarta: "Larmandier-Bernier Longitude, Doyard Révolution, Gimonnet Special Club.",
      efectos: [{ paso: "assemblage", tipo: "cambia", texto: "Solo entra chardonnay." }],
    },
    {
      id: "blanc-de-noirs",
      label: "Blanc de noirs",
      grupo: "Espumoso",
      resumen: "Blanco hecho solo con uva tinta (pinot noir y/o meunier).",
      enCopa: "Más cuerpo y fruta roja.",
      enCarta: "Gonet-Médeville Blanc de Noirs, Wirth Michel Les Meuniers de Raoul.",
      efectos: [
        {
          paso: "prensado-blanco",
          tipo: "cambia",
          texto: "La uva tinta se prensa rápido y suave, sin dejar que la piel tiña el mosto.",
        },
      ],
    },
    {
      id: "perpetua",
      label: "Reserva perpetua",
      grupo: "Espumoso",
      resumen: "Un depósito que nunca se vacía: cada año se saca una parte y se rellena con vino nuevo.",
      enCopa: "Complejidad de muchas cosechas en una sola copa.",
      enCarta: "Roger Coulon Heri Hodie.",
      efectos: [
        {
          paso: "assemblage",
          tipo: "cambia",
          texto: "El vino de reserva sale de una solera que contiene un poco de todas las cosechas desde que se inició.",
        },
      ],
    },
    {
      id: "millesime",
      label: "Añada (millésimé)",
      grupo: "Espumoso",
      resumen: "De una sola cosecha, sin vinos de reserva.",
      enCarta: "Gimonnet Special Club 2016, Marguet Sapience 2018.",
      efectos: [
        { paso: "assemblage", tipo: "cambia", texto: "Solo vinos de ese año." },
        { paso: "crianza-lias", tipo: "cambia", texto: "En Champagne, mínimo tres años sobre lías." },
      ],
    },
    {
      id: "brut-nature",
      label: "Brut nature",
      grupo: "Espumoso",
      resumen: "También dosage zéro o non dosé: 0–3 g/L, sin azúcar añadido.",
      enCopa: "El perfil más seco y filoso.",
      enCarta: "Recaredo Serral del Vell, Lenoble Dosage Zéro, Vouette et Sorbée.",
      efectos: [{ paso: "dosage", tipo: "cambia", texto: "El licor de expedición no lleva azúcar." }],
    },
    {
      id: "extra-brut",
      label: "Extra brut",
      grupo: "Espumoso",
      resumen: "Hasta 6 g/L de azúcar.",
      enCopa: "Seco, con el filo apenas redondeado.",
      enCarta: "Larmandier-Bernier, Jacquesson 749, Huré Frères Mémoire.",
      efectos: [{ paso: "dosage", tipo: "cambia", texto: "Una dosis mínima de azúcar, hasta 6 g/L." }],
    },
    {
      id: "brut",
      label: "Brut",
      grupo: "Espumoso",
      resumen: "Hasta 12 g/L de azúcar.",
      enCopa: "Más redondo y amable.",
      enCarta: "Charles Heidsieck Brut Réserve, Krug Grande Cuvée.",
      efectos: [{ paso: "dosage", tipo: "cambia", texto: "Hasta 12 g/L de azúcar." }],
    },
  ],
};

const WHISKY: Proceso = {
  id: "whisky",
  label: "Whisky",
  intro:
    "Un whisky es, en el fondo, una cerveza sin lúpulo destilada y envejecida en madera. Lo que cambia entre uno y otro es el cereal, el alambique, la turba y la barrica.",
  pasos: {
    malteado: {
      titulo: "Malteado",
      texto: "La cebada se humedece para que germine y después se seca con aire caliente. Así el grano libera sus enzimas.",
    },
    maceracion: {
      titulo: "Molienda y maceración",
      texto: "La malta molida se mezcla con agua caliente, que extrae los azúcares del grano.",
    },
    fermentacion: {
      titulo: "Fermentación",
      texto: "Se agrega levadura y en dos o tres días queda una especie de cerveza sin lúpulo.",
    },
    "pot-still": {
      titulo: "Destilación en pot still",
      texto: "Alambique de cobre, por tandas, normalmente dos veces. Es un destilado con mucho carácter.",
    },
    barrica: {
      titulo: "Barrica",
      texto:
        "El destilado entra transparente y la madera le da color y buena parte del sabor: bourbon (vainilla, coco), jerez (fruta seca, especia), mizunara (incienso, sándalo), vino tinto (fruta roja).",
    },
    reduccion: {
      titulo: "Reducción con agua",
      texto: "Se baja con agua hasta la graduación de embotellado; 43 % es la clásica.",
    },
    embotellado: { titulo: "Embotellado", texto: "El whisky deja de evolucionar al salir de la barrica." },
    malta: {
      titulo: "Whiskies de malta",
      texto: "Cebada malteada destilada en pot still: aportan el carácter y la profundidad.",
    },
    grano: {
      titulo: "Whiskies de grano",
      texto: "Otros cereales, destilados en columna continua: salen más ligeros y suaves, y dan la base de la mezcla.",
    },
    "barrica-separado": {
      titulo: "Barricas, por separado",
      texto: "Cada whisky envejece en su barrica antes de mezclarse.",
    },
    mezcla: {
      titulo: "Mezcla del blender",
      texto: "El maestro mezclador combina decenas de barricas para lograr un estilo constante y equilibrado.",
    },
  },
  rutas: [
    {
      id: "single-malt",
      label: "Single malt",
      resumen: "Cebada malteada, una sola destilería, alambique de cobre.",
      pasos: ["malteado", "maceracion", "fermentacion", "pot-still", "barrica", "reduccion", "embotellado"],
    },
    {
      id: "blended",
      label: "Blended",
      resumen: "Mezcla de whiskies de malta con whiskies de grano, más ligeros.",
      pasos: ["malta", "grano", "barrica-separado", "mezcla", "reduccion", "embotellado"],
    },
  ],
  terminos: [
    {
      id: "peated",
      label: "Peated / Smoky",
      grupo: "Single malt",
      resumen: "La malta se seca con humo de turba.",
      enCopa: "Ahumado: de elegante a intenso según la dosis.",
      enCarta: "Kuju New Born Peated, Yamazaki Smoky Batch, Akkeshi Keichitsu.",
      efectos: [
        {
          paso: "malteado",
          tipo: "cambia",
          texto: "En el secado se quema turba: el humo se pega al grano y llega hasta la copa.",
        },
      ],
    },
    {
      id: "new-born",
      label: "New Born",
      grupo: "Single malt",
      resumen: "Destilado joven, con menos de tres años de barrica. Legalmente aún no es whisky.",
      enCopa: "Más cereal y destilado, poca madera.",
      enCarta: "Kuju New Born Peated #3.",
      efectos: [
        {
          paso: "barrica",
          tipo: "cambia",
          texto: "Sale de la barrica antes de los tres años: es una foto de hacia dónde va la destilería.",
        },
      ],
    },
    {
      id: "japanese",
      label: "«Japanese Whisky»",
      grupo: "Single malt",
      resumen: "Desde 2021, para usar ese nombre todo el proceso tiene que hacerse en Japón.",
      enCarta: "Todas las referencias de la carta son de destilerías que destilan allí.",
      efectos: [
        { paso: "fermentacion", tipo: "cambia", texto: "Fermentado en Japón, con agua japonesa." },
        { paso: "pot-still", tipo: "cambia", texto: "Destilado en Japón." },
        { paso: "barrica", tipo: "cambia", texto: "Envejecido en Japón al menos tres años." },
      ],
    },
    {
      id: "fuerza-barrica",
      label: "55 % o más",
      grupo: "Single malt",
      resumen: "Embotellado a fuerza de barrica o cerca.",
      enCopa: "Potente; agradece unas gotas de agua.",
      enCarta: "Akkeshi Keichitsu, Shizuoka Pot Still «K».",
      efectos: [{ paso: "reduccion", tipo: "salta", texto: "Casi no se rebaja con agua: va a la botella como sale de la barrica." }],
    },
    {
      id: "hibiki",
      label: "En carta: Hibiki",
      grupo: "Blended",
      resumen: "Hibiki Blender's Choice es el blended de la carta.",
      enCopa: "El más fácil de la lista: redondo y equilibrado.",
      enCarta: "Hibiki Blender's Choice.",
      efectos: [
        { paso: "mezcla", tipo: "cambia", texto: "Maltas y granos de las destilerías de Suntory, a 43 %." },
      ],
    },
  ],
};

export const PROCESOS: Proceso[] = [SAKE, VINO, WHISKY];

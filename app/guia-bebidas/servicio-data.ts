/**
 * Contenido de la sección "Servicio" de la guía de bebidas: protocolo básico
 * para quien recién empieza a servir vino y sake. Es servicio clásico de sala;
 * lo que depende de la casa (medidas, dónde queda la botella) se marca como tal.
 */

export type PasoServicio = {
  id: string;
  titulo: string;
  texto: string;
  /** Detalle que suele fallar. */
  ojo?: string;
  /** Qué decirle al comensal, tal cual. */
  frase?: string;
};

export type Protocolo = {
  id: "basico" | "vino-botella" | "vino-copa" | "sake-copa" | "sake-tokkuri";
  label: string;
  intro: string;
  pasos: PasoServicio[];
};

export const PROTOCOLOS: Protocolo[] = [
  {
    id: "basico",
    label: "Lo básico",
    intro:
      "Antes de servir la primera copa: cómo se agarra, qué llevás encima y cómo te movés en la barra. Vale para vino y para sake.",
    pasos: [
      {
        id: "b-copa",
        titulo: "La copa se agarra por el tallo",
        texto:
          "Siempre por el tallo o la base, nunca por el cáliz ni por el borde: la mano calienta la bebida y deja huellas. Las copas vacías se llevan boca abajo, colgadas entre los dedos por la base, o en bandeja.",
        ojo: "Antes de apoyar una copa, mirala contra la luz: sin marcas ni gotas.",
      },
      {
        id: "b-equipo",
        titulo: "Lo que llevás encima",
        texto:
          "Un lito (servilleta de tela) para secar el pico de la botella y un sacacorchos de mozo en el bolsillo. Con eso resolvés casi todo sin tener que ir y volver.",
      },
      {
        id: "b-conocer",
        titulo: "Sabé qué estás sirviendo",
        texto:
          "Nombre, tipo y una frase que lo cuente. Está todo en la ficha de cada botella de esta Guía; el Machete sirve para repasar antes del servicio. Si te preguntan algo que no sabés, no inventes: decí que lo consultás y volvé con la respuesta.",
        frase: "Buena pregunta, lo consulto y le cuento.",
      },
      {
        id: "b-moverse",
        titulo: "Servir sin cruzar a nadie",
        texto:
          "Serví de frente al comensal o desde su derecha, con la mano derecha. Nunca pases la botella ni el brazo por delante de la cara de otro comensal: si no llegás, das la vuelta.",
        ojo: "La copa se llena donde está, apoyada en la barra. No la levantes para servir.",
      },
      {
        id: "b-anotar",
        titulo: "Anotalo en Bebidas",
        texto:
          "Cada vez que servís algo, anotalo en la sección Bebidas de la app: asiento, qué tomó, cantidad y si fue copa, tokkuri, botella o extra. Si no queda anotado, no se cobra.",
      },
    ],
  },
  {
    id: "vino-botella",
    label: "Vino: botella",
    intro:
      "Cuando una mesa pide una botella entera. El orden importa: mostrar, abrir, dar a probar y recién ahí servir.",
    pasos: [
      {
        id: "vb-presentar",
        titulo: "Presentar la botella",
        texto:
          "Antes de abrirla, mostrásela a quien la pidió: la base apoyada en el lito, la etiqueta mirando al comensal. Decí el nombre, el productor y la cosecha, y esperá que te confirme que es esa.",
        frase: "Les traigo el Petit Chablis de Billaud-Simon, cosecha 2023.",
        ojo: "Si no sabés quién la pidió, preguntá. Esa persona es la que después la prueba.",
      },
      {
        id: "vb-abrir",
        titulo: "Abrir",
        texto:
          "Cortá la cápsula por debajo del labio del pico, sin girar la botella (la etiqueta sigue mirando al comensal). Clavá el sacacorchos en el centro, sacá el corcho despacio y sin ruido, y limpiá el pico con el lito.",
        ojo: "Un espumoso no hace «pop»: sostené el corcho con el pulgar, girá la botella (no el corcho), inclinada y sin apuntar a nadie, y que salga con un suspiro.",
      },
      {
        id: "vb-probar",
        titulo: "Dar a probar",
        texto:
          "Serví un sorbo, más o menos dos dedos en el fondo de la copa, solo a quien la pidió, y esperá. Lo mira, lo huele y lo prueba: no se fija si le gusta, sino que el vino esté sano.",
        frase: "¿Le sirvo un poquito para que lo pruebe?",
        ojo: "Si dice que tiene un defecto (olor a humedad o a cartón mojado), no discutas: retirá la botella con una disculpa y avisá al encargado.",
      },
      {
        id: "vb-servir",
        titulo: "Servir a la mesa",
        texto:
          "Con el visto bueno, serví primero a los demás, de a uno y en orden, y terminá con quien lo probó, completándole la copa. Hasta un tercio de la copa, la parte más ancha: así hay lugar para que respire.",
        frase: "¿Está bien? Perfecto, les sirvo.",
        ojo: "El pico de la botella nunca toca la copa, y la etiqueta queda siempre a la vista.",
      },
      {
        id: "vb-gota",
        titulo: "Cortar la gota",
        texto:
          "Al terminar cada copa, levantá el pico girando un poco la botella sobre sí misma: así la última gota no cae en la barra. Pasá el lito por el pico antes de ir a la copa siguiente.",
      },
      {
        id: "vb-seguir",
        titulo: "Acompañar la botella",
        texto:
          "Cuando una copa baja de la mitad de lo servido, ofrecé completar sin llenar de más. Blancos y espumosos vuelven al frío entre ronda y ronda; dónde queda la botella lo define el encargado. Avisá cuando servís la última copa.",
        frase:
          "Es la última copa de la botella. ¿Les traigo otra o prefieren pasar a otra cosa?",
      },
    ],
  },
  {
    id: "vino-copa",
    label: "Vino: copa",
    intro:
      "Cuando piden una copa de algo que se sirve por copa. Más corto que la botella, pero con la misma prolijidad.",
    pasos: [
      {
        id: "vc-copa",
        titulo: "Copa limpia, delante del comensal",
        texto:
          "Poné la copa vacía delante del comensal antes de servir, a la derecha de su lugar. Para blancos y espumosos, que la copa no esté caliente recién salida del lavado.",
      },
      {
        id: "vc-mostrar",
        titulo: "Mostrar de qué botella sale",
        texto:
          "Traé la botella y mostrale la etiqueta mientras le decís qué le servís. Que vea lo que toma es parte del servicio.",
        frase: "Le sirvo el Kido Daiginjo 40, de Wakayama.",
        ojo: "Si la botella ya estaba abierta, probala vos antes, aparte: si notás algo raro, no la sirvas y avisá.",
      },
      {
        id: "vc-medida",
        titulo: "Siempre la misma medida",
        texto:
          "Serví la medida de la casa, igual para todos. Una copa más llena que la del vecino se nota, y además descuadra lo que se cobra.",
        ojo: "La medida la define el encargado. Si tenés dudas, preguntá antes del servicio, no durante.",
      },
      {
        id: "vc-anotar",
        titulo: "Anotar como copa",
        texto:
          "En Bebidas: el asiento, el nombre, la cantidad y el formato Copa.",
      },
    ],
  },
  {
    id: "sake-copa",
    label: "Sake: copa",
    intro:
      "Muchos sakes se sirven en copa de vino: la forma junta los aromas, sobre todo en los ginjo y daiginjo.",
    pasos: [
      {
        id: "sc-temperatura",
        titulo: "La temperatura justa",
        texto:
          "Cada sake tiene su temperatura: frío, a temperatura ambiente o tibio. Está en la ficha de cada botella. Los ginjo y daiginjo casi siempre van fríos; algunos junmai ganan tibios.",
        frase: "Este lo servimos frío, que es como mejor se expresa.",
      },
      {
        id: "sc-presentar",
        titulo: "Presentar",
        texto:
          "Igual que el vino: la etiqueta hacia el comensal. Decí el nombre, el tipo (junmai, ginjo, daiginjo…) y una frase de cómo es. Si piden la botella entera, también se da a probar antes de servir a la mesa.",
        frase: "Es un junmai daiginjo: muy aromático, a fruta blanca, y seco.",
      },
      {
        id: "sc-servir",
        titulo: "Servir",
        texto:
          "Serví la medida de la casa, apoyando la copa en la barra como con el vino. El sake suele tener algo más de alcohol que el vino y se toma en sorbos chicos.",
        ojo: "Las mismas reglas: copa por el tallo, la botella no toca la copa, cortar la gota.",
      },
    ],
  },
  {
    id: "sake-tokkuri",
    label: "Sake: tokkuri",
    intro:
      "El tokkuri es la jarrita y el ochoko (o guinomi), el vasito. Es el servicio más japonés y tiene sus códigos.",
    pasos: [
      {
        id: "st-llevar",
        titulo: "Llevar el juego",
        texto:
          "Tokkuri con el sake a la temperatura que corresponde y un ochoko por persona, en bandeja. Apoyá un ochoko delante de cada comensal y el tokkuri en el centro.",
        ojo: "Si va tibio, el tokkuri quema: agarralo por el cuello y avisá al apoyarlo.",
      },
      {
        id: "st-servir",
        titulo: "Servir con las dos manos",
        texto:
          "Agarrá el tokkuri con la mano derecha y apoyá los dedos de la izquierda abajo o al costado: servir con las dos manos es la forma respetuosa. Llená cada ochoko hasta unas tres cuartas partes.",
        frase: "Les sirvo la primera.",
      },
      {
        id: "st-entre-ellos",
        titulo: "Nadie se sirve a sí mismo",
        texto:
          "En Japón uno no se sirve su propio sake: se sirven entre ellos. Vos servís la primera ronda; después, si ves un ochoko vacío y nadie lo llena, ofrecé servir.",
        ojo: "No hace falta explicárselo al comensal, salvo que pregunte. Es un detalle para contar, no una regla para imponer.",
      },
      {
        id: "st-kanpai",
        titulo: "¡Kanpai!",
        texto:
          "Es el brindis: literalmente «vaso seco». Si la mesa brinda, esperá a que terminen para seguir sirviendo.",
      },
      {
        id: "st-anotar",
        titulo: "Anotar como tokkuri",
        texto:
          "En Bebidas: el asiento de quien lo pidió, el sake, la cantidad de tokkuris y el formato Tokkuri.",
      },
    ],
  },
];

/** Errores de quien recién empieza. Se muestran al final de "Lo básico". */
export const ERRORES_COMUNES: string[] = [
  "Agarrar la copa por el cáliz o por el borde.",
  "Llenar la copa de más: hasta un tercio alcanza.",
  "Que el pico de la botella toque la copa.",
  "Servir sin mostrar la etiqueta ni decir qué es.",
  "Servirle a todos antes de que el anfitrión pruebe la botella.",
  "Descorchar un espumoso con «pop».",
  "Pasar el brazo por delante de otro comensal.",
  "Inventar una respuesta en vez de consultar.",
  "Dejar copas u ochokos vacíos sin ofrecer más.",
  "Olvidarse de anotarlo en Bebidas.",
];

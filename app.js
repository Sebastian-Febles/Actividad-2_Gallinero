/* ==========================================================================
   GALLINERO CLIMÁTICO — LÓGICA DE LA APP
   Usa Open-Meteo (gratis, sin clave de API) para obtener clima y horas de luz.
   ==========================================================================
   ÍNDICE (busca el número con Ctrl+F para saltar a cada parte)
     1. CONFIGURACIÓN ......... números y valores que puedes cambiar
     2. TEXTOS ................ todos los mensajes que ve el usuario
     3. ELEMENTOS DE LA PÁGINA  conexión con los ids del index.html
     4. DATOS GUARDADOS ....... localStorage (ciudad, gallinas, huevos)
     5. API ................... peticiones a Open-Meteo y manejo de errores
     6. CÁLCULOS .............. nivel de calor, luz y huevos estimados
     7. PANTALLA: PRONÓSTICO .. dibuja las tarjetas de los 7 días
     8. PANTALLA: REGISTRO .... estadísticas, gráfica y lista de huevos
     9. EVENTOS ............... qué pasa al enviar formularios
    10. INICIO ................ lo primero que se ejecuta al abrir la página

   ¿QUÉ QUIERES CAMBIAR?
     - La fórmula o los límites de temperatura ........ sección 1
     - Un mensaje o consejo ........................... sección 2
     - El aspecto de las tarjetas ..................... sección 7 y style.css
     - Cómo se calculan los huevos .................... sección 6
   ========================================================================== */


/* ==========================================================================
   1. CONFIGURACIÓN — valores que puedes ajustar sin tocar el resto del código
   ========================================================================== */
const CONFIG = {
  // --- Servicio de clima (Open-Meteo) ---
  urlBuscarCiudad: "https://geocoding-api.open-meteo.com/v1/search",
  urlPronostico:   "https://api.open-meteo.com/v1/forecast",
  diasPronostico:  7,        // cuántos días mostrar
  tiempoMaximoMs:  10000,    // espera máxima por la API (10 s)

  // --- Valores iniciales (la primera vez que se abre la app) ---
  ciudadInicial: { name: "Mérida, Yucatán, México", lat: 20.97, lon: -89.62 },
  gallinasIniciales: "6",

  // --- Producción de huevos ---
  huevosPorGallinaAlDia: 0.8,   // en condiciones ideales (valor aproximado)

  // --- Temperaturas (°C) que cambian el nivel de calor ---
  temperatura: {
    extremo: 35,   // desde aquí: calor extremo
    calor:   30,   // desde aquí: calor
    frio:     5,   // hasta aquí: frío
  },

  // --- Cuánto baja la puesta según el clima (1 = sin cambio, 0.7 = 30% menos) ---
  factorClima: {
    extremo: 0.7,
    calor:   0.85,
    frio:    0.8,
    normal:  1,
  },

  // --- Horas de luz ---
  luz: {
    horasIdeales: 14,   // con estas horas o más, la puesta es normal
    horasMinimas: 10,   // con estas horas la puesta baja al factor mínimo
    factorMinimo: 0.7,
  },

  // --- Gráfica ---
  graficaAlturaMaximaPorcentaje: 85,   // altura de la barra más alta (% del espacio)
  diasGrafica: 7,

  // --- Nombres de lo que se guarda en el navegador (localStorage) ---
  claves: {
    ciudad:   "gallinero.place",
    gallinas: "gallinero.hens",
    huevos:   "gallinero.eggs",
  },
};


/* ==========================================================================
   2. TEXTOS — todo lo que lee el usuario. Cambia aquí las frases.
   (Las que son funciones reciben un dato, por ejemplo el nombre de la ciudad.)
   ========================================================================== */
const TEXTOS = {
  // --- Estados ---
  buscandoCiudad:    "Buscando ciudad…",
  consultando:       "Consultando pronóstico…",
  conexionPerdida:   "Perdiste la conexión a internet.",
  sinRegistros:      "Aún no hay registros. Anota los huevos que recogiste hoy.",
  botonEliminar:     "Eliminar",

  // --- Errores de red ---
  sinInternet:       "Sin conexión a internet. Revisa tu red e inténtalo de nuevo.",
  limitePeticiones:  "Se alcanzó el límite de peticiones. Espera un minuto e inténtalo otra vez.",
  errorServicio:     (codigo) => `El servicio de clima respondió con un error (${codigo}).`,
  tiempoAgotado:     "El servicio tardó demasiado en responder. Inténtalo de nuevo.",
  noSePudoConectar:  "No se pudo conectar con el servicio de clima.",

  // --- Errores de datos ---
  ciudadNoEncontrada: (busqueda) => `No encontramos "${busqueda}". Prueba con otro nombre o agrega el estado.`,
  pronosticoVacio:    "El servicio no devolvió datos de pronóstico para este lugar.",

  // --- Niveles de calor: título y consejo de cada tarjeta ---
  clima: {
    extremo: { etiqueta: "Calor extremo", consejo: "Da sombra, agua fresca y ventilación. Evita manejarlas al mediodía." },
    calor:   { etiqueta: "Calor",         consejo: "Agua fresca extra y sombra. La puesta puede bajar." },
    frio:    { etiqueta: "Frío",          consejo: "Protege del viento y revisa que el agua no se congele." },
    normal:  { etiqueta: "Buen clima",    consejo: "Temperatura cómoda para la puesta." },
  },

  // --- Textos dentro de cada tarjeta del pronóstico ---
  horasDeLuz:     (h) => `☀ ${h} h de luz`,
  huevosEstimados:(n) => `≈ ${n} huevos`,
  agregarLuz:     (h) => `Agrega ${h} h de luz artificial.`,

  // --- Lista de registros ---
  registroDelDia: (fecha, cantidad) => `${fecha}: ${cantidad} huevos`,
};


/* ==========================================================================
   3. ELEMENTOS DE LA PÁGINA — conecta cada pieza del index.html con el código
   Si cambias un id en index.html, cámbialo también aquí.
   ========================================================================== */
const el = {
  // Encabezado
  huevosHoy:      document.getElementById("eggToday"),    // número dentro del huevo
  // Panel 1: configuración
  formConfig:     document.getElementById("configForm"),
  inputCiudad:    document.getElementById("city"),
  inputGallinas:  document.getElementById("hens"),
  textoCiudad:    document.getElementById("place"),
  mensajeEstado:  document.getElementById("status"),
  // Panel 2: pronóstico
  pronostico:     document.getElementById("forecast"),
  // Panel 3: registro
  formRegistro:   document.getElementById("logForm"),
  inputFecha:     document.getElementById("logDate"),
  inputCantidad:  document.getElementById("logCount"),
  statTotal:      document.getElementById("statTotal"),
  statPromedio:   document.getElementById("statAvg"),
  grafica:        document.getElementById("chart"),
  listaRegistros: document.getElementById("logList"),
};


/* ==========================================================================
   4. DATOS GUARDADOS — localStorage (se conservan al cerrar la página)
   ========================================================================== */
function leerGuardado(clave, valorPorDefecto) {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? valorPorDefecto;
  } catch {
    return valorPorDefecto;   // si el dato está dañado, usamos el valor inicial
  }
}

function guardar(clave, valor) {
  localStorage.setItem(clave, JSON.stringify(valor));
}

// Estado actual de la app (se llena al abrir la página)
let ciudad     = leerGuardado(CONFIG.claves.ciudad, CONFIG.ciudadInicial);  // {name, lat, lon}
let registroHuevos = leerGuardado(CONFIG.claves.huevos, {});                // { "2026-10-27": 5 }


/* ==========================================================================
   5. API — peticiones a Open-Meteo y manejo de errores
   ========================================================================== */

/* Hace UNA petición y devuelve el JSON. Todas las llamadas a internet pasan por aquí,
   así los errores (sin conexión, tiempo agotado, límite 429…) se tratan en un solo lugar. */
async function pedirJson(url) {
  if (!navigator.onLine) throw new Error(TEXTOS.sinInternet);

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), CONFIG.tiempoMaximoMs);

  try {
    const respuesta = await fetch(url, { signal: controlador.signal });
    if (respuesta.status === 429) throw new Error(TEXTOS.limitePeticiones);
    if (!respuesta.ok) throw new Error(TEXTOS.errorServicio(respuesta.status));
    return await respuesta.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(TEXTOS.tiempoAgotado);
    if (error instanceof TypeError)  throw new Error(TEXTOS.noSePudoConectar);
    throw error;                      // errores que ya tienen mensaje propio
  } finally {
    clearTimeout(temporizador);       // siempre se limpia el temporizador
  }
}

/* Convierte el nombre de una ciudad en {name, lat, lon} */
async function buscarCiudad(busqueda) {
  const url = `${CONFIG.urlBuscarCiudad}?name=${encodeURIComponent(busqueda)}&count=1&language=es`;
  const datos = await pedirJson(url);

  if (!datos.results || datos.results.length === 0) {
    throw new Error(TEXTOS.ciudadNoEncontrada(busqueda));
  }
  const r = datos.results[0];
  return {
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat:  r.latitude,
    lon:  r.longitude,
  };
}

/* Pide el pronóstico diario: temperatura máx/mín y duración de la luz del día */
async function pedirPronostico(lat, lon) {
  const parametros = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    forecast_days: CONFIG.diasPronostico,
    daily: "temperature_2m_max,temperature_2m_min,daylight_duration",
  });
  const datos = await pedirJson(`${CONFIG.urlPronostico}?${parametros}`);

  if (!datos.daily || !datos.daily.time || datos.daily.time.length === 0) {
    throw new Error(TEXTOS.pronosticoVacio);
  }
  return datos.daily;
}


/* ==========================================================================
   6. CÁLCULOS — nivel de calor, luz y huevos estimados
   ========================================================================== */

/* Según la temperatura máxima devuelve: tipo de clima, color de tarjeta y factor.
   "tipo" también es la llave para buscar el texto en TEXTOS.clima */
function evaluarClima(tempMax) {
  const t = CONFIG.temperatura;
  if (tempMax >= t.extremo) return { tipo: "extremo", clase: "peligro", factor: CONFIG.factorClima.extremo };
  if (tempMax >= t.calor)   return { tipo: "calor",   clase: "alerta",  factor: CONFIG.factorClima.calor };
  if (tempMax <= t.frio)    return { tipo: "frio",    clase: "frio",    factor: CONFIG.factorClima.frio };
  return                           { tipo: "normal",  clase: "",        factor: CONFIG.factorClima.normal };
}

/* Factor por horas de luz: 1 si hay suficiente; si no, baja poco a poco hasta el mínimo */
function factorLuz(horasLuz) {
  const { horasIdeales, horasMinimas, factorMinimo } = CONFIG.luz;
  if (horasLuz >= horasIdeales) return 1;
  const avance = (horasLuz - horasMinimas) / (horasIdeales - horasMinimas);  // 0 a 1
  return Math.max(factorMinimo, factorMinimo + (1 - factorMinimo) * avance);
}

/* Huevos estimados = gallinas × huevos por gallina × factor de clima × factor de luz */
function estimarHuevos(gallinas, factorDelClima, horasLuz) {
  return gallinas * CONFIG.huevosPorGallinaAlDia * factorDelClima * factorLuz(horasLuz);
}

/* Horas de luz artificial que faltan para llegar a las ideales (0 si no faltan) */
function luzArtificialNecesaria(horasLuz) {
  const falta = CONFIG.luz.horasIdeales - horasLuz;
  return falta > 0 ? Math.ceil(falta * 10) / 10 : 0;
}


/* ==========================================================================
   7. PANTALLA: PRONÓSTICO — dibuja las tarjetas de los 7 días
   ========================================================================== */

/* Muestra un mensaje en el recuadro de estado. tipo: "" | "cargando" | "error" */
function mostrarEstado(mensaje, tipo = "") {
  el.mensajeEstado.textContent = mensaje;
  el.mensajeEstado.className = "estado " + tipo;   // clases definidas en style.css, sección 6
}

/* Formatea una fecha "2026-10-27" en español. opciones: ver toLocaleDateString */
function formatearFecha(fechaTexto, opciones) {
  return new Date(fechaTexto + "T00:00:00").toLocaleDateString("es-MX", opciones);
}

/* Crea un elemento (div, p, b…) con texto y lo agrega dentro de "padre" */
function agregarTexto(padre, etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = texto;       // textContent evita insertar HTML peligroso
  if (clase) nodo.className = clase;
  padre.appendChild(nodo);
}

/* Construye la tarjeta de UN día. Para cambiar su contenido, edita las líneas agregarTexto */
function crearTarjetaDia(fecha, tempMax, tempMin, horasLuz, gallinas) {
  const clima  = evaluarClima(tempMax);
  const textos = TEXTOS.clima[clima.tipo];
  const huevos = estimarHuevos(gallinas, clima.factor, horasLuz);
  const luzExtra = luzArtificialNecesaria(horasLuz);

  const tarjeta = document.createElement("article");
  tarjeta.className = "dia " + clima.clase;      // el color de la franja viene de style.css, sección 7

  agregarTexto(tarjeta, "b",   formatearFecha(fecha, { weekday: "short", day: "numeric" }));
  agregarTexto(tarjeta, "div", `${Math.round(tempMax)}° / ${Math.round(tempMin)}°`, "temp");
  agregarTexto(tarjeta, "div", textos.etiqueta, "nivel");
  agregarTexto(tarjeta, "div", TEXTOS.horasDeLuz(horasLuz.toFixed(1)));
  agregarTexto(tarjeta, "div", TEXTOS.huevosEstimados(huevos.toFixed(1)), "huevos");
  agregarTexto(tarjeta, "p",   luzExtra > 0 ? `${TEXTOS.agregarLuz(luzExtra)} ${textos.consejo}` : textos.consejo);

  return { tarjeta, huevos };
}

/* Dibuja los 7 días y actualiza el número del huevo (el del primer día = hoy) */
function dibujarPronostico(diario, gallinas) {
  el.pronostico.replaceChildren();               // borra las tarjetas anteriores

  diario.time.forEach((fecha, i) => {
    const horasLuz = diario.daylight_duration[i] / 3600;   // la API da segundos
    const { tarjeta, huevos } = crearTarjetaDia(
      fecha, diario.temperature_2m_max[i], diario.temperature_2m_min[i], horasLuz, gallinas
    );
    el.pronostico.appendChild(tarjeta);
    if (i === 0) el.huevosHoy.textContent = Math.round(huevos);
  });
}

/* Pide el pronóstico de la ciudad actual y lo muestra (o muestra el error) */
async function actualizarPronostico() {
  const gallinas = Number(el.inputGallinas.value) || 1;
  el.textoCiudad.textContent = ciudad.name;
  mostrarEstado(TEXTOS.consultando, "cargando");

  try {
    const diario = await pedirPronostico(ciudad.lat, ciudad.lon);
    dibujarPronostico(diario, gallinas);
    mostrarEstado("");
  } catch (error) {
    el.pronostico.replaceChildren();
    el.huevosHoy.textContent = "–";
    mostrarEstado(error.message, "error");
  }
}


/* ==========================================================================
   8. PANTALLA: REGISTRO DE HUEVOS — estadísticas, gráfica y lista
   ========================================================================== */

/* Fecha de hoy en formato AAAA-MM-DD (hora local) */
function hoy() {
  return new Date().toLocaleDateString("en-CA");
}

/* Lista de las últimas n fechas (la última es hoy) */
function ultimasFechas(n) {
  const fechas = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    fechas.push(d.toLocaleDateString("en-CA"));
  }
  return fechas;
}

/* --- Estadísticas: total y promedio de los últimos 7 días --- */
function dibujarEstadisticas() {
  const total = Object.values(registroHuevos).reduce((suma, n) => suma + n, 0);
  const semana = ultimasFechas(7);
  const sumaSemana = semana.reduce((suma, fecha) => suma + (registroHuevos[fecha] || 0), 0);

  el.statTotal.textContent = total;
  el.statPromedio.textContent = (sumaSemana / 7).toFixed(1);
}

/* --- Gráfica de barras --- */
function dibujarGrafica() {
  const fechas = ultimasFechas(CONFIG.diasGrafica);
  const maximo = Math.max(1, ...fechas.map((f) => registroHuevos[f] || 0));
  el.grafica.replaceChildren();

  fechas.forEach((fecha) => {
    const cantidad = registroHuevos[fecha] || 0;

    const columna = document.createElement("div");
    columna.className = "barra";

    const numero = document.createElement("span");    // número arriba de la barra
    numero.textContent = cantidad;

    const barra = document.createElement("i");        // la barra amarilla
    barra.style.height = (cantidad / maximo) * CONFIG.graficaAlturaMaximaPorcentaje + "%";

    const dia = document.createElement("span");       // inicial del día (L, M, M…)
    dia.textContent = formatearFecha(fecha, { weekday: "narrow" });

    columna.append(numero, barra, dia);
    el.grafica.appendChild(columna);
  });
}

/* --- Lista de registros (el más reciente primero) --- */
function dibujarLista() {
  const fechas = Object.keys(registroHuevos).sort().reverse();
  el.listaRegistros.replaceChildren();

  if (fechas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "texto-suave";
    vacio.textContent = TEXTOS.sinRegistros;
    el.listaRegistros.appendChild(vacio);
    return;
  }

  fechas.forEach((fecha) => {
    const fila = document.createElement("li");

    const texto = document.createElement("span");
    const fechaBonita = formatearFecha(fecha, { day: "numeric", month: "long", year: "numeric" });
    texto.textContent = TEXTOS.registroDelDia(fechaBonita, registroHuevos[fecha]);

    const botonEliminar = document.createElement("button");
    botonEliminar.className = "enlace";
    botonEliminar.textContent = TEXTOS.botonEliminar;
    botonEliminar.addEventListener("click", () => eliminarRegistro(fecha));

    fila.append(texto, botonEliminar);
    el.listaRegistros.appendChild(fila);
  });
}

/* Redibuja las tres partes del registro */
function dibujarRegistro() {
  dibujarEstadisticas();
  dibujarGrafica();
  dibujarLista();
}

function guardarRegistro(fecha, cantidad) {
  registroHuevos[fecha] = cantidad;   // un registro por día: guardar de nuevo lo reemplaza
  guardar(CONFIG.claves.huevos, registroHuevos);
  dibujarRegistro();
}

function eliminarRegistro(fecha) {
  delete registroHuevos[fecha];
  guardar(CONFIG.claves.huevos, registroHuevos);
  dibujarRegistro();
}


/* ==========================================================================
   9. EVENTOS — qué pasa cuando el usuario usa la página
   ========================================================================== */

/* Botón "Consultar pronóstico" */
el.formConfig.addEventListener("submit", async (evento) => {
  evento.preventDefault();                     // evita que la página se recargue
  const busqueda = el.inputCiudad.value.trim();
  guardar(CONFIG.claves.gallinas, el.inputGallinas.value);

  if (busqueda) {
    mostrarEstado(TEXTOS.buscandoCiudad, "cargando");
    try {
      ciudad = await buscarCiudad(busqueda);
      guardar(CONFIG.claves.ciudad, ciudad);
    } catch (error) {
      mostrarEstado(error.message, "error");
      return;                                  // si falla la búsqueda, no seguimos
    }
  }
  actualizarPronostico();
});

/* Botón "Guardar registro" */
el.formRegistro.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const fecha = el.inputFecha.value;
  const cantidad = parseInt(el.inputCantidad.value, 10);
  if (!fecha || Number.isNaN(cantidad) || cantidad < 0) return;

  guardarRegistro(fecha, cantidad);
  el.inputCantidad.value = "";
});

/* Cambios en la conexión a internet */
window.addEventListener("offline", () => mostrarEstado(TEXTOS.conexionPerdida, "error"));
window.addEventListener("online", actualizarPronostico);


/* ==========================================================================
   10. INICIO — se ejecuta una vez al abrir la página
   ========================================================================== */
el.inputCiudad.value   = ciudad.name.split(",")[0];                       // solo el nombre corto
el.inputGallinas.value = leerGuardado(CONFIG.claves.gallinas, CONFIG.gallinasIniciales);
el.inputFecha.value    = hoy();
dibujarRegistro();
actualizarPronostico();

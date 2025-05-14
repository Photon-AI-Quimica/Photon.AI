const contenedor = document.querySelector(".contenedor");
const contenedor_chat = document.querySelector(".contenedor-chat");
const caja_texto = document.querySelector(".caja-texto");
const entrada_texto = caja_texto.querySelector(".entrada-texto");
const entrada_archivo = caja_texto.querySelector("#tipo-archivo-carga");
const carga_archivos = caja_texto.querySelector(".carga-archivos");
const alternar_fondo = document.querySelector("#boton-alternar-tema-fondo");
// Configuracion del API de GEMINI (modelo 2.0 Flash)
const API_KEY = "AIzaSyDmc0aqaMboLEKQR7wOEQPN8Qs7eA18iLM";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
let controlador, typingInterval;
const historial_chat = [];
const datos_usuario = { mensaje: "", file: {} };

// Prompt inicial personalizado
const mensaje_inicial = "Estoy diseñado para ayudarte a aprender y entender pensando activamente. No te daré respuestas directas sin que antes intentes resolver por ti mismo. Mi función es guiarte con preguntas que estimulen tu razonamiento y adaptar mis explicaciones según tu progreso. Estoy aquí para acompañarte en tu esfuerzo por comprender, no para reemplazarlo.";

// Función para añadir el mensaje inicial al historial y mostrarlo en la interfaz
const incluir_mensaje_inicial = () => {
  historial_chat.push({
    role: "model",
    parts: [{ text: mensaje_inicial }],
  });
};

// Llama a la función para añadir el prompt inicial cuando se carga la página
window.onload = incluir_mensaje_inicial;

// Funcion para crear los elementos de los mensajes personalizados
const crearElementoMensaje = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("mensaje", ...classes);
  div.innerHTML = content;
  return div;
};

// Desplazar automaticamente la pantalla al fondo al generar respuestas
const desplazarHastaAbajo = () => contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: "smooth" });

// Animacion de "escribir texto" mientras el bot responde
const efectoEscritura = (text, elementoTexto, divMensajesBot) => {
  elementoTexto.textContent = "";
  const palabras = text.split(" ");
  let wordIndex = 0;
  //Complementa lo anterior
  // Muestra las palabras con un tiempo de retraso constante
  typingInterval = setInterval(() => {
    if (wordIndex < palabras.length) {
      elementoTexto.textContent += (wordIndex === 0 ? "" : " ") + palabras[wordIndex++];
      desplazarHastaAbajo();
    } else {
      clearInterval(typingInterval);
      divMensajesBot.classList.remove("cargando");
      document.body.classList.remove("bot-respondiendo");
    }
  }, 40); // 40 ms de retraso
};

// Llama al API para generar una respuesta del bot
const generarRespuesta = async (divMensajesBot) => {
  const elementoTexto = divMensajesBot.querySelector(".mensaje-texto");
  controlador = new AbortController();
// Añade el mensaje del usuario + archivos adjuntos (si los hay) al historial del chat
  historial_chat.push({
    role: "user",
    parts: [{ text: datos_usuario.mensaje }, ...(datos_usuario.file.data ? [{ inline_data: (({ fileName, Imagen, ...rest }) => rest)(datos_usuario.file) }] : [])],
  });
// Envia el historial del chat al API para obtener la respuesta del bot
  try {
    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: historial_chat }),
      signal: controlador.signal,
    });
    const data = await respuesta.json();
    if (!respuesta.ok) throw new Error(data.error.mensaje);
// Procesar la respuesta recibida del API y mostrar el texto con efecto de "escribiendo"
    const textoRespuesta = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    efectoEscritura(textoRespuesta, elementoTexto, divMensajesBot);
    historial_chat.push({ role: "model", parts: [{ text: textoRespuesta }] });
  } catch (error) {
    elementoTexto.textContent = error.name === "AbortError" ? "¡Respuesta detenida! ¿Tienes otra pregunta o hay algo más sobre química que te gustaría explorar? Estoy aquí para ayudarte. ¡No dudes en preguntar! 😊" : error.mensaje;
    elementoTexto.style.color = "#d62939";
    divMensajesBot.classList.remove("cargando");
    document.body.classList.remove("bot-respondiendo");
    desplazarHastaAbajo();
  } finally {
    datos_usuario.file = {};
  }
};

// Gestionar el envio de mensajes (evita enviar mensajes vacios o doble mensaje al bot)
const procesarEnvioFormulario = (e) => {
  e.preventDefault();
  const mensajeUsuario = entrada_texto.value.trim();
  if (!mensajeUsuario || document.body.classList.contains("bot-respondiendo")) return;
  datos_usuario.mensaje = mensajeUsuario;
  entrada_texto.value = "";
  document.body.classList.add("chat-activo", "bot-respondiendo");
  carga_archivos.classList.remove("archivo-anexado", "imagen-anexada", "active");
  // Generar el HTML para un mensaje del usuario (incluyendo el archivo adjunto si aplica)
  const mensajeUsuarioHTML = `
    <p class="mensaje-texto"></p>
    ${datos_usuario.file.data ? (datos_usuario.file.Imagen ? `<img src="data:${datos_usuario.file.mime_type};base64,${datos_usuario.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${datos_usuario.file.fileName}</p>`) : ""}
  `;
  const divMensajeUsuario = crearElementoMensaje(mensajeUsuarioHTML, "mensaje-del-usuario");
  divMensajeUsuario.querySelector(".mensaje-texto").textContent = datos_usuario.mensaje;
  contenedor_chat.appendChild(divMensajeUsuario);
  desplazarHastaAbajo();   // Desplaza hacia abajo para mostrar el nuevo mensaje
// Añadir una breve pausa antes que el bot genere un mensaje inicial
  setTimeout(() => {
    const mensaje_bot = `<img class="icono-chatbot" src="icono.svg" /> <p class="mensaje-texto">Espere un momento...</p>`;
    const divMensajesBot = crearElementoMensaje(mensaje_bot, "mensaje-del-chatbot", "cargando");
    contenedor_chat.appendChild(divMensajesBot);
    desplazarHastaAbajo();
    generarRespuesta(divMensajesBot);
  }, 600); // 600 ms de retraso
};

// Gestionar la carga de archivos 
entrada_archivo.addEventListener("change", () => {
  const file = entrada_archivo.files[0];
  if (!file) return;
  const Imagen = file.type.startsWith("image/");
  const lector = new FileReader();
  lector.readAsDataURL(file);
  lector.onload = (e) => {
    entrada_archivo.value = "";
    const cadenaBase64 = e.target.result.split(",")[1];
    carga_archivos.querySelector(".vista-previa-archivo").src = e.target.result;
    carga_archivos.classList.add("active", Imagen ? "imagen-anexada" : "archivo-anexado");
// Almacenar los datos del archivo seleecionado
    datos_usuario.file = { fileName: file.name, data: cadenaBase64, mime_type: file.type, Imagen };
  };
});

// Cancelar la carga de archivos
document.querySelector("#boton-cancelar-carga-archivo").addEventListener("click", () => {
  datos_usuario.file = {};
  carga_archivos.classList.remove("archivo-anexado", "imagen-anexada", "active");
});

// Detener la respuesta del bot
document.querySelector("#boton-detener-respuesta").addEventListener("click", () => {
  controlador?.abort();
  datos_usuario.file = {};
  clearInterval(typingInterval);
  contenedor_chat.querySelector(".mensaje-del-chatbot.cargando").classList.remove("cargando");
  document.body.classList.remove("bot-respondiendo");
});

// Alternar tema claro/oscuro
alternar_fondo.addEventListener("click", () => {
  const temaClaro = document.body.classList.toggle("tema-claro");
  localStorage.setItem("themeColor", temaClaro ? "light_mode" : "dark_mode");
  alternar_fondo.textContent = temaClaro ? "dark_mode" : "light_mode";
});

// Funcion borrar chat
document.querySelector("#boton-borrar-chat").addEventListener("click", () => {
  historial_chat.length = 0;
  contenedor_chat.innerHTML = "";
  document.body.classList.remove("chat-activo", "bot-respondiendo");
});

// Hacer clic en 1 recomendacion => enviarla automaticamente como mensaje
//SE PUEDE ELIMINAR LA FUNCION BORRANDO SOLO ESTA SECCION DE CODIGO
document.querySelectorAll(".caja-recomendaciones").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    entrada_texto.value = suggestion.querySelector(".text").textContent;
    caja_texto.dispatchEvent(new Event("submit"));
  });
});

// Mostrar / Ocultar visibilidad de los controles en un chat para dispositivos moviles, cuando el usuario interactua con botones especificos
document.addEventListener("click", ({ target }) => {
  const envoltorio = document.querySelector(".seccion-interactiva");
  const ocultar = target.classList.contains("entrada-texto") || (envoltorio.classList.contains("hide-controls") && (target.id === "boton-anexar-archivo" || target.id === "boton-detener-respuesta"));
  envoltorio.classList.toggle("hide-controls", ocultar);
});

caja_texto.addEventListener("submit", procesarEnvioFormulario);
caja_texto.querySelector("#boton-anexar-archivo").addEventListener("click", () => entrada_archivo.click());
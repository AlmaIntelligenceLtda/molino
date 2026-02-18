// /lib/ably.js
import Ably from "ably";


let ablyRest = null;

/**
 * Inicializa el cliente REST de Ably (solo se usa en backend).
 */
function initAblyRest() {
  const rawKey = process.env.ABLY_API_KEY;
  const ABLY_API_KEY = typeof rawKey === "string" ? rawKey.trim() : "";

  if (!ABLY_API_KEY) {
    console.warn("[/lib/ably] ⚠️ ABLY_API_KEY no configurada. No se puede inicializar Ably REST.");
    return null;
  }

  if (!ABLY_API_KEY.includes(".") || !ABLY_API_KEY.includes(":")) {
    console.warn("[/lib/ably] ⚠️ Formato inesperado de ABLY_API_KEY (esperado appId.keyId:secret).");
  }

  try {
    const rest = new Ably.Rest({ key: ABLY_API_KEY });
    console.log("[/lib/ably] ✅ Cliente REST inicializado correctamente.");
    return rest;
  } catch (err) {
    console.error("[/lib/ably] ❌ Error inicializando Ably REST:", err?.message || err);
    return null;
  }
}

/**
 * Devuelve la instancia REST (inicializándola si no existe).
 */
export function getAblyRest() {
  if (!ablyRest) ablyRest = initAblyRest();
  return ablyRest;
}

/**
 * Genera un TokenRequest válido para el cliente.
 * @param {string} clientId - Identificador único (ej: "user-23")
 * @param {number} ttlMs - Tiempo de vida del token (default: 30 minutos)
 */
export async function createTokenRequest(clientId = null, ttlMs = 1000 * 60 * 30) {
  const rest = getAblyRest();
  if (!rest) throw new Error("Ably REST client no inicializado o falta ABLY_API_KEY");

  try {
    const params = { ttl: ttlMs };
    if (clientId) params.clientId = clientId;

    const tokenRequest = await rest.auth.createTokenRequest(params);
    console.log(`[createTokenRequest] ✅ TokenRequest generado para ${clientId || "anónimo"}`);
    return tokenRequest;
  } catch (err) {
    console.error(
      "[createTokenRequest] ❌ Error generando TokenRequest:",
      err?.message || err,
      "code:",
      err?.code,
      "status:",
      err?.statusCode
    );
    throw err;
  }
}

/**
 * Publica un mensaje en un canal de Ably (opcional, útil para backend que emite eventos).
 */
export async function publishToChannel(channelName, event, payload) {
  const rest = getAblyRest();
  if (!rest) throw new Error("Ably REST client no inicializado.");
  try {
    await rest.channels.get(channelName).publish(event, payload);
    console.log(`[publishToChannel] ✅ Mensaje publicado en ${channelName} (${event})`);
  } catch (err) {
    console.error(`[publishToChannel] ❌ Error publicando en ${channelName}:`, err?.message || err);
    throw err;
  }
}

/**
 * Compatibilidad: exporta `initAbly` que inicializa el cliente REST.
 * `backend/index.js` llama a `initAbly()` al arrancar.
 */
export function initAbly() {
  // Inicializa (si es posible) el cliente REST y retorna la instancia o null.
  return getAblyRest();
}

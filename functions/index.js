/**
 * Burger House · Conversions API (Meta) — Firebase Cloud Function
 * Endpoint: /api/meta-capi
 *
 * Recibe el payload del navegador (bhTrackPurchase) y lo reenvía a Meta
 * con el MISMO event_id que usó el Píxel → Meta deduplica y cuenta 1 compra.
 *
 * Variables de entorno requeridas (Firebase Functions config):
 *   META_CAPI_TOKEN  →  Events Manager › dataset › Configuración › Conversions API › Generar token
 *
 * Para configurar localmente:
 *   firebase functions:config:set meta.capi_token="EAAG..."
 * Para leer en el código:
 *   process.env.META_CAPI_TOKEN  (Firebase lo inyecta automáticamente en producción)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const crypto = require('crypto');

const metaCapiToken = defineSecret('META_CAPI_TOKEN');

const PIXEL_ID     = '1762934141516291';
const GRAPH_VER    = 'v23.0';
const CAPI_URL     = `https://graph.facebook.com/${GRAPH_VER}/${PIXEL_ID}/events`;

/** SHA-256 de un string limpio (si ya viene en SHA-256 de 64 hex, lo conserva); retorna undefined si el valor es falsy */
const isSha256 = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v.trim());
const sha256 = (v) => {
    if (!v) return undefined;
    const cleanStr = String(v).trim().toLowerCase();
    if (!cleanStr) return undefined;
    if (isSha256(cleanStr)) return cleanStr;
    return crypto.createHash('sha256').update(cleanStr).digest('hex');
};

/** Normaliza un correo electrónico: minúsculas y sin espacios */
const normEmail = (e) => {
    if (!e) return null;
    const s = String(e).trim().toLowerCase().replace(/\s+/g, '');
    if (isSha256(s)) return s;
    return s.includes('@') ? s : null;
};

/**
 * Normaliza un teléfono venezolano a solo dígitos con código 58 (sin 0 inicial): 58XXXXXXXXXX
 * Acepta: 04141234567 / 4141234567 / +584141234567 / +58 0414-1234567
 */
const normPhone = (p) => {
    if (!p) return null;
    const raw = String(p).trim();
    if (isSha256(raw)) return raw.toLowerCase();
    let d = raw.replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('580')) d = '58' + d.slice(3);
    else if (d.startsWith('0')) d = '58' + d.slice(1);
    else if (!d.startsWith('58')) d = '58' + d;
    return d.length >= 11 ? d : null;
};

/** Valida que fbc sea real (formato fb.1.<ts>.<fbclid>) y nunca vacío ni inventado */
const validFbc = (v) => {
    if (!v || typeof v !== 'string') return undefined;
    const s = v.trim();
    return /^fb\.\d+\.\d+\..+/.test(s) ? s : undefined;
};

/** Valida que fbp no sea vacío */
const validFbp = (v) => {
    if (!v || typeof v !== 'string') return undefined;
    const s = v.trim();
    return s.length > 0 ? s : undefined;
};

/** Extrae una cookie de la cabecera Cookie como respaldo */
const getHeaderCookie = (cookieHeader, name) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') return undefined;
    const m = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]).trim() : undefined;
};

/** Elimina claves undefined, null o vacías de un objeto (Meta rechaza campos vacíos) */
const clean = (obj) => {
    Object.keys(obj).forEach(k => (obj[k] === undefined || obj[k] === null || obj[k] === '') && delete obj[k]);
    return obj;
};

// Solo Purchase: AddToCart/InitiateCheckout ya llegan por servidor desde una integración externa de Meta.
const ALLOWED_EVENTS = new Set(['Purchase']);

exports.metaCapi = onRequest(
    { secrets: [metaCapiToken], cors: true },
    async (req, res) => {

        // Solo aceptar POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        try {
            const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

            // IP real del cliente (Firebase / proxies)
            const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                     || (req.headers['fastly-client-ip'] || '').trim()
                     || (req.headers['x-real-ip'] || '').trim()
                     || req.ip
                     || req.socket?.remoteAddress
                     || undefined;

            const cookieHeader = req.headers['cookie'] || '';
            const fbcVal = validFbc(b.fbc) || validFbc(getHeaderCookie(cookieHeader, '_fbc'));
            const fbpVal = validFbp(b.fbp) || validFbp(getHeaderCookie(cookieHeader, '_fbp'));

            const rawEm = b.user?.em || b.user?.email || null;
            const rawPh = b.user?.ph || b.user?.phone || b.user?.telefono || null;

            const userData = clean({
                client_ip_address : ip,
                client_user_agent : req.headers['user-agent'] || undefined,
                fbc               : fbcVal,                 // ← clave para atribución (nunca vacío ni inventado)
                fbp               : fbpVal,
                em                : sha256(normEmail(rawEm)),
                ph                : sha256(normPhone(rawPh)),
                fn                : sha256(b.user?.fn),
                ln                : sha256(b.user?.ln),
                ct                : sha256('merida'),
                country           : sha256('ve'),
            });

            const requestedEvent = String(b.event_name || 'Purchase').trim();
            if (!ALLOWED_EVENTS.has(requestedEvent)) {
                // Nunca reetiquetar otro evento como Purchase
                return res.status(400).json({ error: 'Evento no permitido: ' + requestedEvent });
            }
            const eventName = requestedEvent;

            const customData = Object.assign({}, b.custom_data || {});
            if (eventName === 'Purchase' || customData.value !== undefined) {
                customData.value = Math.round((Number(customData.value) || 0) * 100) / 100;
                customData.currency = customData.currency || 'USD';
            }

            const event = clean({
                event_name       : eventName,
                event_time       : Math.floor(Date.now() / 1000),
                event_id         : b.event_id ? String(b.event_id) : undefined, // ← mismo que eventID del Píxel
                action_source    : 'website',
                event_source_url : b.event_source_url || undefined,
                user_data        : userData,
                custom_data      : customData,              // value (Number) + currency ('USD')
            });

            const payload = { data: [event] };
            const testEventCode = (process.env.META_TEST_EVENT_CODE || '').trim();
            if (testEventCode) {
                payload.test_event_code = testEventCode;
            }

            const token = metaCapiToken.value();
            const response = await fetch(`${CAPI_URL}?access_token=${token}`, {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(payload),
            });

            const data = await response.json();
            console.log('[CAPI] Respuesta Meta:', JSON.stringify(data));

            return res.status(response.ok ? 200 : 502).json(data);

        } catch (err) {
            console.error('[CAPI] Error:', err);
            return res.status(500).json({ error: String(err) });
        }
    }
);

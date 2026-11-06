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

/** SHA-256 de un string limpio; retorna undefined si el valor es falsy */
const sha256 = (v) =>
    v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

/**
 * Normaliza un teléfono venezolano a formato E.164: 58XXXXXXXXXX
 * Acepta: 04141234567 / 4141234567 / +584141234567
 */
const normPhone = (p) => {
    if (!p) return null;
    let d = String(p).replace(/\D/g, '');
    if (d.startsWith('0'))  d = '58' + d.slice(1);
    if (!d.startsWith('58')) d = '58' + d;
    return d.length >= 10 ? d : null;
};

/** Elimina claves undefined de un objeto (Meta rechaza campos vacíos) */
const clean = (obj) => {
    Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);
    return obj;
};

exports.metaCapi = onRequest(
    { secrets: [metaCapiToken], cors: true },
    async (req, res) => {

        // Solo aceptar POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        try {
            const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

            // IP real del cliente (Firebase pone el proxy de Google en la cabecera)
            const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                     || req.socket?.remoteAddress
                     || null;

            const userData = clean({
                client_ip_address : ip,
                client_user_agent : req.headers['user-agent'] || undefined,
                fbc               : b.fbc  || undefined,   // ← clave para atribución
                fbp               : b.fbp  || undefined,
                fn                : sha256(b.user?.fn),
                ln                : sha256(b.user?.ln),
                ph                : sha256(normPhone(b.user?.ph)),
                ct                : sha256('merida'),
                country           : sha256('ve'),
            });

            const event = clean({
                event_name       : 'Purchase',
                event_time       : Math.floor(Date.now() / 1000),
                event_id         : b.event_id,              // ← mismo que eventID del Píxel
                action_source    : 'website',
                event_source_url : b.event_source_url || undefined,
                user_data        : userData,
                custom_data      : b.custom_data || {},     // value + currency obligatorios
            });

            const payload = { data: [event] };
            // Descomenta la siguiente línea para probar en Events Manager sin afectar datos reales:
            // payload.test_event_code = 'TEST00000';

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

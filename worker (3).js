/**
 * FuelCheck Vision Proxy — Cloudflare Worker
 * Usa Google Gemini 1.5 Flash (GRATUITO - 1500 req/giorno)
 *
 * ISTRUZIONI:
 * 1. Incolla questo codice nell'editor del Worker su Cloudflare
 * 2. Vai su Settings → Variables and Secrets:
 *    - RIMUOVI la vecchia OPENAI_API_KEY
 *    - Aggiungi nuovo Secret: Nome: GEMINI_API_KEY  Valore: la tua key da aistudio.google.com
 * 3. Clicca Deploy
 * 4. Testa aprendo: https://fuelcheck-vision.costafabio94fc.workers.dev/analyze
 */

export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // GET: verifica stato Worker
    if (request.method === 'GET') {
      const hasKey = !!env.GEMINI_API_KEY;
      return new Response(JSON.stringify({
        status: 'ok',
        hasKey,
        model: 'gemini-1.5-flash (gratuito)',
        message: hasKey ? '✅ Worker pronto!' : '❌ GEMINI_API_KEY mancante — aggiungila in Settings → Variables and Secrets'
      }), {
        status: 200,
        headers: {...corsHeaders, 'Content-Type': 'application/json'}
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: corsHeaders});
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({error: 'Metodo non consentito'}), {
        status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'}
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: 'GEMINI_API_KEY non configurata. Vai su Settings → Variables and Secrets.'
      }), {
        status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'}
      });
    }

    try {
      const {image, mime} = await request.json();
      if (!image) throw new Error('Immagine mancante nel body');

      const mediaType = mime || 'image/jpeg';

      // Chiama Gemini 1.5 Flash
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inline_data: {
                    mime_type: mediaType,
                    data: image
                  }
                },
                {
                  text: 'Questa è una foto del display di un distributore di carburante. Estrai i valori numerici visibili: litri erogati e importo totale in euro. Rispondi SOLO con JSON senza markdown, esempio: {"litri": 12.13, "euro": 20.00}. Se un valore non è leggibile metti null.'
                }
              ]
            }],
            generationConfig: {
              maxOutputTokens: 128,
              temperature: 0
            }
          })
        }
      );

      const geminiData = await geminiResp.json();

      if (geminiData.error) {
        throw new Error(`Gemini: ${geminiData.error.message}`);
      }

      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return new Response(JSON.stringify({text}), {
        status: 200,
        headers: {...corsHeaders, 'Content-Type': 'application/json'}
      });

    } catch (err) {
      return new Response(JSON.stringify({error: err.message}), {
        status: 500,
        headers: {...corsHeaders, 'Content-Type': 'application/json'}
      });
    }
  }
};

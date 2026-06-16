export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'GET') {
      const hasKey = !!env.GEMINI_API_KEY;
      return new Response(JSON.stringify({
        status: 'ok',
        hasKey,
        model: 'gemini-1.5-flash (gratuito)',
        message: hasKey ? '✅ Worker pronto!' : '❌ GEMINI_API_KEY mancante'
      }), {status: 200, headers: {...corsHeaders, 'Content-Type': 'application/json'}});
    }

    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: corsHeaders});
    if (request.method !== 'POST') return new Response(JSON.stringify({error: 'Method not allowed'}), {status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'}});
    if (!env.GEMINI_API_KEY) return new Response(JSON.stringify({error: 'GEMINI_API_KEY mancante'}), {status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'}});

    try {
      const body = await request.json();
      const image = body.image;
      const mime  = body.mime || 'image/jpeg';

      if (!image) throw new Error('Immagine mancante nel body');

      // Tronca l'immagine se troppo grande (Gemini free ha limite 4MB)
      const maxLen = 3 * 1024 * 1024; // ~3MB in base64
      const imageData = image.length > maxLen ? image.substring(0, maxLen) : image;

      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{
              parts: [
                {inline_data: {mime_type: mime, data: imageData}},
                {text: 'Questa è una foto del display di un distributore di carburante. Estrai i valori numerici visibili: litri erogati e importo totale in euro. Rispondi SOLO con JSON senza markdown, esempio: {"litri": 12.13, "euro": 20.00}. Se un valore non è leggibile metti null.'}
              ]
            }],
            generationConfig: {maxOutputTokens: 128, temperature: 0}
          })
        }
      );

      // Log risposta completa per debug
      const geminiText = await geminiResp.text();
      let geminiData;
      try { geminiData = JSON.parse(geminiText); }
      catch(e) { throw new Error(`Gemini risposta non JSON: ${geminiText.substring(0,200)}`); }

      if (geminiData.error) {
        throw new Error(`Gemini errore ${geminiData.error.code}: ${geminiData.error.message}`);
      }

      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (!text) throw new Error(`Nessun testo da Gemini. Risposta: ${JSON.stringify(geminiData).substring(0,300)}`);

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

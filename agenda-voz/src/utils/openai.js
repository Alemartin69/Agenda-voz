export async function calcularCaloriasGPT(ingredientes, apiKey) {
  if (!apiKey) throw new Error('API Key de ChatGPT no configurada. Andá a ⚙️ Configuración.');
  if (!ingredientes?.trim()) throw new Error('Ingresá los ingredientes primero.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Sos un nutricionista experto. Cuando el usuario te describe ingredientes de una comida, respondés ÚNICAMENTE con un número entero que representa las calorías totales aproximadas. Sin texto, sin explicaciones, sin unidades. Solo el número.',
        },
        {
          role: 'user',
          content: `Ingredientes de la comida: ${ingredientes}`,
        },
      ],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const texto = data.choices?.[0]?.message?.content?.trim() || '';
  const numero = texto.replace(/[^\d]/g, '');
  if (!numero) throw new Error('No se pudo calcular. Revisá los ingredientes.');
  return parseInt(numero);
}

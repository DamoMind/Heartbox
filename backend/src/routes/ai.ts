/**
 * AI routes - Barcode lookup and image recognition
 */

import { Env, ProductInfo, AIRecognitionResult } from '../types';
import { json, error } from '../utils/response';

// Category mapping from product categories to our app categories
const CATEGORY_MAP: Record<string, string> = {
  // Food related
  'baby foods': 'formula',
  'baby formula': 'formula',
  'infant formula': 'formula',
  'baby food': 'formula',
  'beverages': 'food',
  'snacks': 'food',
  'cereals': 'food',
  'dairy': 'food',
  'fruits': 'food',
  'vegetables': 'food',
  'canned': 'food',
  'food': 'food',
  // Hygiene
  'personal care': 'hygiene',
  'hygiene': 'hygiene',
  'toiletries': 'hygiene',
  'soap': 'hygiene',
  'shampoo': 'hygiene',
  'toothpaste': 'hygiene',
  // Diapers
  'diapers': 'diapers',
  'nappies': 'diapers',
  'baby diapers': 'diapers',
  'diaper': 'diapers',
  // Clothing
  'clothing': 'clothing',
  'apparel': 'clothing',
  'clothes': 'clothing',
  // Toys
  'toys': 'toys',
  'games': 'toys',
  'toy': 'toys',
  // Books
  'books': 'books',
  'book': 'books',
  'reading': 'books',
  // School
  'stationery': 'school',
  'school supplies': 'school',
  'office supplies': 'school',
  // Medical
  'health': 'medical',
  'medical': 'medical',
  'medicine': 'medical',
  'first aid': 'medical',
};

export function mapToAppCategory(productCategory: string): string {
  const lower = productCategory.toLowerCase();

  // Direct match
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }

  // Partial match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  return 'other';
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Get current AI usage for today
async function getAIUsageToday(env: Env): Promise<number> {
  const today = getTodayDate();
  const result = await env.DB.prepare(`
    SELECT SUM(request_count) as total FROM ai_usage WHERE date = ?
  `).bind(today).first();
  return (result?.total as number) || 0;
}

// Increment AI usage counter
async function incrementAIUsage(env: Env, provider: 'cloudflare' | 'azure', endpoint: string): Promise<void> {
  const today = getTodayDate();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO ai_usage (date, provider, endpoint, request_count, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(date, provider, endpoint) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = ?
  `).bind(today, provider, endpoint, now, now, now).run();
}

// Check if we should use Azure fallback
async function shouldUseAzureFallback(env: Env): Promise<boolean> {
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const used = await getAIUsageToday(env);
  // Use Azure when Cloudflare usage exceeds 80% of daily limit
  return used >= limit * 0.8;
}

// Check if daily limit is exhausted
async function isQuotaExhausted(env: Env): Promise<boolean> {
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const used = await getAIUsageToday(env);
  return used >= limit;
}

// Call Edge AI Gateway (Azure fallback)
async function callEdgeAIGateway(
  env: Env,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  maxTokens: number = 100
): Promise<string | null> {
  if (!env.EDGE_AI_GATEWAY_URL) {
    console.error('EDGE_AI_GATEWAY_URL not configured');
    return null;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.EDGE_AI_GATEWAY_KEY) {
      headers['Authorization'] = `Bearer ${env.EDGE_AI_GATEWAY_KEY}`;
    }

    const response = await fetch(env.EDGE_AI_GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Edge AI Gateway error:', await response.text());
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('Edge AI Gateway call failed:', err);
    return null;
  }
}

// Generate unique barcode (format: KC + timestamp + random)
function generateBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KC${timestamp}${random}`;
}

// AI Quota status endpoint
export async function getAIQuotaStatus(env: Env): Promise<Response> {
  const today = getTodayDate();
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const warningThreshold = parseInt(env.AI_WARNING_THRESHOLD || '100');

  // Get usage breakdown by provider
  const usageResult = await env.DB.prepare(`
    SELECT provider, SUM(request_count) as count
    FROM ai_usage
    WHERE date = ?
    GROUP BY provider
  `).bind(today).all();

  let cloudflareUsed = 0;
  let azureUsed = 0;

  usageResult.results?.forEach((row: Record<string, unknown>) => {
    if (row.provider === 'cloudflare') cloudflareUsed = row.count as number;
    if (row.provider === 'azure') azureUsed = row.count as number;
  });

  const totalUsed = cloudflareUsed + azureUsed;
  const remaining = Math.max(0, limit - totalUsed);
  const currentProvider = cloudflareUsed < limit * 0.8 ? 'cloudflare' : 'azure';

  return json({
    date: today,
    used: totalUsed,
    limit,
    remaining,
    warningThreshold,
    isWarning: remaining <= warningThreshold && remaining > 0,
    isExhausted: remaining === 0,
    provider: currentProvider,
    breakdown: {
      cloudflare: cloudflareUsed,
      azure: azureUsed,
    },
  });
}

// Barcode lookup handler
export async function lookupBarcode(barcode: string, env: Env): Promise<Response> {
  const timeout = 3000;

  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
    ]);

  // Start all lookups simultaneously
  const [offResult, upcResult] = await Promise.all([
    // Open Food Facts lookup
    withTimeout(
      (async (): Promise<ProductInfo | null> => {
        try {
          const response = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
            { headers: { 'User-Agent': 'DonationInventoryApp/1.0' } }
          );
          if (!response.ok) return null;

          const data = await response.json() as {
            status: number;
            product?: {
              product_name?: string;
              product_name_en?: string;
              categories_tags?: string[];
              image_url?: string;
            };
          };

          if (data.status === 1 && data.product) {
            const product = data.product;
            const name = product.product_name_en || product.product_name || '';
            if (!name) return null;

            let category = 'food';
            for (const cat of product.categories_tags || []) {
              const cleanCat = cat.replace('en:', '').replace(/-/g, ' ');
              const mapped = mapToAppCategory(cleanCat);
              if (mapped !== 'other') {
                category = mapped;
                break;
              }
            }

            return {
              name,
              category,
              unit: 'pieces',
              source: 'openfoodfacts',
              confidence: 0.9,
              imageUrl: product.image_url,
            };
          }
          return null;
        } catch {
          return null;
        }
      })(),
      timeout
    ),

    // UPCitemdb lookup
    withTimeout(
      (async (): Promise<ProductInfo | null> => {
        try {
          const response = await fetch(
            `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (!response.ok) return null;

          const data = await response.json() as {
            code: string;
            items?: Array<{ title?: string; category?: string; images?: string[] }>;
          };

          if (data.code === 'OK' && data.items?.[0]?.title) {
            const item = data.items[0];
            return {
              name: item.title!,
              category: mapToAppCategory(item.category || 'other'),
              unit: 'pieces',
              source: 'upcitemdb',
              confidence: 0.85,
              imageUrl: item.images?.[0],
            };
          }
          return null;
        } catch {
          return null;
        }
      })(),
      timeout
    ),
  ]);

  // Return first successful result (prefer Open Food Facts)
  if (offResult) return json(offResult);
  if (upcResult) return json(upcResult);

  // Check if quota is exhausted
  if (await isQuotaExhausted(env)) {
    return json({
      name: '',
      category: 'other',
      unit: 'pieces',
      source: 'unknown',
      confidence: 0,
      quotaExhausted: true,
    } as ProductInfo & { quotaExhausted: boolean });
  }

  // AI fallback with usage tracking
  const aiMessages = [
    {
      role: 'system',
      content: `You classify products for a charity inventory. Categories: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other. Respond ONLY with JSON: {"category": "name", "suggestedName": "Product Name", "confidence": 0.5}`
    },
    { role: 'user', content: `Barcode: ${barcode}` }
  ];

  // Determine which AI provider to use
  const useAzure = await shouldUseAzureFallback(env);

  if (useAzure && env.EDGE_AI_GATEWAY_URL) {
    // Use Azure via Edge AI Gateway
    try {
      const azureResponse = await callEdgeAIGateway(env, aiMessages, 80);
      if (azureResponse) {
        await incrementAIUsage(env, 'azure', 'barcode_lookup');
        try {
          const parsed = JSON.parse(azureResponse);
          return json({
            name: parsed.suggestedName || '',
            category: parsed.category || 'other',
            unit: 'pieces',
            source: 'ai',
            confidence: parsed.confidence || 0.3,
          } as ProductInfo);
        } catch { /* ignore parse error */ }
      }
    } catch { /* ignore */ }
  } else if (env.AI) {
    // Use Cloudflare AI
    try {
      const aiResult = await withTimeout(
        (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: aiMessages,
          max_tokens: 80,
        }),
        2000
      ) as { response?: string } | null;

      if (aiResult?.response) {
        await incrementAIUsage(env, 'cloudflare', 'barcode_lookup');
        try {
          const parsed = JSON.parse(aiResult.response);
          return json({
            name: parsed.suggestedName || '',
            category: parsed.category || 'other',
            unit: 'pieces',
            source: 'ai',
            confidence: parsed.confidence || 0.3,
          } as ProductInfo);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // Return unknown
  return json({ name: '', category: 'other', unit: 'pieces', source: 'unknown', confidence: 0 } as ProductInfo);
}

// Image recognition handler
export async function recognizeImage(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { image: string };

    if (!body.image) {
      return error('Image data required', 400);
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');

    // Check if quota is exhausted
    if (await isQuotaExhausted(env)) {
      return json({
        name: '',
        category: 'other',
        unit: 'pieces',
        barcode: null,
        generatedBarcode: generateBarcode(),
        confidence: 0,
        description: 'AI quota exhausted for today. Please enter details manually.',
        quotaExhausted: true,
      } as AIRecognitionResult & { quotaExhausted: boolean });
    }

    // Check if we should use Azure fallback
    const useAzure = await shouldUseAzureFallback(env);

    const aiPrompt = `Analyze this image for a charity donation inventory system.

Please identify:
1. What is the item? (product name)
2. Category (one of: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other)
3. Best unit of measure (pieces, packs, boxes, bags, bottles, sets)
4. Is there a visible barcode? If yes, read it. If no, return null.
5. Brief description

Respond ONLY with JSON in this exact format:
{
  "name": "Product Name",
  "category": "category_name",
  "unit": "pieces",
  "barcode": "1234567890" or null,
  "confidence": 0.85,
  "description": "Brief description"
}`;

    // If using Azure fallback for image recognition (GPT-4o vision)
    if (useAzure && env.EDGE_AI_GATEWAY_URL) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (env.EDGE_AI_GATEWAY_KEY) {
          headers['Authorization'] = `Bearer ${env.EDGE_AI_GATEWAY_KEY}`;
        }

        const azureResponse = await fetch(env.EDGE_AI_GATEWAY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: aiPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Data}` }
                  }
                ]
              }
            ],
            max_tokens: 200,
          }),
        });

        if (azureResponse.ok) {
          const data = await azureResponse.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content;

          if (content) {
            await incrementAIUsage(env, 'azure', 'image_recognition');
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return json({
                  name: parsed.name || '',
                  category: mapToAppCategory(parsed.category || 'other'),
                  unit: parsed.unit || 'pieces',
                  barcode: parsed.barcode || null,
                  generatedBarcode: generateBarcode(),
                  confidence: parsed.confidence || 0.7,
                  description: parsed.description || '',
                } as AIRecognitionResult);
              }
            } catch { /* ignore parse error */ }
          }
        }
      } catch (err) {
        console.error('Azure vision recognition failed:', err);
      }
    }

    // Use Cloudflare AI if available and not using Azure
    if (env.AI && !useAzure) {
      try {
        // Use LLaVA model for image understanding (Cloudflare Workers AI)
        const aiResponse = await (env.AI as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
          image: Array.from(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))),
          prompt: aiPrompt,
          max_tokens: 200,
        });

        if (aiResponse?.description) {
          await incrementAIUsage(env, 'cloudflare', 'image_recognition');
          try {
            // Try to parse JSON from response
            const jsonMatch = aiResponse.description.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);

              return json({
                name: parsed.name || '',
                category: mapToAppCategory(parsed.category || 'other'),
                unit: parsed.unit || 'pieces',
                barcode: parsed.barcode || null,
                generatedBarcode: generateBarcode(),
                confidence: parsed.confidence || 0.7,
                description: parsed.description || '',
              } as AIRecognitionResult);
            }
          } catch {
            // If JSON parsing fails, try to extract info from text
            const text = aiResponse.description.toLowerCase();
            let category = 'other';
            for (const [key, value] of Object.entries(CATEGORY_MAP)) {
              if (text.includes(key)) {
                category = value;
                break;
              }
            }

            return json({
              name: '',
              category,
              unit: 'pieces',
              barcode: null,
              generatedBarcode: generateBarcode(),
              confidence: 0.5,
              description: aiResponse.description,
            } as AIRecognitionResult);
          }
        }

        // Fallback: Use text model to analyze
        const textResponse = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that helps identify donation items. When given context about an image, determine the likely item category. Categories: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other. Respond ONLY with JSON.`
            },
            {
              role: 'user',
              content: `Based on an image analysis, please categorize this item. Response format: {"name": "", "category": "other", "unit": "pieces", "confidence": 0.3}`
            }
          ],
          max_tokens: 100,
        });

        if (textResponse?.response) {
          try {
            const parsed = JSON.parse(textResponse.response);
            return json({
              name: parsed.name || '',
              category: parsed.category || 'other',
              unit: parsed.unit || 'pieces',
              barcode: null,
              generatedBarcode: generateBarcode(),
              confidence: parsed.confidence || 0.3,
            } as AIRecognitionResult);
          } catch { /* ignore */ }
        }
      } catch (aiError) {
        console.error('AI recognition error:', aiError);
      }
    }

    // Final fallback
    return json({
      name: '',
      category: 'other',
      unit: 'pieces',
      barcode: null,
      generatedBarcode: generateBarcode(),
      confidence: 0,
      description: 'Could not recognize item. Please enter details manually.',
    } as AIRecognitionResult);

  } catch (err) {
    console.error('Image recognition error:', err);
    return error('Failed to process image', 500);
  }
}

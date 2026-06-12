// SERVER-ONLY. The `.server.ts` suffix keeps this out of the client bundle.
// Calls the Lovable AI gateway from the server so the LOVABLE_API_KEY is never
// exposed to the browser and there is no CORS preflight (the gateway only
// accepts server-to-server calls).
//
// The gateway is OpenAI-compatible. Image models return the generated/edited
// image as a base64 data URL at: choices[0].message.images[0].image_url.url
// (modalities: ["image", "text"]).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Candidate image-capable models on the Lovable gateway, tried in order until
// one succeeds. Override with LOVABLE_IMAGE_MODEL if you want a fixed model.
const DEFAULT_IMAGE_MODELS = [
  "google/gemini-3-pro-image-preview",
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
];

type GatewayMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error(
      "Missing LOVABLE_API_KEY. Connect the Lovable AI connector in Lovable Cloud.",
    );
  }
  return key;
}

function modelCandidates(): string[] {
  const override = process.env.LOVABLE_IMAGE_MODEL?.trim();
  return override ? [override] : DEFAULT_IMAGE_MODELS;
}

function friendlyError(status: number, body: string): Error {
  if (status === 429) {
    return new Error("Rate limit hit. Please wait a moment and try again.");
  }
  if (status === 402) {
    return new Error(
      "AI credits exhausted. Add credits in Lovable Cloud → Settings → Cloud & AI balance.",
    );
  }
  return new Error(`Image AI request failed (${status}): ${body.slice(0, 300)}`);
}

/**
 * Extract the first generated image (base64 data URL) from a gateway response.
 */
function extractImageDataUrl(json: unknown): string | null {
  const choice = (json as { choices?: Array<{ message?: { images?: unknown } }> })
    ?.choices?.[0];
  const images = choice?.message?.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url =
        (img as { image_url?: { url?: string } })?.image_url?.url ??
        (typeof img === "string" ? img : undefined);
      if (typeof url === "string" && url.startsWith("data:image")) return url;
    }
  }
  return null;
}

async function callGateway(
  content: GatewayMessageContent,
): Promise<string> {
  const apiKey = getApiKey();
  let lastError: Error | null = null;

  for (const model of modelCandidates()) {
    let response: Response;
    try {
      response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Both headers are accepted by the gateway; sending both maximizes
          // compatibility across gateway versions.
          Authorization: `Bearer ${apiKey}`,
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model,
          modalities: ["image", "text"],
          messages: [{ role: "user", content }],
        }),
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // 429/402 are account-level — don't bother trying other models.
      if (response.status === 429 || response.status === 402) {
        throw friendlyError(response.status, text);
      }
      lastError = friendlyError(response.status, text);
      continue; // model may be unavailable; try the next candidate
    }

    const json = await response.json().catch(() => null);
    const dataUrl = extractImageDataUrl(json);
    if (dataUrl) return dataUrl;

    lastError = new Error("The AI did not return an image. Please try again.");
  }

  throw lastError ?? new Error("Image generation failed.");
}

const ENHANCE_INSTRUCTION = [
  "Transform this photo into a polished, professional headshot.",
  "CRITICAL: keep the EXACT SAME person — preserve their facial features, face shape,",
  "skin tone, hair, and overall identity so they remain clearly recognizable and unchanged.",
  "Do not beautify or alter their face into a different person.",
  "Improve lighting to soft, even, flattering studio lighting.",
  "Replace the background with a clean, neutral professional studio backdrop",
  "(subtle light-grey or soft gradient).",
  "Dress the subject in smart, professional business-casual attire.",
  "Sharpen focus, correct exposure and color, remove noise and distractions.",
  "Keep it photorealistic and natural. Output a square, head-and-shoulders portrait.",
].join(" ");

/**
 * Enhance an existing photo into a professional headshot.
 * @param sourceDataUrl  base64 data URL of the source image (data:image/...;base64,...)
 */
export async function enhanceImage(sourceDataUrl: string): Promise<string> {
  return callGateway([
    { type: "image_url", image_url: { url: sourceDataUrl } },
    { type: "text", text: ENHANCE_INSTRUCTION },
  ]);
}

/**
 * Generate a professional headshot from scratch (no source photo).
 */
export async function generateImage(name?: string, bio?: string): Promise<string> {
  const subject = name?.trim() ? name.trim() : "a professional freelancer";
  const context = bio?.trim() ? ` Context about them: ${bio.trim().slice(0, 160)}.` : "";
  const prompt = [
    `Create a photorealistic, professional LinkedIn-style headshot portrait of ${subject}.${context}`,
    "Soft studio lighting, clean neutral light-grey background, smart business-casual attire,",
    "friendly confident expression, sharp focus, high resolution.",
    "Square, head-and-shoulders framing.",
  ].join(" ");
  return callGateway(prompt);
}

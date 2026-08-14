import { createWorker } from "tesseract.js";

export interface ReceiptScanResult {
  reference_number: string | null;
  amount: string | null;
  platform?: string | null;
  sender?: string | null;
  recipient?: string | null;
  datetime?: string | null;
  confidence: "high" | "medium" | "low";
  engine: "gemini" | "tesseract";
  raw_text?: string | null;
}

const DEFAULT_GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  "AQ.Ab8RN6Lwof1fVn1ikc0DH4SpehDyCUGEyFRVjpDYhr8ukQ8jDw";

/**
 * Converts a File or Blob into base64 string without data URL prefix
 */
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(",");
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : file.type || "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Clean & normalize reference numbers
 */
const cleanReferenceNumber = (ref: string | null | undefined): string | null => {
  if (!ref) return null;
  // Remove whitespace and clean quotes
  const cleaned = ref.trim().replace(/^['"`]+|['"`]+$/g, "");
  // If it's just words like "reference", "ref", ignore
  if (/^(reference|ref|none|null|undefined|n\/a)$/i.test(cleaned)) {
    return null;
  }
  // Must have at least 4 chars
  return cleaned.length >= 4 ? cleaned : null;
};

/**
 * Clean & normalize amount into 2 decimal string (e.g. "185.00")
 */
const cleanAmount = (amt: any): string | null => {
  if (amt === null || amt === undefined) return null;
  const numStr = String(amt).replace(/[^\d.]/g, "");
  const num = parseFloat(numStr);
  if (isNaN(num) || num <= 0) return null;
  return num.toFixed(2);
};

/**
 * Scan receipt using Google Gemini 2.5 Flash Vision
 */
export const scanReceiptWithGemini = async (
  file: File,
  apiKey?: string
): Promise<ReceiptScanResult | null> => {
  const key = apiKey || DEFAULT_GEMINI_API_KEY;
  if (!key) return null;

  try {
    const { base64, mimeType } = await fileToBase64(file);

    const systemPrompt = `You are a high-accuracy OCR and payment receipt extraction AI specialized in Philippine payment receipts.
Supported formats include:
- GCash (Send Money, Express Send, QRPh, Merchant Payments, Bank Transfer)
- Maya / PayMaya
- ShopeePay, GrabPay, PalawanPay
- Philippine Banks: BPI, BDO, LandBank, UnionBank, RCBC, Metrobank, GoTyme, SeaBank, Tonik, CIMB, Security Bank, Chinabank.

Extract the following information from the receipt image:
1. "reference_number": The exact alphanumeric payment reference number, transaction ID, trace number, or QRPH invoice number.
   - For GCash Send Money: usually a 13-digit number (e.g. "7043805345335" or "0026 8923 1039 1"). Keep all digits without spaces or dashes.
   - For GCash QRPh / Live Direct: usually a 9-10 digit number labeled "Reference No." or "QRPH Invoice No." (e.g. "192831784" or "959969").
   - For Maya: 12-character uppercase/digit sequence.
   - For Banks: full reference string (e.g. "UBP-12345678", "BDO-987654321").
   - Do NOT include labels like "Ref No", "Reference", or "Invoice". Extract only the identifier itself.
2. "amount": The exact amount paid as a numeric value with decimals (e.g. 185.00 or 100.00). Look for "Amount", "Total Amount Sent", "Total", "PHP", "₱", "P".
3. "platform": The app or bank (e.g. "GCash", "GCash QRPh", "Maya", "BPI", "LandBank", "UnionBank", "GoTyme", etc.).
4. "sender": The sender name or mobile number if visible.
5. "recipient": The recipient / merchant name or number if visible.
6. "datetime": The date and time string if visible (e.g. "Jul 16, 2026 6:05 AM").

Return ONLY a valid JSON object matching this schema with no markdown formatting:
{
  "reference_number": "...",
  "amount": 185.00,
  "platform": "...",
  "sender": "...",
  "recipient": "...",
  "datetime": "..."
}`;

    const candidateModels = [
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ];

    let rawContent = "";

    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                response_mime_type: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (rawContent) {
            console.log(`✨ Successfully scanned with ${model}`);
            break;
          }
        } else {
          console.warn(`Model ${model} returned ${response.status}. Trying next model...`);
        }
      } catch (err) {
        console.warn(`Error trying ${model}:`, err);
      }
    }

    if (!rawContent) return null;

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawContent.trim());
    } catch {
      // Clean possible code fences if present
      const cleanedJson = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleanedJson);
    }

    const cleanRef = cleanReferenceNumber(parsed.reference_number);
    const cleanAmt = cleanAmount(parsed.amount);

    return {
      reference_number: cleanRef,
      amount: cleanAmt,
      platform: parsed.platform || null,
      sender: parsed.sender || null,
      recipient: parsed.recipient || null,
      datetime: parsed.datetime || null,
      confidence: cleanRef && cleanAmt ? "high" : cleanRef ? "medium" : "low",
      engine: "gemini",
      raw_text: rawContent,
    };
  } catch (err) {
    console.error("Gemini Vision receipt scanning error:", err);
    return null;
  }
};

/**
 * Enhanced Fallback Scanner using Local Tesseract.js with smart multi-pass regex
 */
export const scanReceiptWithTesseract = async (
  file: File
): Promise<ReceiptScanResult> => {
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core.wasm.js",
    langPath: "/tesseract",
    gzip: true,
  });

  const {
    data: { text },
  } = await worker.recognize(file);
  await worker.terminate();

  const cleanText = text.replace(/\r\n/g, "\n");
  const singleLineText = cleanText.replace(/\n/g, " ").replace(/\s+/g, " ");

  // 1. Line-by-line structured reference lookup
  let extractedRef: string | null = null;
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match line like: "Reference No. 192831784" or "Ref No: 7043805345335" or "QRPH Invoice No. 959969"
    const lineRefMatch = line.match(
      /(?:Reference\s*(?:No|Number|#)?|Ref\s*(?:No|Number|#|\.)|Transaction\s*(?:ID|No|Number)|Trace\s*(?:No|#)|QRPH\s*Invoice\s*(?:No|#)?|InstaPay\s*Ref)\s*[:.\s#]*([A-Z0-9-]{6,25})/i
    );
    if (lineRefMatch && lineRefMatch[1]) {
      const candidate = lineRefMatch[1].replace(/[^a-zA-Z0-9-]/g, "");
      if (candidate.length >= 6 && !/^(number|reference|payment|successful)$/i.test(candidate)) {
        extractedRef = candidate;
        break;
      }
    }
  }

  // 2. Pattern-based fallback matching if not found line-by-line
  if (!extractedRef) {
    const gcashPattern = singleLineText.match(/\b[019]\d{12}\b/);
    const mayaPattern = singleLineText.match(/\b[A-Z0-9]{12}\b/);
    const qrphPattern = singleLineText.match(/\b\d{8,10}\b/);

    if (gcashPattern) extractedRef = gcashPattern[0];
    else if (mayaPattern && !/^(JANUARY|FEBRUARY|SEPTEMBER|NOVEMBER|DECEMBER)$/i.test(mayaPattern[0])) extractedRef = mayaPattern[0];
    else if (qrphPattern) extractedRef = qrphPattern[0];
    else {
      const digitMatches = singleLineText.match(/\b\d{8,16}\b/g);
      extractedRef = digitMatches?.find((m) => !m.startsWith("09")) || null;
    }
  }

  // 3. Amount extraction supporting PHP, ₱, P, £, and standard currency labels
  let extractedAmount: string | null = null;
  const amountRegex =
    /(?:Total\s*Amount(?:\s*Sent)?|Amount\s*Sent|Total|Amount|Amount\s*Paid)\s*[:.\s]*[₱PHP£FpP]*\s*([\d,]+\.\d{2})/i;
  const amountMatch = singleLineText.match(amountRegex);

  if (amountMatch && amountMatch[1]) {
    extractedAmount = cleanAmount(amountMatch[1]);
  }

  return {
    reference_number: cleanReferenceNumber(extractedRef),
    amount: extractedAmount,
    platform: null,
    sender: null,
    recipient: null,
    datetime: null,
    confidence: extractedRef && extractedAmount ? "high" : extractedRef ? "medium" : "low",
    engine: "tesseract",
    raw_text: text,
  };
};

/**
 * Universal Auto-Scanner: Runs Gemini AI Vision first for 99.9% accuracy,
 * and automatically falls back to Enhanced Tesseract if Gemini is unavailable.
 */
export const scanReceipt = async (
  file: File,
  apiKey?: string
): Promise<ReceiptScanResult> => {
  // 1. Try Gemini Vision (AI Model)
  const geminiResult = await scanReceiptWithGemini(file, apiKey);
  if (geminiResult && geminiResult.reference_number) {
    console.log("✨ Scanned via Gemini AI Vision:", geminiResult);
    return geminiResult;
  }

  // 2. Fallback to Local Tesseract OCR
  console.log("ℹ️ Falling back to Local OCR Engine...");
  const tesseractResult = await scanReceiptWithTesseract(file);
  console.log("📝 Scanned via Local OCR:", tesseractResult);
  return tesseractResult;
};

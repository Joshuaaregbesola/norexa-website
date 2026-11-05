import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const MAX_FILE_BYTES = 12 * 1024 * 1024;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "18mb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "public")));

const allowedExtensions = new Set([
  ".pdf", ".txt", ".md", ".csv", ".json", ".doc", ".docx", ".rtf",
  ".odt", ".ppt", ".pptx", ".xls", ".xlsx"
]);

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("The attachment format is invalid.");
  }
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("The attachment could not be read.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_FILE_BYTES) throw new Error("Please keep each attachment under 12 MB.");
  return { mime: match[1], base64: match[2], buffer };
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "NEXORA is not connected yet. Add your API key to the server's .env file." });
    }

    const { messages, language = "Auto-detect", attachment } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Please send a message." });
    }

    const recent = messages.slice(-16);
    const input = [];

    for (let index = 0; index < recent.length; index++) {
      const message = recent[index];
      if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") continue;

      if (message.role === "user" && index === recent.length - 1 && attachment?.dataUrl) {
        const parsed = parseDataUrl(attachment.dataUrl);
        const ext = path.extname(String(attachment.name || "")).toLowerCase();

        if (parsed.mime.startsWith("image/")) {
          input.push({
            role: "user",
            content: [
              { type: "input_text", text: message.content || "Please describe this image." },
              { type: "input_image", image_url: attachment.dataUrl, detail: "auto" }
            ]
          });
        } else {
          if (!allowedExtensions.has(ext)) {
            return res.status(400).json({ error: "That file type is not supported. Try PDF, Word, PowerPoint, Excel, CSV or text." });
          }
          input.push({
            role: "user",
            content: [
              { type: "input_text", text: message.content || "Please analyze this document and explain its important points." },
              {
                type: "input_file",
                filename: String(attachment.name || "document"),
                file_data: `data:${parsed.mime};base64,${parsed.base64}`
              }
            ]
          });
        }
      } else {
        input.push({ role: message.role, content: message.content });
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions: [
        "You are NEXORA, a helpful, thoughtful, friendly AI assistant.",
        "Answer accurately and clearly. If you are uncertain, say so rather than inventing facts.",
        "Adapt to the user's level of knowledge. Use concise answers unless detail is useful.",
        `Preferred response language: ${language}. If set to Auto-detect, reply in the language the user uses.`,
        "You can help with learning, writing, planning, coding, brainstorming and understanding images or documents.",
        "Do not claim to have performed actions outside this chat."
      ].join(" "),
      input
    });

    res.json({ reply: response.output_text || "I couldn't generate a text response. Please try again." });
  } catch (error) {
    console.error("NEXORA API error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status === 401
        ? "The server API key was rejected. Check the key in .env."
        : (error?.message || "Something went wrong. Please try again.")
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "NEXORA AI" }));

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, () => {
  console.log(`NEXORA AI is running at http://localhost:${port}`);
});

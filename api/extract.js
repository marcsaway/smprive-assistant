import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB max

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File parse error" });

    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const ext = path.extname(file.originalFilename || file.name || "").toLowerCase();
    const filePath = file.filepath || file.path;

    try {
      let text = "";

      if (ext === ".txt") {
        text = fs.readFileSync(filePath, "utf-8");
      } else if (ext === ".pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (ext === ".docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      return res.status(200).json({ text: text.trim() });
    } catch (e) {
      console.error("Extraction error:", e);
      return res.status(500).json({ error: "Failed to extract text from file" });
    }
  });
}

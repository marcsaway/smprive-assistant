import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const KEY = "smprive_knowledge";

  if (req.method === "GET") {
    try {
      const knowledge = await kv.get(KEY);
      return res.status(200).json({ knowledge: knowledge || null });
    } catch (e) {
      return res.status(200).json({ knowledge: null });
    }
  }

  if (req.method === "POST") {
    try {
      const { knowledge } = req.body;
      if (!knowledge) return res.status(400).json({ error: "No knowledge provided" });
      await kv.set(KEY, knowledge);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Failed to save" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

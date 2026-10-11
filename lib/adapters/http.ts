import { createHash } from "node:crypto";
export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function request(url: string, json = true): Promise<unknown> {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    ![
      "huggingface.co",
      "raw.githubusercontent.com",
      "api.github.com",
      "cybergym.io",
      "www.cybergym.io",
      "openrouter.ai",
      "featherless.ai",
    ].includes(u.hostname)
  )
    throw Error("Source host not allowed");
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers: Record<string, string> = {
      "User-Agent": "RE-Model-Radar/1.0",
      Accept: json ? "application/json" : "text/plain",
    };
    if (u.hostname === "api.github.com" && process.env.GITHUB_TOKEN)
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    if (u.hostname === "huggingface.co" && process.env.HF_TOKEN)
      headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
    const r = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 2) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(5000, 1000 * 2 ** attempt)),
      );
      continue;
    }
    if (!r.ok) throw Error(`HTTP ${r.status} from ${u.hostname}`);
    const text = await r.text();
    if (text.length > 30_000_000) throw Error("Response too large");
    return json ? JSON.parse(text) : text;
  }
  throw Error("Retries exhausted");
}

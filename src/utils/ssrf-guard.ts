import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIp(ip: string): boolean {
  // IPv4
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  // IPv6: loopback, ULA (fc00::/7), link-local (fe80::/10), v4-mapped
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  )
    return true;
  if (lower.includes("::ffff:")) {
    const v4 = lower.split("::ffff:")[1];
    if (isIP(v4) === 4) return isPrivateIp(v4);
  }
  return false;
}

/**
 * Returns true if the URL is safe to fetch server-side:
 * http/https only, and its host resolves to a public IP.
 * Note: this resolves DNS once; a determined attacker could DNS-rebind between
 * this check and the fetch. For full protection, fetch against the resolved IP.
 * For an export feature this check-then-fetch is an accepted, large risk
 * reduction — see the maintenance notes in plans/003.
 */
export async function isSafeImageUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname;
  // If host is already a literal IP, check it directly.
  if (isIP(host)) return !isPrivateIp(host);

  try {
    const results = await lookup(host, { all: true });
    if (results.length === 0) return false;
    return results.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

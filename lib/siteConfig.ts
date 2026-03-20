type HostPairKey = "production" | "preview";

export type HostPair = {
  key: HostPairKey;
  publicHost: string;
  adminHost: string;
};

export type BrandSiteConfig = {
  brandKey: string;
  brandName: string;
  apexHost: string;
  production: HostPair;
  preview: HostPair;
};

const brandSiteConfig: BrandSiteConfig = {
  brandKey: process.env.BRAND_KEY || "xdragon",
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "X Dragon",
  apexHost: process.env.NEXT_PUBLIC_APEX_HOST || "xdragon.tech",
  production: {
    key: "production",
    publicHost: process.env.NEXT_PUBLIC_PROD_WWW_HOST || "www.xdragon.tech",
    adminHost: process.env.NEXT_PUBLIC_PROD_ADMIN_HOST || "admin.xdragon.tech",
  },
  preview: {
    key: "preview",
    publicHost: process.env.NEXT_PUBLIC_WWW_HOST || "staging.xdragon.tech",
    adminHost: process.env.NEXT_PUBLIC_ADMIN_HOST || "stg-admin.xdragon.tech",
  },
};

export function getBrandSiteConfig(): BrandSiteConfig {
  return brandSiteConfig;
}

export function getHostPairs(): HostPair[] {
  const cfg = getBrandSiteConfig();
  return [cfg.production, cfg.preview];
}

export function getAllowedHosts(extraHosts: string[] = []): Set<string> {
  const cfg = getBrandSiteConfig();
  return new Set(
    [
      cfg.apexHost,
      cfg.production.publicHost,
      cfg.production.adminHost,
      cfg.preview.publicHost,
      cfg.preview.adminHost,
      ...extraHosts,
    ]
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getHostPairForHost(host: string): HostPair | null {
  const normalized = host.trim().toLowerCase();
  return (
    getHostPairs().find(
      (pair) => pair.publicHost.toLowerCase() === normalized || pair.adminHost.toLowerCase() === normalized
    ) || null
  );
}

export function isAdminHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return getHostPairs().some((pair) => pair.adminHost.toLowerCase() === normalized);
}

export function publicHostFor(host: string): string {
  return getHostPairForHost(host)?.publicHost || getBrandSiteConfig().production.publicHost;
}

export function adminHostFor(host: string): string {
  return getHostPairForHost(host)?.adminHost || getBrandSiteConfig().production.adminHost;
}

export function canonicalPublicHost(currentHost?: string): string {
  const cfg = getBrandSiteConfig();
  const pair = currentHost ? getHostPairForHost(currentHost) : null;
  if (pair) return pair.publicHost;
  return process.env.VERCEL_ENV === "preview" ? cfg.preview.publicHost : cfg.production.publicHost;
}

export function canonicalAdminHost(currentHost?: string): string {
  const cfg = getBrandSiteConfig();
  const pair = currentHost ? getHostPairForHost(currentHost) : null;
  if (pair) return pair.adminHost;
  return process.env.VERCEL_ENV === "preview" ? cfg.preview.adminHost : cfg.production.adminHost;
}

export function authCookieDomain(): string | undefined {
  if (process.env.VERCEL_ENV !== "production") return undefined;
  return process.env.AUTH_COOKIE_DOMAIN || `.${getBrandSiteConfig().apexHost}`;
}

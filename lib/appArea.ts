export type AppArea = "public" | "backoffice";

const BACKOFFICE_PATH_PREFIXES = ["/admin", "/auth", "/tools", "/prompts", "/guides", "/resources"] as const;

export function isBackofficePathname(pathname: string): boolean {
  return BACKOFFICE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAppArea(pathname: string): AppArea {
  return isBackofficePathname(pathname) ? "backoffice" : "public";
}

export function shouldRenderPublicChat(pathname: string): boolean {
  return getAppArea(pathname) === "public";
}

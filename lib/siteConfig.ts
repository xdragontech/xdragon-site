export function authCookieDomain(): string | undefined {
  // Backoffice and public auth now use separate hosts and separate identity domains.
  // Keep auth cookies host-only so runtime no longer depends on shared subdomain cookie configuration.
  return undefined;
}

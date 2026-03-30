import {
  commandPublicGetRuntimeHostConfig,
  type CommandPublicRuntimeHostConfig,
} from "./commandPublicApi";
import { normalizeHost } from "./requestHost";

export type RuntimeHostConfig = CommandPublicRuntimeHostConfig;

function buildFallbackRuntimeHostConfig(requestHost: string): RuntimeHostConfig {
  return {
    requestHost,
    brandKey: null,
    runtime: null,
    canonicalPublicHost: requestHost || null,
    canonicalAdminHost: requestHost || null,
    allowedHosts: requestHost ? [requestHost] : [],
    resolvedFromBrandRegistry: false,
  };
}

export async function getRuntimeHostConfig(requestHost?: string | null): Promise<RuntimeHostConfig> {
  const normalizedHost = normalizeHost(requestHost);
  if (!normalizedHost) {
    return buildFallbackRuntimeHostConfig("");
  }

  try {
    return await commandPublicGetRuntimeHostConfig({ host: normalizedHost });
  } catch (error) {
    console.error("[runtime-host] failed to load command runtime host config", {
      requestHost: normalizedHost,
      error: error instanceof Error ? error.message : String(error),
    });
    return buildFallbackRuntimeHostConfig(normalizedHost);
  }
}

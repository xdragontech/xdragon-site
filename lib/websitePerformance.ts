import type { NextApiRequest } from "next";
import {
  commandPublicCollectAnalytics,
  type CommandPublicAnalyticsEvent,
} from "./commandPublicApi";
import {
  getWebsiteAnalyticsConsent,
  getWebsiteAnalyticsSessionId,
} from "./websiteAnalytics";

export const WEBSITE_PERFORMANCE_ROUTE_LABELS = {
  LOGIN: "Login",
  SIGNUP: "Signup",
  VERIFY_EMAIL: "Email Verification",
  CONTACT: "Contact",
  CHAT: "Chat",
} as const;

export type WebsitePerformanceRouteKey = keyof typeof WEBSITE_PERFORMANCE_ROUTE_LABELS;

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}

function buildPerformanceEvent(args: {
  routeKey: WebsitePerformanceRouteKey;
  durationMs: number;
  req: NextApiRequest;
  statusCode?: number;
}): CommandPublicAnalyticsEvent {
  const routeLabel = WEBSITE_PERFORMANCE_ROUTE_LABELS[args.routeKey];
  return {
    eventId: `perf_${args.routeKey.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventType: "PERFORMANCE_METRIC",
    occurredAt: new Date().toISOString(),
    metricName: "REQUEST_MS",
    metricValue: roundMetric(args.durationMs),
    url: typeof args.req.headers.referer === "string" ? args.req.headers.referer : null,
    raw: {
      source: "PUBLIC_WEBSITE",
      routeKey: args.routeKey,
      routeLabel,
      statusCode: args.statusCode ?? null,
    },
  };
}

export async function recordWebsiteRequestPerformance(args: {
  req: NextApiRequest;
  routeKey: WebsitePerformanceRouteKey;
  durationMs: number;
  statusCode?: number;
}) {
  const consent = getWebsiteAnalyticsConsent(args.req);
  const sessionId = getWebsiteAnalyticsSessionId(args.req);
  if (consent.status !== "accepted" || !sessionId) return;

  try {
    await commandPublicCollectAnalytics({
      request: args.req,
      websiteSessionId: sessionId,
      events: [
        buildPerformanceEvent({
          req: args.req,
          routeKey: args.routeKey,
          durationMs: args.durationMs,
          statusCode: args.statusCode,
        }),
      ],
    });
  } catch (error) {
    console.error("[website-performance] failed to record request performance", {
      routeKey: args.routeKey,
      statusCode: args.statusCode ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

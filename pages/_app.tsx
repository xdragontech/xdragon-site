import type { AppProps, NextWebVitalsMetric } from "next/app";
import { useRouter } from "next/router";
import "../styles/globals.css";
import AppShell from "../components/app/AppShell";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <AppShell pathname={router.pathname}>
      <Component {...pageProps} />
    </AppShell>
  );
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/admin")) return;

  const payload = JSON.stringify({
    events: [
      {
        eventId: `wv_${metric.name}_${metric.id}`,
        eventType: "WEB_VITAL",
        occurredAt: new Date().toISOString(),
        path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        url: window.location.href,
        metricName: metric.name,
        metricValue: Number(metric.value),
        raw: {
          id: metric.id,
          label: metric.label,
          rating: "rating" in metric ? metric.rating : null,
          navigationType: "navigationType" in metric ? metric.navigationType : null,
        },
      },
    ],
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/collect", blob);
    return;
  }

  void fetch("/api/analytics/collect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    cache: "no-store",
    keepalive: true,
  });
}

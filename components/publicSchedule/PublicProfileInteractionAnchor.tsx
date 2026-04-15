import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { CommandPartnerKind, CommandPublicAnalyticsProfileInteractionFeedSource } from "../../lib/commandPublicApi";
import { queueWebsiteAnalyticsEvents } from "../../lib/websiteAnalyticsClient";
import {
  buildProfileInteractionEvent,
  profileFeedInteractionKey,
  type ProfileFeedInteractionSurfaceKey,
} from "./profileFeedAnalytics";

type PublicProfileInteractionAnchorProps = {
  href?: string | null;
  target?: string;
  rel?: string;
  title?: string;
  className: string;
  children: ReactNode;
  enableImpression?: boolean;
  feedId: string;
  feedSource: CommandPublicAnalyticsProfileInteractionFeedSource;
  partnerProfileId: string;
  partnerKind: CommandPartnerKind;
  eventSeriesId: string;
  surfaceKey: ProfileFeedInteractionSurfaceKey;
  clickEventType?: "PROFILE_WEBSITE_CLICK" | "PROFILE_SOCIAL_LINK_CLICK";
  clickTargetType?: "WEBSITE" | "SOCIAL_LINK";
  clickTargetUrl?: string | null;
  socialPlatform?: string | null;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function PublicProfileInteractionAnchor({
  href,
  target,
  rel,
  title,
  className,
  children,
  enableImpression = false,
  feedId,
  feedSource,
  partnerProfileId,
  partnerKind,
  eventSeriesId,
  surfaceKey,
  clickEventType,
  clickTargetType,
  clickTargetUrl,
  socialPlatform,
  onClick,
}: PublicProfileInteractionAnchorProps) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const seenImpressionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enableImpression || !partnerProfileId || !eventSeriesId) return;

    const dedupeKey = profileFeedInteractionKey({
      feedId,
      partnerProfileId,
      surfaceKey,
    });
    if (seenImpressionKeysRef.current.has(dedupeKey)) return;

    const node = anchorRef.current;
    if (!node) return;

    const queueImpression = () => {
      if (seenImpressionKeysRef.current.has(dedupeKey)) return;
      seenImpressionKeysRef.current.add(dedupeKey);
      queueWebsiteAnalyticsEvents([
        buildProfileInteractionEvent({
          eventType: "PROFILE_IMPRESSION",
          metadata: {
            feedId,
            feedSource,
            partnerProfileId,
            partnerKind,
            eventSeriesId,
            targetType: "PROFILE",
            surfaceKey,
          },
        }),
      ]);
    };

    if (typeof IntersectionObserver === "undefined") {
      queueImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
          return;
        }

        observer.disconnect();
        queueImpression();
      },
      {
        threshold: [0.35, 0.6],
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [enableImpression, eventSeriesId, feedId, feedSource, partnerKind, partnerProfileId, surfaceKey]);

  return (
    <a
      ref={anchorRef}
      href={href || undefined}
      target={target}
      rel={rel}
      title={title}
      className={className}
      onClick={(event) => {
        onClick?.(event);

        if (!href) {
          event.preventDefault();
          return;
        }

        if (clickEventType && clickTargetType && partnerProfileId && eventSeriesId) {
          queueWebsiteAnalyticsEvents([
            buildProfileInteractionEvent({
              eventType: clickEventType,
              metadata: {
                feedId,
                feedSource,
                partnerProfileId,
                partnerKind,
                eventSeriesId,
                targetType: clickTargetType,
                targetUrl: clickTargetUrl || href,
                surfaceKey,
                socialPlatform,
              },
            }),
          ]);
        }
      }}
    >
      {children}
    </a>
  );
}

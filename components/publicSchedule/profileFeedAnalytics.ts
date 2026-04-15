import type {
  CommandPartnerKind,
  CommandPublicAnalyticsEvent,
  CommandPublicAnalyticsProfileInteractionFeedSource,
  CommandPublicAnalyticsProfileInteractionRaw,
  CommandPublicAnalyticsProfileInteractionTargetType,
} from "../../lib/commandPublicApi";
import { buildWebsiteAnalyticsEvent } from "../../lib/websiteAnalyticsClient";

export type ProfileFeedInteractionSurfaceKey =
  | "SCHEDULE_SPONSOR_NAME_TICKER"
  | "SCHEDULE_SPONSOR_IMAGE_TICKER"
  | "SCHEDULE_PARTNER_PROFILE_FEED";

export type ProfileFeedInteractionEventType =
  | "PROFILE_IMPRESSION"
  | "PROFILE_IMAGE_OPEN"
  | "PROFILE_WEBSITE_CLICK"
  | "PROFILE_SOCIAL_LINK_CLICK";

export type ProfileFeedInteractionMetadata = {
  feedId: string;
  feedSource: CommandPublicAnalyticsProfileInteractionFeedSource;
  partnerProfileId: string;
  partnerKind: CommandPartnerKind;
  eventSeriesId: string;
  targetType: CommandPublicAnalyticsProfileInteractionTargetType;
  targetUrl?: string | null;
  surfaceKey: ProfileFeedInteractionSurfaceKey;
  socialPlatform?: string | null;
};

export function buildProfileInteractionEvent(args: {
  eventType: ProfileFeedInteractionEventType;
  metadata: ProfileFeedInteractionMetadata;
}): CommandPublicAnalyticsEvent {
  const raw: CommandPublicAnalyticsProfileInteractionRaw = {
    schema: "profile_interaction.v1",
    feedId: args.metadata.feedId,
    feedSource: args.metadata.feedSource,
    partnerProfileId: args.metadata.partnerProfileId,
    partnerKind: args.metadata.partnerKind,
    eventSeriesId: args.metadata.eventSeriesId,
    targetType: args.metadata.targetType,
    targetUrl: args.metadata.targetUrl || null,
    surfaceKey: args.metadata.surfaceKey,
    socialPlatform: args.metadata.socialPlatform || null,
  };

  return buildWebsiteAnalyticsEvent(args.eventType, { raw });
}

export function profileFeedInteractionKey(metadata: {
  feedId: string;
  partnerProfileId: string;
  surfaceKey: ProfileFeedInteractionSurfaceKey;
}) {
  return `${metadata.surfaceKey}:${metadata.feedId}:${metadata.partnerProfileId}`;
}

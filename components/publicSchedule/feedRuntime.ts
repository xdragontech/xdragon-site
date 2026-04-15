import type {
  CommandPublicScheduleFeedItem,
  CommandPublicScheduleFeedResponse,
} from "../../lib/commandPublicApi";

export type RuntimePublicScheduleFeedSource = "ASSIGNMENTS" | "SPONSORS" | "PARTNER_PROFILES";

function hasOwnProperty<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function inferSourceFromItem(item: CommandPublicScheduleFeedItem | null | undefined): RuntimePublicScheduleFeedSource | null {
  if (!item || typeof item !== "object") return null;

  if (item.source === "ASSIGNMENTS" || item.source === "SPONSORS") {
    return item.source;
  }

  if (item.source === "PARTNER_PROFILES") {
    return item.source;
  }

  if (hasOwnProperty(item, "participantName") || hasOwnProperty(item, "occurrenceDate")) {
    return "ASSIGNMENTS";
  }

  if (hasOwnProperty(item, "participantType")) {
    return "PARTNER_PROFILES";
  }

  if (hasOwnProperty(item, "sponsorName")) {
    return "SPONSORS";
  }

  if (hasOwnProperty(item, "profileImageUrl") || hasOwnProperty(item, "hasProfileImage")) {
    return "SPONSORS";
  }

  return null;
}

export function resolvePublicScheduleFeedSource(
  feed: CommandPublicScheduleFeedResponse | null
): RuntimePublicScheduleFeedSource | null {
  if (!feed) return null;

  if (feed.source === "ASSIGNMENTS" || feed.source === "SPONSORS" || feed.source === "PARTNER_PROFILES") {
    return feed.source;
  }

  const firstItem = Array.isArray(feed.items) && feed.items.length > 0 ? feed.items[0] : null;
  return inferSourceFromItem(firstItem);
}

export function resolvePublicScheduleFeedIncludesProfileImages(feed: CommandPublicScheduleFeedResponse | null) {
  if (!feed) return false;
  if (typeof feed.includeProfileImages === "boolean") return feed.includeProfileImages;

  return Array.isArray(feed.items)
    ? feed.items.some(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (hasOwnProperty(item, "profileImageUrl") || hasOwnProperty(item, "hasProfileImage"))
      )
    : false;
}

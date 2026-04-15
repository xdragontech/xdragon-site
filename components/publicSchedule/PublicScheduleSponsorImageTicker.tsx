import type { CommandPublicScheduleFeedResponse, CommandPublicScheduleSponsorFeedItem } from "../../lib/commandPublicApi";
import {
  resolvePublicScheduleFeedIncludesProfileImages,
  resolvePublicScheduleFeedSource,
} from "./feedRuntime";
import PublicProfileInteractionAnchor from "./PublicProfileInteractionAnchor";

type PublicScheduleSponsorImageTickerProps = {
  title?: string;
  feed: CommandPublicScheduleFeedResponse | null;
};

function isInformationalSponsorItem(item: CommandPublicScheduleSponsorFeedItem) {
  return !item.sponsorWebsite && !item.sponsorDescription && !item.profileImageUrl && Boolean(item.sponsorName);
}

function WarningTriangle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-yellow-400">
      <path d="M12 3 1.9 20.5h20.2L12 3Zm1 13h-2v-2h2v2Zm0-4h-2V8h2v4Z" />
    </svg>
  );
}

function sponsorHoverTitle(item: CommandPublicScheduleSponsorFeedItem) {
  if (item.sponsorWebsite && item.profileImageUrl) {
    return `${item.sponsorName} · ${item.sponsorWebsite}`;
  }
  if (item.sponsorWebsite) {
    return `${item.sponsorName} · ${item.sponsorWebsite} · No Profile Image`;
  }
  return item.profileImageUrl ? item.sponsorName : "No Profile Image";
}

export default function PublicScheduleSponsorImageTicker({
  title,
  feed,
}: PublicScheduleSponsorImageTickerProps) {
  const feedSource = resolvePublicScheduleFeedSource(feed);
  const includeProfileImages = resolvePublicScheduleFeedIncludesProfileImages(feed);

  if (!feed) {
    return (
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
        {title ? <div className="text-sm font-semibold text-neutral-900">{title}</div> : null}
        <div className={title ? "mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600" : "rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600"}>
          Sponsor feed is not configured.
        </div>
      </section>
    );
  }

  if (feedSource !== "SPONSORS") {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
        {title ? <div className="text-sm font-semibold text-amber-950">{title}</div> : null}
        <div className={title ? "mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-amber-800" : "rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-amber-800"}>
          This display expects a sponsor feed, but the configured feed returns schedule assignment rows.
        </div>
      </section>
    );
  }

  if (!includeProfileImages) {
    return (
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
        {title ? <div className="text-sm font-semibold text-neutral-900">{title}</div> : null}
        <div className={title ? "mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600" : "rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600"}>
          This sponsor feed is not configured to return profile images.
        </div>
      </section>
    );
  }

  const items = feed.items as CommandPublicScheduleSponsorFeedItem[];
  const informationalItem =
    items.length === 1 && isInformationalSponsorItem(items[0]) ? items[0] : null;
  const tickerItems = items.length > 0 ? [...items, ...items] : [];

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
      {title ? <div className="text-sm font-semibold text-neutral-900">{title}</div> : null}

      <div className={title ? "mt-4" : ""}>
        {informationalItem ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm font-semibold text-neutral-700">
            {informationalItem.sponsorName}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
            No sponsor images are available for this feed.
          </div>
        ) : (
          <div className="relative h-[24rem] overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="grid gap-4 p-4 sponsor-image-marquee">
              {tickerItems.map((item, index) => (
                <PublicProfileInteractionAnchor
                  key={`${item.sponsorName || "sponsor"}-${index}`}
                  href={item.sponsorWebsite}
                  target={item.sponsorWebsite ? "_blank" : undefined}
                  rel={item.sponsorWebsite ? "noreferrer" : undefined}
                  title={sponsorHoverTitle(item)}
                  className="flex h-32 items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4 no-underline"
                  enableImpression={index < items.length && Boolean(item.partnerProfileId)}
                  feedId={feed.feedId}
                  feedSource="SPONSORS"
                  partnerProfileId={item.partnerProfileId}
                  partnerKind={item.partnerKind}
                  eventSeriesId={item.eventSeriesId}
                  surfaceKey="SCHEDULE_SPONSOR_IMAGE_TICKER"
                  clickEventType="PROFILE_WEBSITE_CLICK"
                  clickTargetType="WEBSITE"
                  clickTargetUrl={item.sponsorWebsite}
                >
                  {item.profileImageUrl ? (
                    <img
                      src={item.profileImageUrl}
                      alt={item.sponsorName || "Sponsor image"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div
                      className="relative flex h-full w-full items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-100 px-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 opacity-70"
                    >
                      <span className="max-w-[11rem] truncate">{item.sponsorName || "No Image"}</span>
                      <span className="absolute right-2 top-2">
                        <WarningTriangle />
                      </span>
                    </div>
                  )}
                </PublicProfileInteractionAnchor>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .sponsor-image-marquee {
          animation: sponsor-image-marquee 24s linear infinite;
        }

        @keyframes sponsor-image-marquee {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
      `}</style>
    </section>
  );
}

import type { CommandPublicScheduleFeedResponse, CommandPublicScheduleSponsorFeedItem } from "../../lib/commandPublicApi";
import { resolvePublicScheduleFeedSource } from "./feedRuntime";

type PublicScheduleSponsorNameTickerProps = {
  title: string;
  feed: CommandPublicScheduleFeedResponse | null;
};

function isInformationalSponsorItem(item: CommandPublicScheduleSponsorFeedItem) {
  return !item.sponsorWebsite && !item.sponsorDescription && !item.profileImageUrl && Boolean(item.sponsorName);
}

export default function PublicScheduleSponsorNameTicker({
  title,
  feed,
}: PublicScheduleSponsorNameTickerProps) {
  const feedSource = resolvePublicScheduleFeedSource(feed);

  if (!feed) {
    return (
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Feed</div>
        <h2 className="mt-2 text-xl font-semibold text-neutral-900">{title}</h2>
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          Sponsor feed is not configured.
        </div>
      </section>
    );
  }

  if (feedSource !== "SPONSORS") {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Feed</div>
        <h2 className="mt-2 text-xl font-semibold text-amber-950">{title}</h2>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-amber-800">
          This ticker expects a sponsor feed, but the configured feed returns schedule assignment rows.
        </div>
      </section>
    );
  }

  const items = feed.items as CommandPublicScheduleSponsorFeedItem[];
  const informationalItem =
    items.length === 1 && isInformationalSponsorItem(items[0]) ? items[0] : null;
  const sponsorItems = items.filter((item) => item.sponsorName.trim());
  const tickerItems = sponsorItems.length > 0 ? [...sponsorItems, ...sponsorItems] : [];

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Feed</div>
          <h2 className="mt-2 text-xl font-semibold text-neutral-900">{title}</h2>
        </div>
        <div className="text-sm text-neutral-600">
          {informationalItem ? "Status" : `${sponsorItems.length} sponsors`}
        </div>
      </div>

      <div className="mt-4">
        {informationalItem ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm font-semibold text-neutral-700">
            {informationalItem.sponsorName}
          </div>
        ) : sponsorItems.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
            This sponsor feed currently returns images only.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-yellow-300">
            <div className="flex min-w-max gap-10 px-6 py-3 sponsor-name-marquee">
              {tickerItems.map((item, index) => (
                <a
                  key={`${item.sponsorName || "sponsor"}-${index}`}
                  href={item.sponsorWebsite || undefined}
                  target={item.sponsorWebsite ? "_blank" : undefined}
                  rel={item.sponsorWebsite ? "noreferrer" : undefined}
                  title={item.sponsorWebsite ? `${item.sponsorName} · ${item.sponsorWebsite}` : item.sponsorName}
                  className="whitespace-nowrap text-sm font-bold uppercase tracking-[0.18em] text-white no-underline hover:opacity-85"
                  onClick={(event) => {
                    if (!item.sponsorWebsite) event.preventDefault();
                  }}
                >
                  {item.sponsorName}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .sponsor-name-marquee {
          animation: sponsor-name-marquee 26s linear infinite;
        }

        @keyframes sponsor-name-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}

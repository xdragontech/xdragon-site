import type { CommandPublicScheduleFeedItem } from "../../lib/commandPublicApi";

type PublicScheduleFeedListProps = {
  title: string;
  items: CommandPublicScheduleFeedItem[];
};

function isInformationalFeedItem(item: CommandPublicScheduleFeedItem) {
  return (
    !item.occurrenceDate &&
    !item.resourceName &&
    !item.timeslot &&
    !item.locationId &&
    Boolean(item.participantName)
  );
}

function formatOccurrenceDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function PublicScheduleFeedList({ title, items }: PublicScheduleFeedListProps) {
  const informationalItem = items.length === 1 && isInformationalFeedItem(items[0]) ? items[0] : null;

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Feed</div>
          <h2 className="mt-2 text-xl font-semibold text-neutral-900">{title}</h2>
        </div>
        <div className="text-sm text-neutral-600">{informationalItem ? "Status" : `${items.length} entries`}</div>
      </div>

      <div className="mt-6 grid gap-3">
        {informationalItem ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm font-semibold text-neutral-700">
            {informationalItem.participantName}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-600">
            No feed entries are available for this range.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.occurrenceDate}-${item.locationId}-${item.participantName}-${index}`}
              className="grid gap-2 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {formatOccurrenceDate(item.occurrenceDate)}
                </div>
                <div className="text-sm font-semibold text-neutral-900">{item.timeslot}</div>
              </div>

              <div className="text-lg font-semibold text-neutral-900">{item.participantName}</div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                  {item.resourceName}
                </span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                  {item.locationId}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import BrandHead from "../../components/BrandHead";
import PublicSiteHeader from "../../components/PublicSiteHeader";
import PublicScheduleFeedList from "../../components/publicSchedule/PublicScheduleFeedList";
import {
  commandPublicGetScheduleFeed,
  commandPublicListScheduleCalendar,
  commandPublicListScheduleList,
  type CommandPublicScheduleFeedResponse,
  type CommandPublicScheduleItem,
  type CommandPublicScheduleParticipantType,
  type CommandPublicScheduleResourceType,
  type CommandPublicScheduleResponse,
} from "../../lib/commandPublicApi";

const PublicScheduleCalendar = dynamic(
  () => import("../../components/publicSchedule/PublicScheduleCalendar"),
  {
    ssr: false,
    loading: () => <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">Loading calendar...</div>,
  }
);

type PageProps = {
  initialCalendar: CommandPublicScheduleResponse;
  initialList: CommandPublicScheduleResponse;
  initialFeed: CommandPublicScheduleFeedResponse | null;
  initialFeedError: string | null;
  initialFilters: {
    from: string;
    to: string;
    eventSeries: string;
    participantType: string;
    resourceType: string;
  };
};

const participantTypeLabels: Record<CommandPublicScheduleParticipantType, string> = {
  ENTERTAINMENT: "Entertainment",
  FOOD_VENDOR: "Food Vendors",
  MARKET_VENDOR: "Market Vendors",
};

const resourceTypeLabels: Record<CommandPublicScheduleResourceType, string> = {
  STAGE: "Stages",
  FOOD_SPOT: "Food Spots",
  MARKET_SPOT: "Market Spots",
  OTHER: "Other Resources",
};

function toIsoDateOnly(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDateOnly(next);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function wallClockUtc(value: string, allDay: boolean) {
  if (allDay) return value;
  return value.endsWith("Z") ? value : `${value}Z`;
}

function eventColors(item: CommandPublicScheduleItem) {
  if (item.participant.type === "ENTERTAINMENT") {
    return {
      backgroundColor: "#dc2626",
      borderColor: "#b91c1c",
      textColor: "#ffffff",
    };
  }

  return {
    backgroundColor: "#111827",
    borderColor: "#111827",
    textColor: "#ffffff",
  };
}

export default function PublicSchedulePage({
  initialCalendar,
  initialList,
  initialFeed,
  initialFeedError,
  initialFilters,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [apiFilters, setApiFilters] = useState(initialFilters);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [localQuery, setLocalQuery] = useState("");
  const [calendarFeed, setCalendarFeed] = useState(initialCalendar);
  const [listFeed, setListFeed] = useState(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(initialList.items[0]?.id || initialCalendar.items[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allItems = useMemo(() => {
    const seen = new Map<string, CommandPublicScheduleItem>();
    for (const item of [...calendarFeed.items, ...listFeed.items]) {
      if (!seen.has(item.id)) seen.set(item.id, item);
    }
    return Array.from(seen.values());
  }, [calendarFeed.items, listFeed.items]);

  const eventSeriesOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allItems) map.set(item.eventSeries.slug, item.eventSeries.name);
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const calendarEvents = useMemo(() => {
    return calendarFeed.items
      .filter((item) => {
        const needle = localQuery.trim().toLowerCase();
        return (
          !needle ||
          [
            item.title,
            item.subtitle || "",
            item.description || "",
            item.locationLabel,
            item.eventSeries.name,
            item.resource.name,
            item.participant.displayName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        );
      })
      .map((item) => {
        const colors = eventColors(item);
        return {
          id: item.id,
          title: item.title,
          start: wallClockUtc(item.start, item.allDay),
          end: wallClockUtc(item.end, item.allDay),
          allDay: item.allDay,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          textColor: colors.textColor,
        };
      });
  }, [calendarFeed.items, localQuery]);

  const filteredListItems = useMemo(() => {
    const needle = localQuery.trim().toLowerCase();
    return listFeed.items.filter((item) => {
      return (
        !needle ||
        [
          item.title,
          item.subtitle || "",
          item.description || "",
          item.locationLabel,
          item.eventSeries.name,
          item.resource.name,
          item.participant.displayName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [listFeed.items, localQuery]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, CommandPublicScheduleItem[]>();
    for (const item of filteredListItems) {
      const list = map.get(item.occursOn) || [];
      list.push(item);
      map.set(item.occursOn, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredListItems]);

  const selectedItem =
    allItems.find((item) => item.id === selectedId) || filteredListItems[0] || calendarFeed.items[0] || null;

  const appliedFilterTrail = useMemo(() => {
    const seriesName =
      apiFilters.eventSeries
        ? eventSeriesOptions.find((item) => item.slug === apiFilters.eventSeries)?.name || apiFilters.eventSeries
        : "All Series";

    const participantLabel = apiFilters.participantType
      ? participantTypeLabels[apiFilters.participantType as CommandPublicScheduleParticipantType] || apiFilters.participantType
      : "All Participants";

    const resourceLabel = apiFilters.resourceType
      ? resourceTypeLabels[apiFilters.resourceType as CommandPublicScheduleResourceType] || apiFilters.resourceType
      : "All Resources";

    return [
      `${formatDateLabel(apiFilters.from)} - ${formatDateLabel(apiFilters.to)}`,
      seriesName,
      participantLabel,
      resourceLabel,
      localQuery.trim() ? `Search: ${localQuery.trim()}` : "Search: All",
    ];
  }, [apiFilters, eventSeriesOptions, localQuery]);

  async function loadSchedule(nextFilters = draftFilters) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);
      if (nextFilters.eventSeries) params.set("eventSeries", nextFilters.eventSeries);
      if (nextFilters.participantType) params.set("participantType", nextFilters.participantType);
      if (nextFilters.resourceType) params.set("resourceType", nextFilters.resourceType);

      const [calendarRes, listRes] = await Promise.all([
        fetch(`/api/schedule/calendar?${params.toString()}`),
        fetch(`/api/schedule/list?${params.toString()}`),
      ]);

      const [calendarPayload, listPayload] = await Promise.all([
        calendarRes.json().catch(() => null),
        listRes.json().catch(() => null),
      ]);

      if (!calendarRes.ok || !calendarPayload?.ok) {
        throw new Error(calendarPayload?.error || "Failed to load calendar");
      }
      if (!listRes.ok || !listPayload?.ok) {
        throw new Error(listPayload?.error || "Failed to load schedule list");
      }

      setApiFilters(nextFilters);
      setCalendarFeed(calendarPayload as CommandPublicScheduleResponse);
      setListFeed(listPayload as CommandPublicScheduleResponse);
      setSelectedId((current) => {
        const stillVisible = (listPayload.items as CommandPublicScheduleItem[]).find((item) => item.id === current);
        return stillVisible?.id || (listPayload.items as CommandPublicScheduleItem[])[0]?.id || (calendarPayload.items as CommandPublicScheduleItem[])[0]?.id || null;
      });
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BrandHead
        title="Events & Schedule — X Dragon"
        description="Browse upcoming entertainment, market vendors, and food vendors on the X Dragon schedule."
      />

      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <PublicSiteHeader />

        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-semibold uppercase tracking-[0.2em] text-red-600">Live Schedule</div>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-medium text-neutral-500">
              {appliedFilterTrail.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  {index > 0 ? <span className="text-neutral-300">/</span> : null}
                  <span className={index === 0 ? "font-semibold text-neutral-800" : undefined}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <section className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="grid gap-3 lg:grid-cols-5">
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">From</span>
                  <input
                    type="date"
                    value={draftFilters.from}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-red-200"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">To</span>
                  <input
                    type="date"
                    value={draftFilters.to}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-red-200"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Event Series</span>
                  <select
                    value={draftFilters.eventSeries}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, eventSeries: event.target.value }))}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">All series</option>
                    {eventSeriesOptions.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Participant Type</span>
                  <select
                    value={draftFilters.participantType}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, participantType: event.target.value }))}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">All types</option>
                    <option value="ENTERTAINMENT">Entertainment</option>
                    <option value="FOOD_VENDOR">Food vendors</option>
                    <option value="MARKET_VENDOR">Market vendors</option>
                  </select>
                </label>

                  <label className="grid gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Resource Type</span>
                    <select
                      value={draftFilters.resourceType}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, resourceType: event.target.value }))}
                      className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-red-200"
                    >
                      <option value="">All resources</option>
                      <option value="STAGE">Stages</option>
                      <option value="FOOD_SPOT">Food spots</option>
                      <option value="MARKET_SPOT">Market spots</option>
                    </select>
                  </label>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void loadSchedule()}
                    className="rounded-2xl bg-red-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-red-700"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Apply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reset = {
                        from: initialFilters.from,
                        to: initialFilters.to,
                        eventSeries: "",
                        participantType: "",
                        resourceType: "",
                      };
                      setDraftFilters(reset);
                      void loadSchedule(reset);
                    }}
                    className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    Reset
                  </button>
                </div>
            </div>
          </section>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] xl:items-start">
            <div className="grid gap-3">
              <PublicScheduleFeedList title="Friday Stage List" items={initialFeed?.items || []} />
              {initialFeedError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {initialFeedError}
                </div>
              ) : null}
            </div>

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <PublicScheduleCalendar
                events={calendarEvents}
                loading={loading}
                onRangeChange={(range) => {
                  if (range.from === apiFilters.from && range.to === apiFilters.to) return;
                  const nextFilters = { ...draftFilters, from: range.from, to: range.to };
                  setDraftFilters(nextFilters);
                  void loadSchedule(nextFilters);
                }}
                onEventOpen={(id) => setSelectedId(id)}
              />
            </section>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Search Loaded Results</div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-neutral-900">Search</span>
                  <input
                    value={localQuery}
                    onChange={(event) => setLocalQuery(event.target.value)}
                    placeholder="Filter by title, description, location, or participant"
                    className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <div className="text-sm text-neutral-600">{filteredListItems.length} visible entries</div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-neutral-900">Schedule List</h2>
                <div className="text-sm text-neutral-600">{filteredListItems.length} visible entries</div>
              </div>

              <div className="mt-6 grid gap-6">
                {groupedItems.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-600">
                    No schedule entries matched the current filters.
                  </div>
                ) : (
                  groupedItems.map(([occursOn, items]) => (
                    <div key={occursOn} className="grid gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">{formatDateLabel(occursOn)}</div>
                      <div className="grid gap-3">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            className={
                              item.id === selectedItem?.id
                                ? "grid gap-2 rounded-3xl border border-red-300 bg-red-50 p-5 text-left shadow-sm"
                                : "grid gap-2 rounded-3xl border border-neutral-200 bg-white p-5 text-left shadow-sm hover:bg-neutral-50"
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{item.eventSeries.name}</div>
                                <div className="mt-1 text-lg font-semibold text-neutral-900">{item.title}</div>
                                {item.subtitle ? <div className="mt-1 text-sm text-neutral-600">{item.subtitle}</div> : null}
                              </div>
                              <div className="text-right text-sm text-neutral-600">
                                <div className="font-semibold text-neutral-900">{item.timeLabel}</div>
                                <div>{item.locationLabel}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-600">
                              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">{item.participant.type.replace("_", " ")}</span>
                              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">{item.resource.name}</span>
                            </div>

                            {item.description ? <div className="text-sm leading-6 text-neutral-700">{item.description}</div> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <aside className="grid gap-6">
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Selected Entry</div>
                {selectedItem ? (
                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-red-600">{selectedItem.eventSeries.name}</div>
                      <h2 className="mt-2 text-2xl font-semibold text-neutral-900">{selectedItem.title}</h2>
                      {selectedItem.subtitle ? <div className="mt-2 text-sm text-neutral-600">{selectedItem.subtitle}</div> : null}
                    </div>

                    <div className="grid gap-2 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                      <div><span className="font-semibold text-neutral-900">Date:</span> {formatDateLabel(selectedItem.occursOn)}</div>
                      <div><span className="font-semibold text-neutral-900">Time:</span> {selectedItem.timeLabel}</div>
                      <div><span className="font-semibold text-neutral-900">Location:</span> {selectedItem.locationLabel}</div>
                      <div><span className="font-semibold text-neutral-900">Participant:</span> {selectedItem.participant.displayName}</div>
                      <div><span className="font-semibold text-neutral-900">Type:</span> {selectedItem.participant.type.replace("_", " ")}</div>
                      {selectedItem.sequence ? <div><span className="font-semibold text-neutral-900">Sequence:</span> {selectedItem.sequence}</div> : null}
                      <div><span className="font-semibold text-neutral-900">Timezone:</span> {selectedItem.timezone}</div>
                    </div>

                    {selectedItem.description ? (
                      <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700">
                        {selectedItem.description}
                      </div>
                    ) : null}

                    {selectedItem.url ? (
                      <a
                        href={selectedItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        Open website
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    Select a calendar entry or list row to inspect its details.
                  </div>
                )}
              </div>
            </aside>
          </section>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const today = toIsoDateOnly(new Date());
  const defaultFrom = typeof ctx.query.from === "string" && ctx.query.from ? ctx.query.from : today;
  const defaultTo = typeof ctx.query.to === "string" && ctx.query.to ? ctx.query.to : addDays(defaultFrom, 45);
  const initialFilters = {
    from: defaultFrom,
    to: defaultTo,
    eventSeries: typeof ctx.query.eventSeries === "string" ? ctx.query.eventSeries : "",
    participantType: typeof ctx.query.participantType === "string" ? ctx.query.participantType : "",
    resourceType: typeof ctx.query.resourceType === "string" ? ctx.query.resourceType : "",
  };

  const schedulePageFeedId = String(process.env.SCHEDULE_PAGE_FEED_ID || "").trim();
  const [initialCalendar, initialList] = await Promise.all([
    commandPublicListScheduleCalendar({
      from: initialFilters.from,
      to: initialFilters.to,
      eventSeries: initialFilters.eventSeries,
      participantType: initialFilters.participantType as CommandPublicScheduleParticipantType | "",
      resourceType: initialFilters.resourceType as CommandPublicScheduleResourceType | "",
      limit: 300,
    }),
    commandPublicListScheduleList({
      from: initialFilters.from,
      to: initialFilters.to,
      eventSeries: initialFilters.eventSeries,
      participantType: initialFilters.participantType as CommandPublicScheduleParticipantType | "",
      resourceType: initialFilters.resourceType as CommandPublicScheduleResourceType | "",
      limit: 150,
    }),
  ]);

  let initialFeed: CommandPublicScheduleFeedResponse | null = null;
  let initialFeedError: string | null = null;

  if (schedulePageFeedId) {
    try {
      initialFeed = await commandPublicGetScheduleFeed({
        feedId: schedulePageFeedId,
        request: ctx.req,
      });
    } catch (error: any) {
      initialFeedError = error?.message || "Failed to load schedule feed";
    }
  } else {
    initialFeedError = "Schedule feed is not configured.";
  }

  return {
    props: {
      initialCalendar,
      initialList,
      initialFeed,
      initialFeedError,
      initialFilters,
    },
  };
};

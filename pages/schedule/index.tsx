import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import BrandHead from "../../components/BrandHead";
import {
  commandPublicListScheduleCalendar,
  commandPublicListScheduleList,
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
  initialFilters: {
    from: string;
    to: string;
    eventSeries: string;
    participantType: string;
    resourceType: string;
    sequence: string;
  };
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
  initialFilters,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [apiFilters, setApiFilters] = useState(initialFilters);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [localQuery, setLocalQuery] = useState("");
  const [localLocation, setLocalLocation] = useState("ALL");
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

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) set.add(item.locationLabel);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const calendarEvents = useMemo(() => {
    return calendarFeed.items
      .filter((item) => {
        const needle = localQuery.trim().toLowerCase();
        const matchesQuery =
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
            .includes(needle);
        const matchesLocation = localLocation === "ALL" ? true : item.locationLabel === localLocation;
        return matchesQuery && matchesLocation;
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
  }, [calendarFeed.items, localLocation, localQuery]);

  const filteredListItems = useMemo(() => {
    const needle = localQuery.trim().toLowerCase();
    return listFeed.items.filter((item) => {
      const matchesQuery =
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
          .includes(needle);
      const matchesLocation = localLocation === "ALL" ? true : item.locationLabel === localLocation;
      return matchesQuery && matchesLocation;
    });
  }, [listFeed.items, localLocation, localQuery]);

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
      if (nextFilters.sequence) params.set("sequence", nextFilters.sequence);

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
        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="X Dragon logo" className="h-11 w-auto" />
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">X Dragon</div>
                <div className="text-lg font-semibold text-neutral-900">Events & Schedule</div>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                Home
              </Link>
              <a href="/#contact" className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Contact
              </a>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <section className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1.3fr,0.7fr] lg:items-end">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-red-600">Live Schedule</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                  Browse upcoming events, lineups, and vendor placements
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
                  This page reads directly from the Command scheduling service. API-backed filters control what the server returns, and local refine filters let visitors narrow what is already on screen without another request.
                </p>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Current Range</div>
                <div className="mt-2 text-lg font-semibold text-neutral-900">
                  {formatDateLabel(calendarFeed.range.from)} - {formatDateLabel(calendarFeed.range.to)}
                </div>
                <div className="mt-2 text-sm text-neutral-600">
                  Showing {calendarFeed.items.length} calendar entries and {listFeed.items.length} list entries.
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">From</span>
                <input
                  type="date"
                  value={draftFilters.from}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">To</span>
                <input
                  type="date"
                  value={draftFilters.to}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Event Series</span>
                <select
                  value={draftFilters.eventSeries}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, eventSeries: event.target.value }))}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All series</option>
                  {eventSeriesOptions.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Participant Type</span>
                <select
                  value={draftFilters.participantType}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, participantType: event.target.value }))}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All types</option>
                  <option value="ENTERTAINMENT">Entertainment</option>
                  <option value="FOOD_VENDOR">Food vendors</option>
                  <option value="MARKET_VENDOR">Market vendors</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Resource Type</span>
                <select
                  value={draftFilters.resourceType}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, resourceType: event.target.value }))}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All resources</option>
                  <option value="STAGE">Stages</option>
                  <option value="FOOD_SPOT">Food spots</option>
                  <option value="MARKET_SPOT">Market spots</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Sequence</span>
                <input
                  value={draftFilters.sequence}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, sequence: event.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                  placeholder="Optional"
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadSchedule()}
                  className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Apply Filters"}
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
                      sequence: "",
                    };
                    setDraftFilters(reset);
                    void loadSchedule(reset);
                  }}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Refine On Page</span>
                <input
                  value={localQuery}
                  onChange={(event) => setLocalQuery(event.target.value)}
                  placeholder="Filter loaded results by title, description, location, or participant..."
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Location Refine</span>
                <select
                  value={localLocation}
                  onChange={(event) => setLocalLocation(event.target.value)}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="ALL">All locations</option>
                  {locationOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          </section>

          <section className="grid gap-8 xl:grid-cols-[1.35fr,0.65fr]">
            <div className="grid gap-6">
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
                                {item.sequence ? <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">Sequence {item.sequence}</span> : null}
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
                        Open details
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    Select a calendar entry or list row to inspect its details.
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">How This Page Works</div>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-neutral-700">
                  <p>
                    Primary filters change what the website requests from Command.
                  </p>
                  <p>
                    Refine filters narrow the results already loaded into the browser.
                  </p>
                  <p>
                    Entertainment entries use timed slots. Vendor entries represent full-day placement windows.
                  </p>
                </div>
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
    sequence: typeof ctx.query.sequence === "string" ? ctx.query.sequence : "",
  };

  const [initialCalendar, initialList] = await Promise.all([
    commandPublicListScheduleCalendar({
      from: initialFilters.from,
      to: initialFilters.to,
      eventSeries: initialFilters.eventSeries,
      participantType: initialFilters.participantType as CommandPublicScheduleParticipantType | "",
      resourceType: initialFilters.resourceType as CommandPublicScheduleResourceType | "",
      sequence: initialFilters.sequence || undefined,
      limit: 300,
    }),
    commandPublicListScheduleList({
      from: initialFilters.from,
      to: initialFilters.to,
      eventSeries: initialFilters.eventSeries,
      participantType: initialFilters.participantType as CommandPublicScheduleParticipantType | "",
      resourceType: initialFilters.resourceType as CommandPublicScheduleResourceType | "",
      sequence: initialFilters.sequence || undefined,
      limit: 150,
    }),
  ]);

  return {
    props: {
      initialCalendar,
      initialList,
      initialFilters,
    },
  };
};

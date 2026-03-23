import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { useMemo, useRef, useState } from "react";

export type PublicScheduleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

export default function PublicScheduleCalendar({
  events,
  loading,
  onRangeChange,
  onEventOpen,
}: {
  events: PublicScheduleCalendarEvent[];
  loading: boolean;
  onRangeChange: (range: { from: string; to: string; title: string; view: CalendarView }) => void;
  onEventOpen: (id: string) => void;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [currentView, setCurrentView] = useState<CalendarView>("dayGridMonth");
  const [title, setTitle] = useState("");

  const viewButtons = useMemo(
    () =>
      [
        { id: "dayGridMonth", label: "Month" },
        { id: "timeGridWeek", label: "Week" },
        { id: "timeGridDay", label: "Day" },
      ] as Array<{ id: CalendarView; label: string }>,
    []
  );

  function formatUtcDate(value: Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }

  function goTo(action: "prev" | "next" | "today") {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (action === "prev") api.prev();
    if (action === "next") api.next();
    if (action === "today") api.today();
  }

  function changeView(view: CalendarView) {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(view);
  }

  function handleDatesSet(arg: DatesSetArg) {
    const inclusiveEnd = new Date(arg.end.getTime() - 86400000);
    const nextView = arg.view.type as CalendarView;
    setCurrentView(nextView);
    setTitle(arg.view.title);
    onRangeChange({
      from: formatUtcDate(arg.start),
      to: formatUtcDate(inclusiveEnd),
      title: arg.view.title,
      view: nextView,
    });
  }

  function handleEventClick(arg: EventClickArg) {
    onEventOpen(arg.event.id);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => goTo("prev")} className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
            Prev
          </button>
          <button type="button" onClick={() => goTo("today")} className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
            Today
          </button>
          <button type="button" onClick={() => goTo("next")} className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
            Next
          </button>
        </div>

        <div className="text-lg font-semibold text-neutral-900">{title || "Schedule"}</div>

        <div className="flex flex-wrap gap-2">
          {viewButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              onClick={() => changeView(button.id)}
              className={
                currentView === button.id
                  ? "rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  : "rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              }
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm text-neutral-600">
        Calendar times are shown in the schedule&apos;s event-local wall clock, not converted to the visitor&apos;s browser timezone.
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm font-semibold text-neutral-700">
            Loading calendar...
          </div>
        ) : null}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          timeZone="UTC"
          headerToolbar={false}
          editable={false}
          selectable={false}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          events={events}
          height={760}
          nowIndicator
          dayMaxEvents
          weekends
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          scrollTime="08:00:00"
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
        />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  CommandEntertainmentPartnerApplicationPayload,
  CommandFoodPartnerApplicationPayload,
  CommandMarketPartnerApplicationPayload,
  CommandPartnerApplicationPayload,
  CommandPartnerEntertainmentGenre,
  CommandPartnerPortalAccount,
  CommandPartnerPortalApplication,
  CommandPartnerPortalEventOption,
  CommandPartnerPortalProfile,
  CommandPartnerPortalRequirement,
  CommandPartnerPortalRequirementsPayload,
  CommandPartnerPortalScope,
  CommandParticipantPortalProfile,
  CommandSponsorPartnerApplicationPayload,
} from "../../lib/commandPublicApi";
import {
  COMMAND_PARTNER_ENTERTAINMENT_ACT_TYPE_OPTIONS,
  COMMAND_PARTNER_ENTERTAINMENT_GENRE_OPTIONS,
} from "../../lib/commandPublicApi";
import PortalNav from "./PortalNav";
import PortalPhoneField, { buildPortalPhoneInputState, serializePortalPhoneInputState } from "./PortalPhoneField";
import PortalShell from "./PortalShell";
import { PORTAL_CONFIG } from "./portalConfig";

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "IN_REVIEW") return "bg-amber-100 text-amber-800";
  if (status === "SUBMITTED") return "bg-blue-100 text-blue-800";
  return "bg-neutral-100 text-neutral-700";
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not provided";
}

function urlOrText(value: string | null) {
  if (!value) return "Not provided";
  return (
    <a href={value} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2">
      {value}
    </a>
  );
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function listValue(values: string[] | null | undefined) {
  return values && values.length > 0 ? values.join(", ") : "Not provided";
}

function profileSocialUrl(profile: CommandPartnerPortalProfile | null, key: string) {
  return profile?.socialLinks?.[key] || null;
}

function buildApplicationDraft(
  profile: CommandPartnerPortalProfile,
  event: CommandPartnerPortalEventOption
): CommandPartnerApplicationPayload {
  if (profile.kind === "SPONSOR") {
    return {
      formType: "SPONSOR",
      mainContact: profile.contactName,
      email: profile.account.email,
      phone: profile.contactPhone,
      companyOrOrganization: profile.displayName,
      websiteUrl: profile.mainWebsiteUrl || null,
      organizationBackground: profile.description || "",
    };
  }

  if (profile.participantType === "ENTERTAINMENT") {
    return {
      formType: "ENTERTAINMENT",
      typeOfAct:
        (profile.entertainmentActType as CommandEntertainmentPartnerApplicationPayload["typeOfAct"] | null) ||
        COMMAND_PARTNER_ENTERTAINMENT_ACT_TYPE_OPTIONS[0],
      performerName: profile.displayName,
      mainContact: profile.contactName,
      email: profile.account.email,
      phone: profile.contactPhone,
      citiesOfResidence: [],
      shortBio: profile.summary || profile.description || "",
      genres: (profile.entertainmentGenres.filter((genre) =>
        COMMAND_PARTNER_ENTERTAINMENT_GENRE_OPTIONS.includes(genre as CommandPartnerEntertainmentGenre)
      ) as CommandPartnerEntertainmentGenre[]) || [],
      preferredStageId: event.applicationFormOptions.stageOptions[0]?.id || "",
      preferredStageName: event.applicationFormOptions.stageOptions[0]?.name || "",
      songList: "",
      typicalPerformanceFeeRange: "",
      availableOccurrenceDates: [],
      canCommitToEarlyDropoffAndSoundcheck: false,
      instagramUrl: profileSocialUrl(profile, "instagram"),
      facebookUrl: profileSocialUrl(profile, "facebook"),
      livePerformanceVideoUrl: profileSocialUrl(profile, "youtube"),
      streamingUrl: profileSocialUrl(profile, "spotify") || profileSocialUrl(profile, "soundcloud"),
      websiteUrl: profile.mainWebsiteUrl || null,
      otherChannelUrl: null,
      willShareEvent: false,
      fanbaseSummary: "",
      agreementAccepted: false,
    };
  }

  const marketBaseline: CommandMarketPartnerApplicationPayload = {
    formType: profile.participantType === "FOOD_VENDOR" ? "MARKET_VENDOR" : "MARKET_VENDOR",
    businessName: profile.displayName,
    mainContact: profile.contactName,
    email: profile.account.email,
    phone: profile.contactPhone,
    websiteUrl: profile.mainWebsiteUrl || null,
    brandDescription: profile.description || profile.summary || "",
    productCategory:
      profile.participantType === "MARKET_VENDOR"
        ? profile.marketType ? humanize(profile.marketType) : ""
        : profile.foodStyle || "",
    productDescription: profile.summary || profile.description || "",
    instagramUrl: profileSocialUrl(profile, "instagram"),
    facebookUrl: profileSocialUrl(profile, "facebook"),
    otherSocialUrl: profileSocialUrl(profile, "youtube") || profileSocialUrl(profile, "spotify") || profileSocialUrl(profile, "soundcloud"),
    availableOccurrenceDates: [],
    sharesAtOtherEvents: false,
    hasBusinessLicense: false,
    hasLiabilityInsurance: false,
    hasFireproofCanopy: false,
    canCommitToLoadInTiming: false,
    canCommitToLoadOutTiming: false,
    preScreeningAgreementAccepted: false,
    policiesAccepted: false,
  };

  if (profile.participantType === "FOOD_VENDOR") {
    return {
      ...marketBaseline,
      formType: "FOOD_VENDOR",
      foodServiceStyle: profile.foodStyle || "",
      foodSetupType: profile.foodSetupType || "TRUCK",
      acknowledgesBusinessLicenseRequired: false,
      acknowledgesHealthPermitRequired: false,
      acknowledgesBusinessInsuranceRequired: false,
      acknowledgesFirePermitRequired: false,
    };
  }

  return marketBaseline;
}

function toggleListValue(values: string[], nextValue: string) {
  return values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];
}

type ApplicationField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

type ApplicationSection = {
  title: string;
  fields: ApplicationField[];
};

function applicationSections(application: CommandPartnerPortalApplication): ApplicationSection[] {
  const payload = application.applicationPayload;
  if (!payload) {
    return [
      {
        title: "Application Details",
        fields: [{ label: "Payload", value: "This application predates the structured event application form.", fullWidth: true }],
      },
    ];
  }

  if (payload.formType === "ENTERTAINMENT") {
    return [
      {
        title: "Performance Details",
        fields: [
          { label: "Type of Act", value: humanize(payload.typeOfAct) },
          { label: "Performer Name", value: payload.performerName },
          { label: "Main Contact", value: payload.mainContact },
          { label: "Email", value: payload.email },
          { label: "Phone", value: payload.phone },
          { label: "Cities of Residence", value: listValue(payload.citiesOfResidence), fullWidth: true },
          { label: "Genres", value: listValue(payload.genres), fullWidth: true },
          { label: "Preferred Stage", value: payload.preferredStageName },
          { label: "Available Dates", value: listValue(payload.availableOccurrenceDates), fullWidth: true },
          { label: "Short Bio", value: payload.shortBio, fullWidth: true },
          { label: "Song List", value: payload.songList, fullWidth: true },
          { label: "Typical Fee Range", value: payload.typicalPerformanceFeeRange },
          { label: "Fanbase Summary", value: payload.fanbaseSummary, fullWidth: true },
          { label: "Website", value: urlOrText(payload.websiteUrl) },
          { label: "Instagram", value: urlOrText(payload.instagramUrl) },
          { label: "Facebook", value: urlOrText(payload.facebookUrl) },
          { label: "Live Performance Video", value: urlOrText(payload.livePerformanceVideoUrl) },
          { label: "Streaming", value: urlOrText(payload.streamingUrl) },
          { label: "Other Channel", value: urlOrText(payload.otherChannelUrl) },
          { label: "Early Dropoff / Soundcheck", value: yesNo(payload.canCommitToEarlyDropoffAndSoundcheck) },
          { label: "Will Share Event", value: yesNo(payload.willShareEvent) },
          { label: "Agreement Accepted", value: yesNo(payload.agreementAccepted) },
        ],
      },
    ];
  }

  if (payload.formType === "FOOD_VENDOR") {
    return [
      {
        title: "Business & Offering",
        fields: [
          { label: "Business Name", value: payload.businessName },
          { label: "Main Contact", value: payload.mainContact },
          { label: "Email", value: payload.email },
          { label: "Phone", value: payload.phone },
          { label: "Website", value: urlOrText(payload.websiteUrl) },
          { label: "Food Service Style", value: payload.foodServiceStyle },
          { label: "Food Setup Type", value: humanize(payload.foodSetupType) },
          { label: "Product Category", value: payload.productCategory },
          { label: "Brand Description", value: payload.brandDescription, fullWidth: true },
          { label: "Product Description", value: payload.productDescription, fullWidth: true },
          { label: "Available Dates", value: listValue(payload.availableOccurrenceDates), fullWidth: true },
          { label: "Instagram", value: urlOrText(payload.instagramUrl) },
          { label: "Facebook", value: urlOrText(payload.facebookUrl) },
          { label: "Other Social", value: urlOrText(payload.otherSocialUrl) },
          { label: "Shares At Other Events", value: yesNo(payload.sharesAtOtherEvents) },
          { label: "Has Business License", value: yesNo(payload.hasBusinessLicense) },
          { label: "Has Liability Insurance", value: yesNo(payload.hasLiabilityInsurance) },
          { label: "Has Fireproof Canopy", value: yesNo(payload.hasFireproofCanopy) },
          { label: "Can Commit To Load-In", value: yesNo(payload.canCommitToLoadInTiming) },
          { label: "Can Commit To Load-Out", value: yesNo(payload.canCommitToLoadOutTiming) },
          { label: "Pre-Screening Agreement", value: yesNo(payload.preScreeningAgreementAccepted) },
          { label: "Policies Accepted", value: yesNo(payload.policiesAccepted) },
          { label: "Business License Required", value: yesNo(payload.acknowledgesBusinessLicenseRequired) },
          { label: "Health Permit Required", value: yesNo(payload.acknowledgesHealthPermitRequired) },
          { label: "Business Insurance Required", value: yesNo(payload.acknowledgesBusinessInsuranceRequired) },
          { label: "Fire Permit Required", value: yesNo(payload.acknowledgesFirePermitRequired) },
        ],
      },
    ];
  }

  if (payload.formType === "MARKET_VENDOR") {
    return [
      {
        title: "Business & Offering",
        fields: [
          { label: "Business Name", value: payload.businessName },
          { label: "Main Contact", value: payload.mainContact },
          { label: "Email", value: payload.email },
          { label: "Phone", value: payload.phone },
          { label: "Website", value: urlOrText(payload.websiteUrl) },
          { label: "Product Category", value: payload.productCategory },
          { label: "Brand Description", value: payload.brandDescription, fullWidth: true },
          { label: "Product Description", value: payload.productDescription, fullWidth: true },
          { label: "Available Dates", value: listValue(payload.availableOccurrenceDates), fullWidth: true },
          { label: "Instagram", value: urlOrText(payload.instagramUrl) },
          { label: "Facebook", value: urlOrText(payload.facebookUrl) },
          { label: "Other Social", value: urlOrText(payload.otherSocialUrl) },
          { label: "Shares At Other Events", value: yesNo(payload.sharesAtOtherEvents) },
          { label: "Has Business License", value: yesNo(payload.hasBusinessLicense) },
          { label: "Has Liability Insurance", value: yesNo(payload.hasLiabilityInsurance) },
          { label: "Has Fireproof Canopy", value: yesNo(payload.hasFireproofCanopy) },
          { label: "Can Commit To Load-In", value: yesNo(payload.canCommitToLoadInTiming) },
          { label: "Can Commit To Load-Out", value: yesNo(payload.canCommitToLoadOutTiming) },
          { label: "Pre-Screening Agreement", value: yesNo(payload.preScreeningAgreementAccepted) },
          { label: "Policies Accepted", value: yesNo(payload.policiesAccepted) },
        ],
      },
    ];
  }

  return [
    {
      title: "Sponsor Application",
      fields: [
        { label: "Company / Organization", value: payload.companyOrOrganization },
        { label: "Main Contact", value: payload.mainContact },
        { label: "Email", value: payload.email },
        { label: "Phone", value: payload.phone },
        { label: "Website", value: urlOrText(payload.websiteUrl) },
        { label: "Organization Background", value: payload.organizationBackground, fullWidth: true },
      ],
    },
  ];
}

function RequirementSummary(props: { requirements: CommandPartnerPortalRequirement[] }) {
  const outstanding = props.requirements.filter((entry) => entry.state !== "APPROVED");

  if (props.requirements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-600">
        No post-approval document requirements apply for this partner type in v1.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-neutral-900">Discrepancies</div>
      <div className="mt-1 text-sm text-neutral-600">
        {outstanding.length} outstanding requirement{outstanding.length === 1 ? "" : "s"} across {props.requirements.length} applicable document type{props.requirements.length === 1 ? "" : "s"}.
      </div>
      <div className="mt-3 grid gap-2">
        {props.requirements.map((requirement) => (
          <div key={requirement.requirementType} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="text-sm text-neutral-800">{humanize(requirement.requirementType)}</span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(requirement.state)}`}>
              {humanize(requirement.state)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-neutral-500">Manage supporting documents from the Profile page.</div>
    </div>
  );
}

export default function PortalApplicationsPage(props: {
  scope: CommandPartnerPortalScope;
  account: CommandPartnerPortalAccount;
}) {
  const config = PORTAL_CONFIG[props.scope];
  const [profile, setProfile] = useState<CommandPartnerPortalProfile | null>(null);
  const [applications, setApplications] = useState<CommandPartnerPortalApplication[]>([]);
  const [availableEvents, setAvailableEvents] = useState<CommandPartnerPortalEventOption[]>([]);
  const [requirementsPayload, setRequirementsPayload] = useState<CommandPartnerPortalRequirementsPayload | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [draft, setDraft] = useState<CommandPartnerApplicationPayload | null>(null);
  const [applicationPhoneState, setApplicationPhoneState] = useState(() => buildPortalPhoneInputState(""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const requests = [
        fetch(`/api/bff/${props.scope}/applications`),
        fetch(`/api/bff/${props.scope}/profile`),
      ];
      if (props.scope === "partners") {
        requests.push(fetch("/api/bff/partners/requirements"));
      }
      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));

      const unauthorizedResponse = responses.find((response) => response.status === 401);
      if (unauthorizedResponse) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }

      if (!responses[0].ok || !(payloads[0] as any)?.ok) {
        throw new Error((payloads[0] as any)?.error || "Failed to load applications.");
      }
      if (!responses[1].ok || !(payloads[1] as any)?.ok) {
        throw new Error((payloads[1] as any)?.error || "Failed to load profile.");
      }
      if (props.scope === "partners" && (!responses[2]?.ok || !(payloads[2] as any)?.ok)) {
        throw new Error((payloads[2] as any)?.error || "Failed to load discrepancies.");
      }

      setApplications(((payloads[0] as any).applications || []) as CommandPartnerPortalApplication[]);
      setAvailableEvents(((payloads[0] as any).availableEvents || []) as CommandPartnerPortalEventOption[]);
      setProfile((payloads[1] as any).profile as CommandPartnerPortalProfile);
      setRequirementsPayload(props.scope === "partners" ? ((payloads[2] as any) as CommandPartnerPortalRequirementsPayload) : null);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.scope]);

  const blockedEventIds = useMemo(() => {
    return new Set(
      applications
        .filter((application) => ["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(application.status))
        .map((application) => application.event.id)
    );
  }, [applications]);

  const selectedEvent = useMemo(() => {
    return availableEvents.find((event) => event.id === selectedEventId) || null;
  }, [availableEvents, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (availableEvents.some((event) => event.id === selectedEventId)) return;
    setSelectedEventId("");
  }, [availableEvents, selectedEventId]);

  useEffect(() => {
    if (!profile || !selectedEvent) {
      setDraft(null);
      setApplicationPhoneState(buildPortalPhoneInputState(""));
      return;
    }
    const nextDraft = buildApplicationDraft(profile, selectedEvent);
    setDraft(nextDraft);
    setApplicationPhoneState(buildPortalPhoneInputState(nextDraft.phone));
  }, [profile, selectedEvent]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch(`/api/bff/${props.scope}/auth/logout`, { method: "POST" });
    } finally {
      window.location.assign(`/${props.scope}/signin`);
    }
  }

  function updateDraftField(field: string, value: unknown) {
    setDraft((current) => (current ? ({ ...current, [field]: value } as CommandPartnerApplicationPayload) : current));
  }

  function toggleDraftListField(field: string, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const currentValues = Array.isArray((current as Record<string, unknown>)[field])
        ? ((current as Record<string, unknown>)[field] as string[])
        : [];
      return {
        ...current,
        [field]: toggleListValue(currentValues, value),
      } as CommandPartnerApplicationPayload;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedEventId || !selectedEvent) {
      setError("Please select an event.");
      return;
    }
    if (!draft) {
      setError("Select an event to load the application form.");
      return;
    }

    const serializedPhone = serializePortalPhoneInputState(applicationPhoneState);
    if (!serializedPhone) {
      setError("Phone is required.");
      return;
    }

    const payload = {
      ...draft,
      phone: serializedPhone,
    } as CommandPartnerApplicationPayload;

    setSaving(true);
    try {
      const response = await fetch(`/api/bff/${props.scope}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleEventSeriesId: selectedEventId,
          applicationPayload: payload,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "Failed to submit application.");
      }
      setSelectedEventId("");
      setDraft(null);
      setApplicationPhoneState(buildPortalPhoneInputState(""));
      setNotice("Application submitted.");
      await load();
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to submit application.");
    } finally {
      setSaving(false);
    }
  }

  const participantProfile = profile?.kind === "PARTICIPANT" ? (profile as CommandParticipantPortalProfile) : null;

  return (
    <PortalShell title={config.applicationsHeading} subtitle={config.subtitle} width="wide">
      <div className="grid gap-6">
        <PortalNav
          scope={props.scope}
          active="applications"
          displayName={profile?.displayName || props.account.displayName}
          onSignOut={handleSignOut}
          busy={signingOut}
        />

        {loading ? <div className="text-sm text-neutral-600">Loading applications...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

        {requirementsPayload ? <RequirementSummary requirements={requirementsPayload.requirements} /> : null}

        <form className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Active event</label>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Select an event</option>
              {availableEvents.map((event) => (
                <option key={event.id} value={event.id} disabled={blockedEventIds.has(event.id)}>
                  {event.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-neutral-600">
              All active events in the current brand are available in v1. Existing submitted, in-review, or approved applications for the same event cannot be duplicated.
            </div>
          </div>

          {selectedEvent && draft ? (
            <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="grid gap-1">
                <div className="text-base font-semibold text-neutral-900">{selectedEvent.name}</div>
                <div className="text-sm text-neutral-600">
                  {new Date(selectedEvent.seasonStartsOn).toLocaleDateString()} - {new Date(selectedEvent.seasonEndsOn).toLocaleDateString()}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Main contact</label>
                  <input
                    value={(draft as any).mainContact || ""}
                    onChange={(event) => updateDraftField("mainContact", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    value={(draft as any).email || ""}
                    onChange={(event) => updateDraftField("email", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <PortalPhoneField label="Phone" state={applicationPhoneState} onChange={setApplicationPhoneState} />
                <div>
                  <label className="text-sm font-medium">Website</label>
                  <input
                    value={(draft as any).websiteUrl || ""}
                    onChange={(event) => updateDraftField("websiteUrl", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {draft.formType === "ENTERTAINMENT" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Performer name</label>
                      <input
                        value={draft.performerName}
                        onChange={(event) => updateDraftField("performerName", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type of act</label>
                      <select
                        value={draft.typeOfAct}
                        onChange={(event) => updateDraftField("typeOfAct", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        {COMMAND_PARTNER_ENTERTAINMENT_ACT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {humanize(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Cities of residence</label>
                      <input
                        value={draft.citiesOfResidence.join(", ")}
                        onChange={(event) =>
                          updateDraftField(
                            "citiesOfResidence",
                            event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean)
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="North Vancouver, Burnaby"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Genres</label>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {COMMAND_PARTNER_ENTERTAINMENT_GENRE_OPTIONS.map((genre) => (
                          <label key={genre} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={draft.genres.includes(genre)}
                              onChange={() => toggleDraftListField("genres", genre)}
                            />
                            {humanize(genre)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Short bio</label>
                      <textarea
                        value={draft.shortBio}
                        onChange={(event) => updateDraftField("shortBio", event.target.value)}
                        className="mt-1 min-h-[110px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Preferred stage</label>
                      <select
                        value={draft.preferredStageId}
                        onChange={(event) => {
                          const option = selectedEvent.applicationFormOptions.stageOptions.find((entry) => entry.id === event.target.value) || null;
                          updateDraftField("preferredStageId", event.target.value);
                          updateDraftField("preferredStageName", option?.name || "");
                        }}
                        className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="">Select a stage</option>
                        {selectedEvent.applicationFormOptions.stageOptions.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Typical performance fee range</label>
                      <input
                        value={draft.typicalPerformanceFeeRange}
                        onChange={(event) => updateDraftField("typicalPerformanceFeeRange", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Song list</label>
                      <textarea
                        value={draft.songList}
                        onChange={(event) => updateDraftField("songList", event.target.value)}
                        className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Available dates</label>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {selectedEvent.applicationFormOptions.occurrenceDateOptions.map((option) => (
                          <label key={option.occurrenceId} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={draft.availableOccurrenceDates.includes(option.occursOn)}
                              onChange={() => toggleDraftListField("availableOccurrenceDates", option.occursOn)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Fanbase summary</label>
                      <textarea
                        value={draft.fanbaseSummary}
                        onChange={(event) => updateDraftField("fanbaseSummary", event.target.value)}
                        className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Instagram URL</label>
                      <input value={draft.instagramUrl || ""} onChange={(event) => updateDraftField("instagramUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Facebook URL</label>
                      <input value={draft.facebookUrl || ""} onChange={(event) => updateDraftField("facebookUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Live performance video URL</label>
                      <input value={draft.livePerformanceVideoUrl || ""} onChange={(event) => updateDraftField("livePerformanceVideoUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Streaming URL</label>
                      <input value={draft.streamingUrl || ""} onChange={(event) => updateDraftField("streamingUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Other channel URL</label>
                      <input value={draft.otherChannelUrl || ""} onChange={(event) => updateDraftField("otherChannelUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {[
                      { field: "canCommitToEarlyDropoffAndSoundcheck", label: "I can commit to early dropoff and soundcheck requirements." },
                      { field: "willShareEvent", label: "I will actively share and promote the event." },
                      { field: "agreementAccepted", label: "I agree to the event participation terms for this application." },
                    ].map((item) => (
                      <label key={item.field} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={Boolean((draft as Record<string, unknown>)[item.field])}
                          onChange={(event) => updateDraftField(item.field, event.target.checked)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {draft.formType === "MARKET_VENDOR" || draft.formType === "FOOD_VENDOR" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Business name</label>
                      <input value={draft.businessName} onChange={(event) => updateDraftField("businessName", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Product category</label>
                      <input value={draft.productCategory} onChange={(event) => updateDraftField("productCategory", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    {draft.formType === "FOOD_VENDOR" ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Food service style</label>
                          <input value={draft.foodServiceStyle} onChange={(event) => updateDraftField("foodServiceStyle", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Food setup type</label>
                          <select value={draft.foodSetupType} onChange={(event) => updateDraftField("foodSetupType", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black">
                            <option value="TRUCK">Truck</option>
                            <option value="TRAILER">Trailer</option>
                            <option value="CART">Cart</option>
                            <option value="STAND">Stand</option>
                          </select>
                        </div>
                      </>
                    ) : null}
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Brand description</label>
                      <textarea value={draft.brandDescription} onChange={(event) => updateDraftField("brandDescription", event.target.value)} className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Product description</label>
                      <textarea value={draft.productDescription} onChange={(event) => updateDraftField("productDescription", event.target.value)} className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Instagram URL</label>
                      <input value={draft.instagramUrl || ""} onChange={(event) => updateDraftField("instagramUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Facebook URL</label>
                      <input value={draft.facebookUrl || ""} onChange={(event) => updateDraftField("facebookUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Other social URL</label>
                      <input value={draft.otherSocialUrl || ""} onChange={(event) => updateDraftField("otherSocialUrl", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Available dates</label>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {selectedEvent.applicationFormOptions.occurrenceDateOptions.map((option) => (
                          <label key={option.occurrenceId} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={draft.availableOccurrenceDates.includes(option.occursOn)}
                              onChange={() => toggleDraftListField("availableOccurrenceDates", option.occursOn)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {[
                      { field: "sharesAtOtherEvents", label: "I participate in other events and markets." },
                      { field: "hasBusinessLicense", label: "I understand a business license is required for participation." },
                      { field: "hasLiabilityInsurance", label: "I understand liability insurance is required for participation." },
                      { field: "hasFireproofCanopy", label: "I have a fire-proof tent or canopy where required." },
                      { field: "canCommitToLoadInTiming", label: "I can commit to the event load-in timing requirements." },
                      { field: "canCommitToLoadOutTiming", label: "I can commit to the event load-out timing requirements." },
                      { field: "preScreeningAgreementAccepted", label: "I agree to pre-screening and product review requirements." },
                      { field: "policiesAccepted", label: "I agree to the event policies and participation rules." },
                    ].map((item) => (
                      <label key={item.field} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={Boolean((draft as Record<string, unknown>)[item.field])}
                          onChange={(event) => updateDraftField(item.field, event.target.checked)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                    {draft.formType === "FOOD_VENDOR"
                      ? [
                          { field: "acknowledgesBusinessLicenseRequired", label: "I understand a business license must be uploaded to my profile." },
                          { field: "acknowledgesHealthPermitRequired", label: "I understand a health permit must be uploaded to my profile." },
                          { field: "acknowledgesBusinessInsuranceRequired", label: "I understand proof of business insurance must be uploaded to my profile." },
                          { field: "acknowledgesFirePermitRequired", label: "I understand a fire permit may be required and must be uploaded to my profile." },
                        ].map((item) => (
                          <label key={item.field} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean((draft as Record<string, unknown>)[item.field])}
                              onChange={(event) => updateDraftField(item.field, event.target.checked)}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))
                      : null}
                  </div>
                </>
              ) : null}

              {draft.formType === "SPONSOR" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Company or organization</label>
                    <input value={draft.companyOrOrganization} onChange={(event) => updateDraftField("companyOrOrganization", event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Organization background</label>
                    <textarea value={draft.organizationBackground} onChange={(event) => updateDraftField("organizationBackground", event.target.value)} className="mt-1 min-h-[120px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || !selectedEventId || !draft}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Submitting..." : config.applicationCtaLabel}
          </button>
        </form>

        <div className="grid gap-3">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              No applications submitted yet.
            </div>
          ) : (
            applications.map((application) => (
              <details key={application.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="grid gap-1">
                      <div className="text-base font-semibold text-neutral-900">{application.event.name}</div>
                      <div className="text-sm text-neutral-600">
                        Submitted {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : "not yet"}
                        {application.approvedAt ? ` · Approved ${new Date(application.approvedAt).toLocaleDateString()}` : ""}
                        {application.rejectedAt ? ` · Rejected ${new Date(application.rejectedAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                      {application.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </summary>

                <div className="mt-4 grid gap-4">
                  {applicationSections(application).map((section) => (
                    <div key={section.title} className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-sm font-semibold text-neutral-900">{section.title}</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {section.fields.map((field) => (
                          <div key={`${section.title}:${field.label}`} className={field.fullWidth ? "rounded-xl border border-neutral-200 bg-white p-3 md:col-span-2" : "rounded-xl border border-neutral-200 bg-white p-3"}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{field.label}</div>
                            <div className="mt-1 text-sm leading-6 text-neutral-800">{field.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-900">External Notes</div>
                    {application.externalNotes.length === 0 ? (
                      <div className="text-sm text-neutral-600">No external notes yet.</div>
                    ) : (
                      application.externalNotes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              {note.authorDisplayName || "Event team"}
                            </div>
                            <div className="text-xs text-neutral-500">{new Date(note.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800">{note.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}

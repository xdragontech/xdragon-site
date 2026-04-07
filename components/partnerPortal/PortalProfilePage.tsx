import { useEffect, useMemo, useState } from "react";
import type {
  CommandPartnerPortalAccount,
  CommandPartnerPortalProfile,
  CommandPartnerPortalScope,
  CommandParticipantPortalProfile,
  CommandSponsorPortalProfile,
} from "../../lib/commandPublicApi";
import PortalShell from "./PortalShell";
import PortalParticipantRequirementsCard from "./PortalParticipantRequirementsCard";
import PortalPhoneField, { buildPortalPhoneInputState, serializePortalPhoneInputState } from "./PortalPhoneField";
import PortalProfileImageCard from "./PortalProfileImageCard";
import PortalNav from "./PortalNav";
import { PORTAL_CONFIG, SOCIAL_LINK_FIELDS } from "./portalConfig";

function baseSocialLinks(profile: CommandPartnerPortalProfile | null) {
  const current = profile?.socialLinks || {};
  return Object.fromEntries(SOCIAL_LINK_FIELDS.map((field) => [field, current[field] || ""])) as Record<string, string>;
}

export default function PortalProfilePage(props: {
  scope: CommandPartnerPortalScope;
  account: CommandPartnerPortalAccount;
}) {
  const config = PORTAL_CONFIG[props.scope];
  const [profile, setProfile] = useState<CommandPartnerPortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(() => baseSocialLinks(null));
  const [contactPhoneState, setContactPhoneState] = useState(() => buildPortalPhoneInputState(""));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/bff/${props.scope}/profile`);
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Failed to load profile.");
        }
        if (cancelled) return;
        setProfile(payload.profile as CommandPartnerPortalProfile);
        setSocialLinks(baseSocialLinks(payload.profile as CommandPartnerPortalProfile));
        setContactPhoneState(buildPortalPhoneInputState((payload.profile as CommandPartnerPortalProfile).contactPhone));
      } catch (nextError: any) {
        if (cancelled) return;
        setError(nextError?.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.scope]);

  const participantProfile = profile?.kind === "PARTICIPANT" ? (profile as CommandParticipantPortalProfile) : null;
  const sponsorProfile = profile?.kind === "SPONSOR" ? (profile as CommandSponsorPortalProfile) : null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch(`/api/bff/${props.scope}/auth/logout`, { method: "POST" });
    } finally {
      window.location.assign(`/${props.scope}/signin`);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setNotice("");
    const serializedPhone = serializePortalPhoneInputState(contactPhoneState);
    if (!serializedPhone) {
      setSaving(false);
      setError("Contact phone is required.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      displayName: String(form.get("displayName") || ""),
      contactName: String(form.get("contactName") || ""),
      contactPhone: serializedPhone,
      description: String(form.get("description") || ""),
      mainWebsiteUrl: String(form.get("mainWebsiteUrl") || ""),
      socialLinks,
    };

    if (profile.kind === "PARTICIPANT") {
      body.summary = String(form.get("summary") || "");
      body.entertainmentType = String(form.get("entertainmentType") || "") || null;
      body.entertainmentStyle = String(form.get("entertainmentStyle") || "");
      body.foodStyle = String(form.get("foodStyle") || "");
      body.foodSetupType = String(form.get("foodSetupType") || "") || null;
      body.marketType = String(form.get("marketType") || "") || null;
      body.specialRequirements = String(form.get("specialRequirements") || "");
    } else {
      body.productServiceType = String(form.get("productServiceType") || "");
      body.audienceProfile = String(form.get("audienceProfile") || "");
      body.marketingGoals = String(form.get("marketingGoals") || "");
      body.onsitePlacement = String(form.get("onsitePlacement") || "");
      body.signageInformation = String(form.get("signageInformation") || "");
      body.staffed = form.get("staffed") === "on";
      body.requests = String(form.get("requests") || "");
    }

    try {
      const response = await fetch(`/api/bff/${props.scope}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to save profile.");
      }
      setProfile(payload.profile as CommandPartnerPortalProfile);
      setSocialLinks(baseSocialLinks(payload.profile as CommandPartnerPortalProfile));
      setContactPhoneState(buildPortalPhoneInputState((payload.profile as CommandPartnerPortalProfile).contactPhone));
      setNotice("Profile saved.");
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const readonlySummary = useMemo(() => {
    if (!profile) return null;
    return profile.kind === "PARTICIPANT"
      ? participantProfile?.participantType.replaceAll("_", " ")
      : sponsorProfile?.sponsorType || "Sponsor type assigned by backoffice";
  }, [participantProfile, profile, sponsorProfile]);

  return (
    <PortalShell title={config.profileHeading} subtitle={config.subtitle} width="wide">
      <div className="grid gap-6">
        <PortalNav
          scope={props.scope}
          active="profile"
          displayName={profile?.displayName || props.account.displayName}
          onSignOut={handleSignOut}
          busy={signingOut}
        />

        {loading ? <div className="text-sm text-neutral-600">Loading profile...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

        {profile ? (
          <div className="grid gap-4">
            <PortalProfileImageCard scope={props.scope} />

            {participantProfile ? <PortalParticipantRequirementsCard /> : null}

            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="mt-1 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                    {profile.account.email}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Portal type</label>
                  <div className="mt-1 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                    {readonlySummary}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{props.scope === "partners" ? "Display name" : "Brand name"}</label>
                  <input
                    name="displayName"
                    defaultValue={profile.displayName}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact name</label>
                  <input
                    name="contactName"
                    defaultValue={profile.contactName}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <PortalPhoneField label="Contact phone" state={contactPhoneState} onChange={setContactPhoneState} />
                <div>
                  <label className="text-sm font-medium">Main website URL</label>
                  <input
                    name="mainWebsiteUrl"
                    defaultValue={profile.mainWebsiteUrl || ""}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {participantProfile ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Summary</label>
                    <textarea
                      name="summary"
                      defaultValue={participantProfile.summary || ""}
                      className="mt-1 min-h-[90px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {participantProfile.participantType === "ENTERTAINMENT" ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Entertainment type</label>
                          <select
                            name="entertainmentType"
                            defaultValue={participantProfile.entertainmentType || ""}
                            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                          >
                            <option value="">Not set</option>
                            <option value="LIVE_BAND">Live Band</option>
                            <option value="DJ">DJ</option>
                            <option value="COMEDY">Comedy</option>
                            <option value="MAGIC">Magic</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Style</label>
                          <input
                            name="entertainmentStyle"
                            defaultValue={participantProfile.entertainmentStyle || ""}
                            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                          />
                        </div>
                      </>
                    ) : null}
                    {participantProfile.participantType === "FOOD_VENDOR" ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Food style</label>
                          <input
                            name="foodStyle"
                            defaultValue={participantProfile.foodStyle || ""}
                            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Setup type</label>
                          <select
                            name="foodSetupType"
                            defaultValue={participantProfile.foodSetupType || ""}
                            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                          >
                            <option value="">Not set</option>
                            <option value="TRUCK">Truck</option>
                            <option value="TRAILER">Trailer</option>
                            <option value="CART">Cart</option>
                            <option value="STAND">Stand</option>
                          </select>
                        </div>
                      </>
                    ) : null}
                    {participantProfile.participantType === "MARKET_VENDOR" ? (
                      <div>
                        <label className="text-sm font-medium">Market type</label>
                        <select
                          name="marketType"
                          defaultValue={participantProfile.marketType || ""}
                          className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="">Not set</option>
                          <option value="APPAREL">Apparel</option>
                          <option value="JEWELRY">Jewelry</option>
                          <option value="DECOR">Decor</option>
                          <option value="SKINCARE">Skincare</option>
                          <option value="FOOD">Food</option>
                          <option value="SERVICE">Service</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Special requirements</label>
                    <textarea
                      name="specialRequirements"
                      defaultValue={participantProfile.specialRequirements || ""}
                      className="mt-1 min-h-[90px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </>
              ) : null}

              {sponsorProfile ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Product or service type</label>
                    <input
                      name="productServiceType"
                      defaultValue={sponsorProfile.productServiceType}
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Audience profile</label>
                    <input
                      name="audienceProfile"
                      defaultValue={sponsorProfile.audienceProfile || ""}
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Marketing goals</label>
                    <input
                      name="marketingGoals"
                      defaultValue={sponsorProfile.marketingGoals || ""}
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Onsite placement</label>
                    <input
                      name="onsitePlacement"
                      defaultValue={sponsorProfile.onsitePlacement || ""}
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Signage information</label>
                    <input
                      name="signageInformation"
                      defaultValue={sponsorProfile.signageInformation || ""}
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <label className="mt-6 flex items-center gap-2 text-sm font-medium text-neutral-800">
                    <input type="checkbox" name="staffed" defaultChecked={Boolean(sponsorProfile.staffed)} />
                    Staffed onsite
                  </label>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Requests</label>
                    <textarea
                      name="requests"
                      defaultValue={sponsorProfile.requests || ""}
                      className="mt-1 min-h-[90px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  name="description"
                  defaultValue={profile.description || ""}
                  className="mt-1 min-h-[120px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {SOCIAL_LINK_FIELDS.map((field) => (
                  <div key={field}>
                    <label className="text-sm font-medium capitalize">{field}</label>
                    <input
                      value={socialLinks[field] || ""}
                      onChange={(event) =>
                        setSocialLinks((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}

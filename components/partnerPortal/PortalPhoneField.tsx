import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PortalPhoneInputState = {
  country: CountryCode;
  nationalNumber: string;
};

const DEFAULT_PHONE_COUNTRY: CountryCode = "CA";

const phoneCountryNameFormatter =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const prioritizedPhoneCountries: CountryCode[] = ["CA", "US", "GB", "AU", "NZ"];

const PHONE_COUNTRY_OPTIONS: Array<{ country: CountryCode; label: string; dialCode: string }> = [
  ...prioritizedPhoneCountries,
  ...getCountries().filter((country) => !prioritizedPhoneCountries.includes(country)),
].map((country) => ({
  country,
  label: phoneCountryNameFormatter?.of(country) || country,
  dialCode: `+${getCountryCallingCode(country)}`,
}));

function nationalDigits(value: string) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatNationalNumber(country: CountryCode, value: string) {
  const formatter = new AsYouType(country);
  return formatter.input(nationalDigits(value));
}

export function buildPortalPhoneInputState(value: string | null | undefined): PortalPhoneInputState {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      country: DEFAULT_PHONE_COUNTRY,
      nationalNumber: "",
    };
  }

  const parsed = parsePhoneNumberFromString(raw);
  if (parsed?.country) {
    return {
      country: parsed.country,
      nationalNumber: formatNationalNumber(parsed.country, parsed.nationalNumber),
    };
  }

  return {
    country: DEFAULT_PHONE_COUNTRY,
    nationalNumber: formatNationalNumber(DEFAULT_PHONE_COUNTRY, raw),
  };
}

export function serializePortalPhoneInputState(state: PortalPhoneInputState) {
  const digits = nationalDigits(state.nationalNumber);
  if (!digits) return "";

  const parsed = parsePhoneNumberFromString(digits, state.country);
  if (parsed?.number) return parsed.number;

  return `+${getCountryCallingCode(state.country)}${digits}`;
}

export default function PortalPhoneField(props: {
  label: string;
  state: PortalPhoneInputState;
  onChange: (next: PortalPhoneInputState) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{props.label}</label>
      <div className="mt-1 grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
        <select
          value={props.state.country}
          onChange={(event) =>
            props.onChange({
              country: event.target.value as CountryCode,
              nationalNumber: formatNationalNumber(event.target.value as CountryCode, props.state.nationalNumber),
            })
          }
          className="w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
        >
          {PHONE_COUNTRY_OPTIONS.map((option) => (
            <option key={option.country} value={option.country}>
              {`${option.dialCode} ${option.label}`}
            </option>
          ))}
        </select>
        <input
          value={props.state.nationalNumber}
          onChange={(event) =>
            props.onChange({
              country: props.state.country,
              nationalNumber: formatNationalNumber(props.state.country, event.target.value),
            })
          }
          className="w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="(604) 555-1234"
          inputMode="tel"
          autoComplete="tel-national"
        />
      </div>
    </div>
  );
}

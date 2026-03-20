import {
  BrandEnvironment,
  BrandHostKind,
  BrandStatus,
  type Brand,
  type BrandHost,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeHost } from "./requestHost";
import { getAllowedHosts as getFallbackAllowedHosts, getBrandSiteConfig } from "./siteConfig";

type BrandWithHosts = Prisma.BrandGetPayload<{
  include: {
    hosts: true;
  };
}>;

export type EditableBrandRecord = {
  id: string;
  brandKey: string;
  name: string;
  status: BrandStatus;
  apexHost: string;
  productionPublicHost: string;
  productionAdminHost: string;
  previewPublicHost: string;
  previewAdminHost: string;
  createdAt: string;
  updatedAt: string;
};

export type EditableBrandInput = Omit<EditableBrandRecord, "id" | "createdAt" | "updatedAt">;

export type RuntimeBrandResolution = {
  source: "database" | "env";
  brandId?: string;
  brandKey: string;
  brandName: string;
  status: BrandStatus | "ACTIVE";
  environment: "production" | "preview";
  matchedHost: string;
  canonicalPublicHost: string;
  canonicalAdminHost: string;
  apexHost: string;
  isAdminHost: boolean;
};

const BRAND_KEY_PATTERN = /^[a-z0-9-]+$/;

function normalizeBrandKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEditableHost(value: unknown): string {
  const normalized = normalizeHost(String(value || "").replace(/^https?:\/\//i, "").replace(/\/+$/, ""));
  if (normalized.includes("/") || normalized.includes("?") || normalized.includes("#") || normalized.includes(" ")) {
    return "";
  }
  return normalized;
}

function ensureRequired(value: string, label: string) {
  if (!value) throw new Error(`${label} is required`);
}

function findHost(brand: Pick<Brand, "id"> & { hosts: BrandHost[] }, environment: BrandEnvironment, kind: BrandHostKind) {
  return (
    brand.hosts.find((host) => host.environment === environment && host.kind === kind && host.isCanonical) ||
    brand.hosts.find((host) => host.environment === environment && host.kind === kind) ||
    null
  );
}

function mapBrandToEditorRecord(brand: BrandWithHosts): EditableBrandRecord {
  return {
    id: brand.id,
    brandKey: brand.brandKey,
    name: brand.name,
    status: brand.status,
    apexHost: findHost(brand, BrandEnvironment.PRODUCTION, BrandHostKind.APEX)?.host || "",
    productionPublicHost: findHost(brand, BrandEnvironment.PRODUCTION, BrandHostKind.PUBLIC)?.host || "",
    productionAdminHost: findHost(brand, BrandEnvironment.PRODUCTION, BrandHostKind.ADMIN)?.host || "",
    previewPublicHost: findHost(brand, BrandEnvironment.PREVIEW, BrandHostKind.PUBLIC)?.host || "",
    previewAdminHost: findHost(brand, BrandEnvironment.PREVIEW, BrandHostKind.ADMIN)?.host || "",
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

function buildHostRows(input: EditableBrandInput) {
  const apexHost = normalizeEditableHost(input.apexHost);
  const productionPublicHost = normalizeEditableHost(input.productionPublicHost);
  const productionAdminHost = normalizeEditableHost(input.productionAdminHost);
  const previewPublicHost = normalizeEditableHost(input.previewPublicHost);
  const previewAdminHost = normalizeEditableHost(input.previewAdminHost);

  ensureRequired(apexHost, "Apex host");
  ensureRequired(productionPublicHost, "Production public host");
  ensureRequired(productionAdminHost, "Production admin host");
  ensureRequired(previewPublicHost, "Preview public host");
  ensureRequired(previewAdminHost, "Preview admin host");

  const uniqueHosts = new Set([
    apexHost,
    productionPublicHost,
    productionAdminHost,
    previewPublicHost,
    previewAdminHost,
  ]);

  if (uniqueHosts.size !== 5) {
    throw new Error("Brand hosts must be unique across apex, production, and preview values");
  }

  return [
    {
      host: apexHost,
      environment: BrandEnvironment.PRODUCTION,
      kind: BrandHostKind.APEX,
      isCanonical: true,
    },
    {
      host: productionPublicHost,
      environment: BrandEnvironment.PRODUCTION,
      kind: BrandHostKind.PUBLIC,
      isCanonical: true,
    },
    {
      host: productionAdminHost,
      environment: BrandEnvironment.PRODUCTION,
      kind: BrandHostKind.ADMIN,
      isCanonical: true,
    },
    {
      host: previewPublicHost,
      environment: BrandEnvironment.PREVIEW,
      kind: BrandHostKind.PUBLIC,
      isCanonical: true,
    },
    {
      host: previewAdminHost,
      environment: BrandEnvironment.PREVIEW,
      kind: BrandHostKind.ADMIN,
      isCanonical: true,
    },
  ];
}

function validateBrandInput(raw: any): EditableBrandInput {
  const brandKey = normalizeBrandKey(raw?.brandKey);
  const name = String(raw?.name || "").trim();
  const status = String(raw?.status || "").trim().toUpperCase() as BrandStatus;

  if (!brandKey || !BRAND_KEY_PATTERN.test(brandKey)) {
    throw new Error("Brand key must use lowercase letters, numbers, and hyphens only");
  }

  ensureRequired(name, "Brand name");

  if (!Object.values(BrandStatus).includes(status)) {
    throw new Error("Invalid brand status");
  }

  return {
    brandKey,
    name,
    status,
    apexHost: normalizeEditableHost(raw?.apexHost),
    productionPublicHost: normalizeEditableHost(raw?.productionPublicHost),
    productionAdminHost: normalizeEditableHost(raw?.productionAdminHost),
    previewPublicHost: normalizeEditableHost(raw?.previewPublicHost),
    previewAdminHost: normalizeEditableHost(raw?.previewAdminHost),
  };
}

function fallbackBrandInput(): EditableBrandInput {
  const cfg = getBrandSiteConfig();
  return {
    brandKey: normalizeBrandKey(cfg.brandKey) || "xdragon",
    name: String(cfg.brandName || "X Dragon").trim() || "X Dragon",
    status: BrandStatus.ACTIVE,
    apexHost: normalizeEditableHost(cfg.apexHost),
    productionPublicHost: normalizeEditableHost(cfg.production.publicHost),
    productionAdminHost: normalizeEditableHost(cfg.production.adminHost),
    previewPublicHost: normalizeEditableHost(cfg.preview.publicHost),
    previewAdminHost: normalizeEditableHost(cfg.preview.adminHost),
  };
}

export async function listEditableBrands(search = ""): Promise<EditableBrandRecord[]> {
  const brands = await prisma.brand.findMany({
    include: { hosts: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const records = brands.map(mapBrandToEditorRecord);
  const query = String(search || "")
    .trim()
    .toLowerCase();

  if (!query) return records;

  return records.filter((brand) =>
    [
      brand.brandKey,
      brand.name,
      brand.apexHost,
      brand.productionPublicHost,
      brand.productionAdminHost,
      brand.previewPublicHost,
      brand.previewAdminHost,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}

export async function createEditableBrand(raw: any): Promise<EditableBrandRecord> {
  const input = validateBrandInput(raw);
  const hosts = buildHostRows(input);

  const brand = await prisma.brand.create({
    data: {
      brandKey: input.brandKey,
      name: input.name,
      status: input.status,
      hosts: {
        create: hosts,
      },
    },
    include: { hosts: true },
  });

  return mapBrandToEditorRecord(brand);
}

export async function updateEditableBrand(id: string, raw: any): Promise<EditableBrandRecord> {
  const input = validateBrandInput(raw);
  const hosts = buildHostRows(input);

  const brand = await prisma.$transaction(async (tx) => {
    await tx.brand.findUniqueOrThrow({ where: { id } });
    await tx.brandHost.deleteMany({ where: { brandId: id } });
    return tx.brand.update({
      where: { id },
      data: {
        brandKey: input.brandKey,
        name: input.name,
        status: input.status,
        hosts: {
          create: hosts,
        },
      },
      include: { hosts: true },
    });
  });

  return mapBrandToEditorRecord(brand);
}

export async function deleteEditableBrand(id: string): Promise<void> {
  const count = await prisma.brand.count();
  if (count <= 1) {
    throw new Error("Cannot delete the only brand while runtime fallback still exists");
  }
  await prisma.brand.delete({ where: { id } });
}

export async function resolveWriteBrandId(
  raw:
    | {
        brandId?: unknown;
        brandKey?: unknown;
      }
    | null
    | undefined,
  options?: {
    allowSingleBrandFallback?: boolean;
  }
): Promise<string> {
  const brandId = normalizeRecordId(raw?.brandId);
  if (brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!brand) throw new Error("Selected brand was not found");
    return brand.id;
  }

  const brandKey = normalizeBrandKey(raw?.brandKey);
  if (brandKey) {
    const brand = await prisma.brand.findUnique({
      where: { brandKey },
      select: { id: true },
    });
    if (!brand) throw new Error("Selected brand was not found");
    return brand.id;
  }

  if (!options?.allowSingleBrandFallback) {
    throw new Error("Brand selection is required");
  }

  const brands = await prisma.brand.findMany({
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
    take: 2,
  });

  if (brands.length === 0) {
    throw new Error("No brand is configured. Run the brand sync before creating brand-scoped records.");
  }

  if (brands.length > 1) {
    throw new Error("Brand selection is required once multiple brands exist.");
  }

  return brands[0].id;
}

function resolveFallbackBrandForHost(host: string): RuntimeBrandResolution | null {
  const normalizedHost = normalizeHost(host);
  const cfg = fallbackBrandInput();

  if (!normalizedHost) return null;

  if (normalizedHost === cfg.productionPublicHost) {
    return {
      source: "env",
      brandKey: cfg.brandKey,
      brandName: cfg.name,
      status: BrandStatus.ACTIVE,
      environment: "production",
      matchedHost: normalizedHost,
      canonicalPublicHost: cfg.productionPublicHost,
      canonicalAdminHost: cfg.productionAdminHost,
      apexHost: cfg.apexHost,
      isAdminHost: false,
    };
  }

  if (normalizedHost === cfg.productionAdminHost) {
    return {
      source: "env",
      brandKey: cfg.brandKey,
      brandName: cfg.name,
      status: BrandStatus.ACTIVE,
      environment: "production",
      matchedHost: normalizedHost,
      canonicalPublicHost: cfg.productionPublicHost,
      canonicalAdminHost: cfg.productionAdminHost,
      apexHost: cfg.apexHost,
      isAdminHost: true,
    };
  }

  if (normalizedHost === cfg.previewPublicHost) {
    return {
      source: "env",
      brandKey: cfg.brandKey,
      brandName: cfg.name,
      status: BrandStatus.ACTIVE,
      environment: "preview",
      matchedHost: normalizedHost,
      canonicalPublicHost: cfg.previewPublicHost,
      canonicalAdminHost: cfg.previewAdminHost,
      apexHost: cfg.apexHost,
      isAdminHost: false,
    };
  }

  if (normalizedHost === cfg.previewAdminHost) {
    return {
      source: "env",
      brandKey: cfg.brandKey,
      brandName: cfg.name,
      status: BrandStatus.ACTIVE,
      environment: "preview",
      matchedHost: normalizedHost,
      canonicalPublicHost: cfg.previewPublicHost,
      canonicalAdminHost: cfg.previewAdminHost,
      apexHost: cfg.apexHost,
      isAdminHost: true,
    };
  }

  if (normalizedHost === cfg.apexHost) {
    return {
      source: "env",
      brandKey: cfg.brandKey,
      brandName: cfg.name,
      status: BrandStatus.ACTIVE,
      environment: "production",
      matchedHost: normalizedHost,
      canonicalPublicHost: cfg.productionPublicHost,
      canonicalAdminHost: cfg.productionAdminHost,
      apexHost: cfg.apexHost,
      isAdminHost: false,
    };
  }

  return null;
}

export async function resolveRuntimeBrandForHost(host: string): Promise<RuntimeBrandResolution | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;

  const hostRecord = await prisma.brandHost.findUnique({
    where: { host: normalizedHost },
    include: {
      brand: {
        include: {
          hosts: true,
        },
      },
    },
  });

  if (!hostRecord) {
    const hasBrands = (await prisma.brand.count()) > 0;
    return hasBrands ? null : resolveFallbackBrandForHost(normalizedHost);
  }

  const brand = hostRecord.brand;
  const environment = hostRecord.environment === BrandEnvironment.PREVIEW ? "preview" : "production";
  const publicHost = findHost(brand, hostRecord.environment, BrandHostKind.PUBLIC)?.host || "";
  const adminHost = findHost(brand, hostRecord.environment, BrandHostKind.ADMIN)?.host || "";
  const apexHost = findHost(brand, BrandEnvironment.PRODUCTION, BrandHostKind.APEX)?.host || "";

  if (!publicHost || !adminHost) return null;

  return {
    source: "database",
    brandId: brand.id,
    brandKey: brand.brandKey,
    brandName: brand.name,
    status: brand.status,
    environment,
    matchedHost: normalizedHost,
    canonicalPublicHost: publicHost,
    canonicalAdminHost: adminHost,
    apexHost,
    isAdminHost: hostRecord.kind === BrandHostKind.ADMIN,
  };
}

export async function getRuntimeAllowedHosts(extraHosts: string[] = []): Promise<Set<string>> {
  const hosts = new Set(extraHosts.map((host) => normalizeHost(host)).filter(Boolean));
  const dbHosts = await prisma.brandHost.findMany({
    select: { host: true },
  });

  if (dbHosts.length > 0) {
    for (const host of dbHosts) {
      const normalized = normalizeHost(host.host);
      if (normalized) hosts.add(normalized);
    }
    return hosts;
  }

  for (const host of Array.from(getFallbackAllowedHosts())) {
    hosts.add(normalizeHost(host));
  }

  return hosts;
}

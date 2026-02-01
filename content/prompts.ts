// content/prompts.ts
export type PromptItem = {
  id: string;
  title: string;
  category: "Marketing" | "Operations" | "Customer Support" | "Analytics";
  prompt: string;
};

export const PROMPTS: PromptItem[] = [
  {
    id: "mkt-landing-1",
    title: "Landing page value prop rewrite",
    category: "Marketing",
    prompt:
      "Rewrite this landing page headline + subheadline for clarity and conversion. Keep it punchy, professional, and ROI-focused.\n\nCurrent copy:\n{{PASTE_COPY}}",
  },
  {
    id: "ops-sop-1",
    title: "Create a repeatable SOP",
    category: "Operations",
    prompt:
      "Turn the following process notes into a step-by-step SOP with clear roles, checklist items, and failure modes. Keep it concise.\n\nNotes:\n{{PASTE_NOTES}}",
  },
  {
    id: "cs-macro-1",
    title: "Support response (firm but helpful)",
    category: "Customer Support",
    prompt:
      "Draft a customer support reply that is calm, helpful, and sets expectations. Include next steps and what we need from the customer.\n\nTicket:\n{{PASTE_TICKET}}",
  },
  {
    id: "ana-kpi-1",
    title: "KPI dashboard spec",
    category: "Analytics",
    prompt:
      "Propose a KPI dashboard for an e-commerce operator. Include the KPIs, definitions, data sources, and refresh cadence. Keep it practical.\n\nContext:\n{{PASTE_CONTEXT}}",
  },
];

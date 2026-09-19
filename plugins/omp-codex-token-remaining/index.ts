import type { UsageReport } from "@oh-my-pi/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const PROVIDER = "openai-codex";
const QUOTA_STATUS_KEY = "quota-codex";
const PONYTAIL_STATUS_KEY = "ponytail";
const WINDOWS = ["5h", "7d"] as const;
const PONYTAIL_MODES = ["off", "lite", "full", "ultra", "review"] as const;
type PonytailMode = (typeof PONYTAIL_MODES)[number];

function matchesAccount(report: UsageReport, identity: Record<string, string | undefined>): boolean {
  const metadata = report.metadata ?? {};
  return Object.entries(identity).every(([key, value]) => {
    if (!value) return true;
    const snakeKey = key.replace("Id", "_id");
    return String(metadata[key] ?? metadata[snakeKey] ?? "").toLowerCase() === value.toLowerCase();
  });
}

function remainingPercent(report: UsageReport, windowId: (typeof WINDOWS)[number]): number | undefined {
  const amount = report.limits.find(
    (limit) => limit.scope.windowId === windowId || limit.window?.id === windowId,
  )?.amount;
  if (!amount) return;

  const fraction =
    amount.remainingFraction ??
    (amount.usedFraction === undefined ? undefined : 1 - amount.usedFraction) ??
    (amount.remaining !== undefined && amount.limit ? amount.remaining / amount.limit : undefined);
  return fraction === undefined || !Number.isFinite(fraction)
    ? undefined
    : Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

function getPonytailMode(ctx: ExtensionContext): PonytailMode {
  const entries = ctx.sessionManager.getBranch();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== "ponytail-mode") continue;
    const data = entry.data;
    if (!data || typeof data !== "object" || !("mode" in data)) continue;
    const mode = data.mode;
    if (typeof mode === "string" && PONYTAIL_MODES.includes(mode as PonytailMode)) return mode as PonytailMode;
  }

  const configured = process.env.PONYTAIL_DEFAULT_MODE?.toLowerCase();
  return configured && PONYTAIL_MODES.includes(configured as PonytailMode) ? (configured as PonytailMode) : "full";
}

function formatPonytailStatus(ctx: ExtensionContext, active: boolean): string {
  const mode = getPonytailMode(ctx);
  if (mode === "off") return "";

  const icon = { lite: "🌿", full: "⚡", ultra: "🔥", review: "" }[mode];
  const level = `${icon ? `${icon} ` : ""}${mode.toUpperCase()}`;
  try {
    const theme = ctx.ui.theme;
    if (theme?.fg) {
      const indicator = active ? theme.fg("accent", "●") : theme.fg("dim", "○");
      return `${indicator} 🐴 ${theme.fg("muted", "ponytail: ")}${theme.fg("text", level)}`;
    }
  } catch {}
  return `${active ? "●" : "○"} 🐴 ponytail: ${level}`;
}

export default function codexTokenRemaining(pi: ExtensionAPI): void {
  let active = false;
  let mergeWithPonytail = false;
  let quotaText = "Codex 套餐余量：读取中";

  function renderStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (!mergeWithPonytail) {
      ctx.ui.setStatus(QUOTA_STATUS_KEY, quotaText);
      return;
    }

    ctx.ui.setStatus(QUOTA_STATUS_KEY, undefined);
    const ponytailText = formatPonytailStatus(ctx, active);
    ctx.ui.setStatus(
      PONYTAIL_STATUS_KEY,
      ponytailText ? `${ponytailText} · ${quotaText}` : quotaText,
    );
  }

  async function updateQuota(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI) return;

    try {
      const storage = ctx.modelRegistry.authStorage;
      const reports =
        (await storage.fetchUsageReports({
          baseUrlResolver: (provider) => ctx.modelRegistry.getProviderBaseUrl(provider),
          signal: AbortSignal.timeout(2_000),
        })) ?? [];
      const identity = storage.getOAuthAccountIdentity(PROVIDER, ctx.sessionManager.getSessionId());
      const providerReports = reports.filter((report) => report.provider === PROVIDER);
      const report =
        providerReports.find((candidate) => !identity || matchesAccount(candidate, identity)) ??
        (providerReports.length === 1 ? providerReports[0] : undefined);
      const parts = report
        ? WINDOWS.flatMap((windowId) => {
            const percent = remainingPercent(report, windowId);
            return percent === undefined ? [] : [`${windowId} ${percent}%`];
          })
        : [];
      quotaText = parts.length ? `Codex 套餐余量：${parts.join(" · ")}` : "Codex 套餐余量：不可用";
    } catch {
      quotaText = "Codex 套餐余量：不可用";
    }
    renderStatus(ctx);
  }

  pi.on("session_start", (_event, ctx) => {
    mergeWithPonytail = pi.getCommands().some((command) => command.name === "ponytail");
    active = false;
    void updateQuota(ctx);
  });
  pi.on("input", (_event, ctx) => {
    ctx.setTimeout(() => renderStatus(ctx), 0);
  });
  pi.on("agent_start", (_event, ctx) => {
    active = true;
    ctx.setTimeout(() => renderStatus(ctx), 0);
  });
  pi.on("agent_end", (_event, ctx) => {
    active = false;
    ctx.setTimeout(() => renderStatus(ctx), 0);
  });
  pi.on("turn_end", (_event, ctx) => void updateQuota(ctx));
  pi.on("session_switch", (_event, ctx) => {
    active = false;
    void updateQuota(ctx);
  });
  pi.on("session_branch", (_event, ctx) => {
    active = false;
    void updateQuota(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    active = false;
    void updateQuota(ctx);
  });
  pi.on("session_compact", (_event, ctx) => void updateQuota(ctx));
}

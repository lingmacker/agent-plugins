import { expect, test } from "bun:test";
import plugin from "./index";

test("renders Ponytail and Codex quota as one host status", async () => {
  let start: ((event: unknown, ctx: unknown) => void) | undefined;
  plugin({
    getCommands: () => [{ name: "ponytail" }],
    on(event: string, handler: unknown) {
      if (event === "session_start") start = handler as typeof start;
    },
  } as never);

  const statuses: Record<string, string> = { ponytail: "○ 🐴 ponytail: ⚡ FULL" };
  const rendered = Promise.withResolvers<void>();
  start?.(
    {},
    {
      hasUI: true,
      modelRegistry: {
        getProviderBaseUrl: () => undefined,
        authStorage: {
          fetchUsageReports: async () => [
            {
              provider: "openai-codex",
              fetchedAt: Date.now(),
              limits: [
                {
                  id: "primary",
                  label: "5 hours",
                  scope: { provider: "openai-codex", windowId: "5h" },
                  amount: { remainingFraction: 0.24, unit: "percent" },
                },
                {
                  id: "secondary",
                  label: "7 days",
                  scope: { provider: "openai-codex", windowId: "7d" },
                  amount: { usedFraction: 0.74, unit: "percent" },
                },
              ],
              metadata: { accountId: "active-account" },
            },
          ],
          getOAuthAccountIdentity: () => ({ accountId: "active-account" }),
        },
      },
      sessionManager: {
        getSessionId: () => "session",
        getBranch: () => [
          { type: "custom", customType: "ponytail-mode", data: { mode: "full" } },
        ],
      },
      ui: {
        theme: { fg: (_color: string, text: string) => text },
        setStatus(key: string, text: string | undefined) {
          if (text === undefined) delete statuses[key];
          else statuses[key] = text;
          if (key === "ponytail" && text?.includes("Codex")) rendered.resolve();
        },
      },
    },
  );

  await rendered.promise;
  expect(statuses).toEqual({
    ponytail: "○ 🐴 ponytail: ⚡ FULL · Codex 套餐余量：5h 24% · 7d 26%",
  });
});

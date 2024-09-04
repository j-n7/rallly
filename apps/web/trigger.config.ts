import type { TriggerConfig } from "@trigger.dev/sdk/v3";

import { env } from "@/env";

export const config: TriggerConfig = {
  project: env.TRIGGER_PROJECT_ID,
  logLevel: "log",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dependenciesToBundle: [/@t3-oss/, "@rallly/emails", "react"],
};

export const resolveEnvVars = () => {
  return {
    variables: Object.keys(env).map((key) => ({
      name: key,
      value: env[key as keyof typeof env]?.toString(),
    })),
  };
};

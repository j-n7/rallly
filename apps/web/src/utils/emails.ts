import { EmailClient, SupportedEmailProviders } from "@rallly/emails";
import * as Sentry from "@sentry/nextjs";

import { absoluteUrl } from "@/utils/absolute-url";
import { isSelfHosted } from "@/utils/constants";

export const getEmailClient = (locale?: string) => {
  return new EmailClient({
    openPreviews: process.env.NODE_ENV === "development",
    provider: {
      name: (process.env.EMAIL_PROVIDER as SupportedEmailProviders) ?? "smtp",
    },
    mail: {
      from: {
        name: process.env.NOREPLY_EMAIL_NAME ?? "Rallly",
        address: process.env.NOREPLY_EMAIL || process.env.SUPPORT_EMAIL,
      },
    },
    config: {
      logoUrl: isSelfHosted
        ? absoluteUrl("/images/rallly-logo-mark.png")
        : "https://rallly-public.s3.amazonaws.com/images/rallly-logo-mark.png",
      baseUrl: absoluteUrl(),
      domain: absoluteUrl().replace(/(^\w+:|^)\/\//, ""),
      supportEmail: process.env.SUPPORT_EMAIL,
    },
    locale,
    onError: (e) => {
      console.error(e);
      Sentry.captureException(e);
    },
  });
};

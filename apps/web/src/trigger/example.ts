import { logger, task } from "@trigger.dev/sdk/v3";

import { getEmailClient } from "@/utils/emails";

export const notifyParticipant = task({
  id: "notify-participant",
  run: async (
    payload: {
      locale?: string;
      to: string;
      props: {
        date: string;
        day: string;
        dow: string;
        time: string;
        title: string;
        hostName: string;
        pollUrl: string;
      };
    },
    { ctx },
  ) => {
    logger.log("Login email", { payload, ctx });

    await getEmailClient(payload.locale).sendTemplate(
      "FinalizeParticipantEmail",
      {
        to: payload.to,
        props: payload.props,
      },
    );
  },
});

export type NotifyParticipantTask = typeof notifyParticipant;

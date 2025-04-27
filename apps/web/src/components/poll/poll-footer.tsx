import Link from "next/link";

import { Trans } from "@/components/trans";

export function PollFooter() {
  return (
    <div className="pb-12 pt-4 text-center text-sm text-gray-500">
      <Trans
        defaults="Powered with 💚 by <a>{name}</a>"
        i18nKey="poweredByRallly"
        values={{ name: "jinc.io" }}
        components={{
          a: (
            <Link
              className="hover:text-primary-600 rounded-none border-b border-b-gray-500 font-semibold"
              href="https://jinc.io"
            />
          ),
        }}
      />
    </div>
  );
}

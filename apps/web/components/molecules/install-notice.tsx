import { Alert, type AlertProps } from "@/components/atoms/alert";

const NOTICES: Record<string, { tone: AlertProps["tone"]; text: string }> = {
  installed: { tone: "ok", text: "GitHub App installed." },
  requested: {
    tone: "info",
    text: "Installation requested. An owner of the organisation needs to approve it.",
  },
  cancelled: { tone: "info", text: "Installation cancelled." },
  "not-found": {
    tone: "warn",
    text: "We couldn't find that installation on your account.",
  },
};

export type InstallNoticeProps = { outcome?: string };

export function InstallNotice({ outcome }: InstallNoticeProps) {
  const notice =
    outcome && Object.hasOwn(NOTICES, outcome) ? NOTICES[outcome] : null;
  return notice && <Alert tone={notice.tone}>{notice.text}</Alert>;
}

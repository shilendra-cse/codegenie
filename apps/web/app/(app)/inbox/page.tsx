import { InboxScreen } from "./inbox-screen";

type InboxPageProps = { searchParams: Promise<{ filter?: string }> };

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const { filter } = await searchParams;
  return <InboxScreen filter={filter} />;
}

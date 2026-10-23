import { WelcomeScreen } from "./welcome-screen";

type WelcomePageProps = {
  searchParams: Promise<{ github?: string }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const { github } = await searchParams;
  return <WelcomeScreen github={github} />;
}

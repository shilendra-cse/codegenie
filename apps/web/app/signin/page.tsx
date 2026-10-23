import { SignInScreen } from "./sign-in-screen";

type SignInPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next, error } = await searchParams;
  return <SignInScreen next={next} failed={error !== undefined} />;
}

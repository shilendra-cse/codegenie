import { getPosts } from "@/features/devlog/posts";
import { Devlog } from "./devlog";

export default async function DevlogPage() {
  return <Devlog posts={await getPosts()} />;
}

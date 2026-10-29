import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { DOMAIN } from "@hobai/shared/brand";
import { devlogAssetUrl } from "@/features/devlog/assets";
import { DEVLOG_TITLE } from "@/features/devlog/devlog";
import { getPost, getPosts } from "@/features/devlog/posts";
import { formatPostDate } from "@/lib/format";
import { DEVLOG } from "@/lib/routes";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = DEVLOG_TITLE;

const read = (...segments: string[]) =>
  readFile(path.join(process.cwd(), ...segments));

const dataUrl = (file: Buffer, type: string) =>
  `data:${type};base64,${file.toString("base64")}`;

export async function generateStaticParams() {
  return (await getPosts()).map(({ slug }) => ({ slug }));
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  if (post.image) {
    const url = devlogAssetUrl(post.slug, post.image);
    const type = url.endsWith(".png") ? "image/png" : "image/jpeg";
    return new ImageResponse(
      <img
        src={dataUrl(await read("public", url), type)}
        alt=""
        width={size.width}
        height={size.height}
        style={{ objectFit: "cover" }}
      />,
      size,
    );
  }

  const fonts = "node_modules/geist/dist/fonts/geist-sans";
  const [semiBold, medium, logo] = await Promise.all([
    read(fonts, "Geist-SemiBold.ttf"),
    read(fonts, "Geist-Medium.ttf"),
    read("public/brand/white/hobai-white.png"),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0a0a0b",
        backgroundImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,255,255,0.10), transparent)",
        color: "#ededef",
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={dataUrl(logo, "image/png")} alt="" width={192} height={50} />
        <span style={{ fontSize: 28, fontWeight: 500, color: "#8e8e97" }}>
          Devlog
        </span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 68,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.035em",
          maxWidth: 1000,
        }}
      >
        {post.title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 26,
          fontWeight: 500,
          color: "#8e8e97",
        }}
      >
        <span>{formatPostDate(post.date)}</span>
        <span>{`${DOMAIN}${DEVLOG}`}</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: semiBold, weight: 600, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}

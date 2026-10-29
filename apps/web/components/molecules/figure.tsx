import Image from "next/image";
import { cn } from "@/lib/utils";

export type FigureProps = {
  src: string;
  darkSrc?: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

export function Figure({
  src,
  darkSrc,
  alt,
  caption,
  width,
  height,
}: FigureProps) {
  const image = (url: string, className?: string) => (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      sizes="(min-width: 720px) 672px, 100vw"
      unoptimized={url.endsWith(".svg")}
      className={cn("h-auto w-full rounded-lg border border-border", className)}
    />
  );
  return (
    <figure className="mt-2 mb-8">
      {darkSrc ? (
        <>
          {image(src, "dark:hidden")}
          {image(darkSrc, "hidden dark:block")}
        </>
      ) : (
        image(src)
      )}
      {caption && (
        <figcaption className="mt-2.5 text-center text-[13px] text-faint">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

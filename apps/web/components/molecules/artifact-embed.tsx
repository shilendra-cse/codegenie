import { AppWindow, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";

export type ArtifactEmbedProps = {
  src: string;
  title: string;
  height: number;
  caption?: string;
  theme: "light" | "dark" | undefined;
};

export function ArtifactEmbed({
  src,
  title,
  height,
  caption,
  theme,
}: ArtifactEmbedProps) {
  const url = theme && `${src}?theme=${theme}`;
  return (
    <figure className="mt-2 mb-8">
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-window)]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border bg-surface py-2 pr-2.5 pl-3.5 text-[13px]">
          <Icon icon={AppWindow} size={14} className="text-faint" />
          <span className="font-medium text-foreground">{title}</span>
          <Badge className="h-5 text-[11px]">Interactive</Badge>
          <span className="flex-1" />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Open full screen
              <Icon icon={ArrowUpRight} size={14} />
            </a>
          )}
        </div>
        {url ? (
          <iframe
            src={url}
            title={title}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            loading="lazy"
            className="block w-full border-0 bg-surface"
            style={{ height }}
          />
        ) : (
          <div aria-hidden className="bg-surface" style={{ height }} />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center text-[13px] text-faint">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

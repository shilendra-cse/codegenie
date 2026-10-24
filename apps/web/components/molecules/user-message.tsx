import { Avatar } from "@/components/atoms/avatar";

export type UserMessageProps = {
  name: string;
  image: string | null;
  /** When it was sent, already formatted ("5 minutes ago"). */
  time: string;
  content: string;
};

export function UserMessage({ name, image, time, content }: UserMessageProps) {
  return (
    <div className="rise flex gap-3">
      <Avatar name={name} src={image} size={32} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-faint">{time}</span>
        </span>
        <p className="break-words whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

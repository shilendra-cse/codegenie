import { Check } from "lucide-react";
import { Icon } from "@/components/atoms/icon";

export type Command = { name: string; cwd: string; command: string };

export type CommandTableProps = {
  title: string;
  commands: Command[];
  ticked?: boolean;
};

export function CommandTable({ title, commands, ticked }: CommandTableProps) {
  return (
    <>
      <div className="px-[18px] pt-3.5 pb-1 text-xs font-medium text-faint">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {commands.map(({ name, cwd, command }) => (
              <tr
                key={`${cwd}:${name}`}
                className="border-b border-border last:border-b-0"
              >
                {ticked && (
                  <td className="w-7 py-2 pl-[18px]">
                    <Icon icon={Check} className="text-ok" />
                  </td>
                )}
                <td className={ticked ? "px-3 py-2" : "py-2 pr-3 pl-[18px]"}>
                  {name}
                </td>
                <td className="px-3 py-2 font-mono text-faint">{cwd}</td>
                <td className="py-2 pr-[18px] pl-3 font-mono">{command}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

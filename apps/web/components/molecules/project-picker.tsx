import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { type Health, HealthDot } from "@/components/atoms/health-dot";
import { Icon } from "@/components/atoms/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/atoms/menu";
import { ADD_REPOSITORY } from "@/lib/routes";

export type PickerProject = {
  id: string;
  name: string;
  branch: string;
  health: Health;
  /** Why it can't take a task yet, and where to fix that. */
  blocked: {
    reason: string;
    fix: { label: string; href: string } | null;
  } | null;
};

export type ProjectPickerProps = {
  projects: PickerProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ProjectPicker({
  projects,
  selectedId,
  onSelect,
}: ProjectPickerProps) {
  const selected = projects.find((p) => p.id === selectedId);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" aria-label={`Project: ${selected?.name ?? "none"}`}>
          {selected && <HealthDot health={selected.health} />}
          {selected?.name ?? "Choose a project"}
          <Icon icon={ChevronDown} size={14} />
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-[260px]">
        {projects.map((project) =>
          project.blocked ? (
            <BlockedProject key={project.id} project={project} />
          ) : (
            <MenuItem key={project.id} onSelect={() => onSelect(project.id)}>
              <HealthDot health={project.health} />
              <span className="flex-1">{project.name}</span>
              <span className="font-mono text-xs text-faint">
                {project.branch}
              </span>
            </MenuItem>
          ),
        )}
        <MenuSeparator />
        <MenuItem asChild>
          <Link href={ADD_REPOSITORY}>
            <Icon icon={Plus} size={14} />
            Add a repository
          </Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function BlockedProject({ project }: { project: PickerProject }) {
  const { reason, fix } = project.blocked!;
  const content = (
    <>
      <HealthDot health={project.health} />
      <span className="flex-1">{project.name}</span>
      <span className="text-xs">
        {reason}
        {fix && (
          <>
            {" · "}
            <span className="underline underline-offset-2">{fix.label}</span>
          </>
        )}
      </span>
    </>
  );
  // It can't be picked; choosing it goes to where it can be fixed.
  return fix ? (
    <MenuItem asChild className="text-faint">
      <Link href={fix.href}>{content}</Link>
    </MenuItem>
  ) : (
    <MenuItem disabled className="text-faint data-[disabled]:opacity-100">
      {content}
    </MenuItem>
  );
}

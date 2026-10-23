import type { GitHubInstallation } from "@codegenie/shared";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { GitHubMark } from "@/components/atoms/github-mark";
import { Icon } from "@/components/atoms/icon";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/atoms/menu";

export type AccountPickerProps = {
  installations: GitHubInstallation[];
  selectedId: number;
  onSelect: (installationId: number) => void;
};

export function AccountPicker({
  installations,
  selectedId,
  onSelect,
}: AccountPickerProps) {
  const selected = installations.find((i) => i.id === selectedId);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button aria-label={`GitHub account: ${selected?.accountLogin ?? ""}`}>
          <GitHubMark size={16} />
          {selected?.accountLogin}
          <Icon icon={ChevronDown} size={14} />
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup
          value={String(selectedId)}
          onValueChange={(value) => onSelect(Number(value))}
        >
          {installations.map((installation) => (
            <MenuRadioItem
              key={installation.id}
              value={String(installation.id)}
            >
              {installation.accountLogin}{" "}
              {installation.accountType === "organization" && (
                <span className="text-xs text-faint">organisation</span>
              )}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

import { LogOut, Monitor, Moon, Settings2, Sun } from "lucide-react";
import { Avatar } from "@/components/atoms/avatar";
import { Icon } from "@/components/atoms/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/atoms/menu";

export type Theme = "light" | "dark" | "system";

export type AccountUser = {
  name: string;
  email: string;
  image: string | null;
};

export type AccountMenuProps = {
  user: AccountUser | null;
  theme: string | undefined;
  onThemeChange: (theme: Theme) => void;
  onSignOut: () => void;
};

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AccountMenu({
  user,
  theme,
  onThemeChange,
  onSignOut,
}: AccountMenuProps) {
  if (!user) {
    return (
      <div
        aria-hidden
        className="h-8 animate-pulse rounded-sm bg-muted motion-reduce:animate-none"
      />
    );
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`${user.name}, account menu`}
          className="flex min-h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <Avatar name={user.name} src={user.image} />
          <span className="flex-1 truncate text-left">{user.name}</span>
          <Icon icon={Settings2} />
        </button>
      </MenuTrigger>
      <MenuContent
        side="top"
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        <MenuLabel className="truncate">{user.email}</MenuLabel>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup
          value={theme ?? "system"}
          onValueChange={(value) => onThemeChange(value as Theme)}
        >
          {THEMES.map(({ value, label, icon }) => (
            <MenuRadioItem key={value} value={value}>
              <Icon icon={icon} />
              {label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={onSignOut}>
          <Icon icon={LogOut} />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

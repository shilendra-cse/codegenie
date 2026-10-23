import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: import.meta.dirname });

async function restrictedImports(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("the layer rule", () => {
  it("lets only atoms use library components", async () => {
    const code =
      'import { Button } from "@/components/factory/button";\nexport const a = Button;\n';

    expect(await restrictedImports("components/atoms/x.tsx", code)).toEqual([]);
    expect(
      await restrictedImports("components/molecules/x.tsx", code),
    ).toHaveLength(1);
    expect(await restrictedImports("app/page.tsx", code)).toHaveLength(1);
    expect(
      await restrictedImports(
        "app/page.tsx",
        'import * as Menu from "@radix-ui/react-dropdown-menu";\nexport const a = Menu;\n',
      ),
    ).toHaveLength(1);
  });

  it("keeps components to props: no data, no higher layers", async () => {
    const data =
      'import { api } from "@/lib/api/client";\nexport const a = api;\n';
    const higher =
      'import { Sidebar } from "../organisms/sidebar";\nexport const a = Sidebar;\n';

    expect(
      await restrictedImports("components/organisms/x.tsx", data),
    ).toHaveLength(1);
    expect(
      await restrictedImports("components/molecules/x.tsx", higher),
    ).toHaveLength(1);
    expect(
      await restrictedImports("components/templates/x.tsx", higher),
    ).toEqual([]);
    expect(await restrictedImports("app/page.tsx", data)).toEqual([]);
  });
});

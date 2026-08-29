import { load as loadYaml } from "js-yaml";
import type { Frontmatter } from "satteri";

export interface VaultFrontmatter {
  slug: string;
  title: string;
  publishedAt: string;
  displayDate?: string;
  category: string;
  thumb?: string;
  description: string;
  pinned?: boolean;
  draft?: boolean;
  protected?: boolean;
  question?: string;
  passwordHash: string;
}

export function parseFrontmatter(
  frontmatter: Frontmatter | null,
): VaultFrontmatter {
  if (!frontmatter || frontmatter.kind !== "yaml") {
    throw new Error("missing YAML frontmatter block");
  }
  const data = loadYaml(frontmatter.value) as VaultFrontmatter;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter block did not parse to an object");
  }
  return data;
}

export function validateFrontmatter(
  fm: VaultFrontmatter,
  slug: string,
): string[] {
  const violations: string[] = [];
  if (fm.pinned === true) violations.push(`"pinned" must not be true`);
  if (fm.protected !== true) violations.push(`"protected" must be true`);
  if ("password" in fm)
    violations.push(
      `"password" is no longer allowed; use "passwordHash" instead`,
    );
  if (!fm.passwordHash?.trim()) violations.push(`"passwordHash" is required`);
  if (fm.slug !== slug) violations.push(`"slug" must match the directory name`);
  if (!fm.title?.trim()) violations.push(`"title" is required`);
  if (!fm.description?.trim()) violations.push(`"description" is required`);
  return violations;
}

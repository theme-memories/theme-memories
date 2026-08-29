import { pathToFileURL } from "node:url";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { vault as vaultConfig } from "../src/config.ts";
import { isSafeAssetKey } from "../src/lib/vault.ts";
import { STAGING_DIR, VAULT_DIR, STUB_DIR } from "./config.ts";
import { renderMarkdown } from "./lib/markdown.ts";
import {
  parseFrontmatter,
  validateFrontmatter,
  type VaultFrontmatter,
} from "./lib/frontmatter.ts";
import { collectAssets, isLocalFile } from "./lib/assets.ts";
import {
  writeAssets,
  writeEnvelopes,
  writeStubs,
  writeManifest,
  type VaultEnvelope,
  type VaultStub,
} from "./lib/staging.ts";

async function runPrepare(): Promise<void> {
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true, mode: 0o700 });
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });

  if (!existsSync(VAULT_DIR)) {
    throw new Error(
      "src/content/vault is missing; refusing to publish or delete remote vault data",
    );
  }

  const stagedAssets = new Map<string, string>();
  const envelopes = new Map<string, VaultEnvelope>();
  const hashes = new Map<string, string>();
  const stubs: VaultStub[] = [];

  const entries = readdirSync(VAULT_DIR).filter((name) =>
    existsSync(join(VAULT_DIR, name, "index.md")),
  );
  entries.sort();

  for (const entry of entries) {
    const slug = entry;
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      throw new Error(`invalid vault slug: ${entry}`);
    }

    const source = readFileSync(join(VAULT_DIR, slug, "index.md"), "utf8");
    const {
      html,
      headings,
      frontmatter: rawFrontmatter,
    } = await renderMarkdown(source, {
      fileURL: pathToFileURL(join(VAULT_DIR, slug, "index.md")),
    });

    let frontmatter: VaultFrontmatter;
    try {
      frontmatter = parseFrontmatter(rawFrontmatter);
    } catch (error) {
      throw new Error(`${entry}: ${(error as Error).message}`, {
        cause: error,
      });
    }

    if (frontmatter.draft === true) {
      console.log(`skip ${entry}: draft`);
      continue;
    }

    const violations = validateFrontmatter(frontmatter, entry);
    if (violations.length > 0) {
      throw new Error(
        `${entry}: invalid vault frontmatter:\n  - ${violations.join("\n  - ")}`,
      );
    }

    const { html: htmlWithAssets, assets } = collectAssets(html, entry);
    for (const [key, sourcePath] of assets) stagedAssets.set(key, sourcePath);

    const questionSource = (
      frontmatter.question?.trim() || vaultConfig.genericQuestion
    ).trim();
    const { html: questionHtml } = await renderMarkdown(questionSource);

    const thumb =
      frontmatter.thumb?.replace(/^\.\//, "").replace(/^\//, "") || undefined;
    if (thumb) {
      const r2Key = isLocalFile(thumb);
      if (r2Key) {
        if (!isSafeAssetKey(r2Key)) {
          throw new Error(
            `${entry}: thumb name not deployable: ${r2Key} — rename using only [A-Za-z0-9._-/]`,
          );
        }
        stagedAssets.set(r2Key, join(VAULT_DIR, ...r2Key.split("/")));
      } else {
        console.warn(`skip ${entry}: thumb asset missing: ${thumb}`);
      }
    }

    envelopes.set(slug, {
      slug,
      html: htmlWithAssets,
      headings,
      frontmatter: {
        slug,
        title: frontmatter.title,
        publishedAt: frontmatter.publishedAt,
        displayDate: frontmatter.displayDate,
        category: frontmatter.category,
        thumb,
        description: frontmatter.description,
      },
    });

    const stub: VaultStub = {
      slug,
      publishedAt: frontmatter.publishedAt,
      category: frontmatter.category,
    };
    if (frontmatter.displayDate) stub.displayDate = frontmatter.displayDate;
    if (questionHtml) stub.questionHtml = questionHtml;
    stubs.push(stub);

    hashes.set(slug, frontmatter.passwordHash);
    console.log(`prepared ${slug}`);
  }

  if (envelopes.size === 0) {
    console.log("no vault posts to prepare");
  }

  writeAssets(stagedAssets);
  writeEnvelopes(envelopes);
  console.log(
    `staged ${stagedAssets.size} assets + ${envelopes.size} envelopes in ${STAGING_DIR}`,
  );

  writeStubs(stubs);
  console.log(`wrote ${stubs.length} stubs to ${STUB_DIR}`);

  writeManifest([...hashes.keys()], hashes);
}

runPrepare().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

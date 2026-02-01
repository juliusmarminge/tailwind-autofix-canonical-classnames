import { version } from "../../package.json" with { type: "json" };

const packageJson = Bun.file(Bun.fileURLToPath(new URL("../../package.json", import.meta.url)));
const pkg = await packageJson.json();

const parts = version.split(".").map((part) => Number(part));
if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
  throw new Error(`Invalid version: ${version}`);
}

// Bump the patch version
const [major, minor, patch] = parts;
const next = `${major}.${minor}.${patch + 1}`;

pkg.version = next;
await packageJson.write(JSON.stringify(pkg, null, 2) + "\n");

console.log(`v${next}`);

// Build the extension
await Bun.$`bun run build`;

// Publish to Open VSX
await Bun.$`bunx ovsx publish -p "${process.env.OPEN_VSX_TOKEN}" --skip-duplicate`;

// Commit the version bump
await Bun.$`git add package.json`;
await Bun.$`git commit -m "chore: bump version [skip ci]"`;

// Tag the release
const tag = `v${next}`;
let tagExists = false;
try {
  await Bun.$`git rev-parse ${tag}`;
  tagExists = true;
} catch {
  tagExists = false;
}

if (!tagExists) {
  await Bun.$`git tag ${tag}`;
}

await Bun.$`git push`;
await Bun.$`git push origin ${tag}`;

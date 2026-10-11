#!/usr/bin/env bash
set -euo pipefail

# Optional developer check, outside the pnpm-only gate. Scan the current validator
# image and the actual renderer built from its template, serially (Trivy locks its cache).
REPO="$(cd "$(dirname "$0")/.." && pwd)"
for tool in docker trivy node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "containers:audit: $tool is required; no scan was performed" >&2
    exit 2
  fi
done

output="${1:-$(mktemp -d "${TMPDIR:-/tmp}/skills-container-audit.XXXXXX")}"
mkdir -p "$output"
context="$(mktemp -d "${TMPDIR:-/tmp}/skills-container-build.XXXXXX")"
trap 'rm -rf "$context"' EXIT

python_image="$(sed -n "s/^IMAGE='\([^']*\)'$/\1/p" "$REPO/scripts/check-conformance.sh")"
if [ -z "$python_image" ]; then
  echo "containers:audit: cannot read the conformance image; refusing to guess" >&2
  exit 2
fi

status=0
scan() {
  local image="$1" source="$2" name="$3" rc=0
  rm -f "$output/$name.json"
  trivy image --quiet --scanners vuln --image-src "$source" --exit-code 2 \
    --format json --output "$output/$name.json" "$image" || rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
    echo "containers:audit: $image could not be scanned (exit $rc)" >&2
    status=2
    return
  fi
  if ! node --input-type=module - "$output/$name.json" "$image" <<'JS'
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (report.Results !== undefined && !Array.isArray(report.Results)) throw new Error('invalid Trivy results');
const findings = (report.Results ?? []).flatMap((result) => result.Vulnerabilities ?? []);
const counts = {};
for (const finding of findings) counts[finding.Severity] = (counts[finding.Severity] ?? 0) + 1;
console.log(`${process.argv[3]}: ${findings.length} package findings, ${new Set(findings.map((f) => f.VulnerabilityID)).size} unique advisories; ${JSON.stringify(counts)}`);
console.log(`report: ${process.argv[2]}`);
JS
  then
    echo "containers:audit: $image produced no usable report" >&2
    status=2
    return
  fi
  if [ "$rc" -eq 2 ] && [ "$status" -eq 0 ]; then status=1; fi
}

# Remote lookup avoids a locally cached mutable tag. The renderer is scanned from
# Docker only after a successful build, so it cannot accidentally scan an older build.
scan "$python_image" remote conformance
docker build --pull --no-cache -f "$REPO/skills/docs/vhs-demo/templates/vhs.Dockerfile" \
  -t tituskirch-skills-vhs-audit:local "$context" || {
    echo "containers:audit: renderer build failed; no previous image was scanned" >&2
    exit 2
  }
scan tituskirch-skills-vhs-audit:local docker vhs
exit "$status"

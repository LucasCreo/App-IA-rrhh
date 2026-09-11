#!/bin/bash
# Stages the synced subset of src/components (ui/ + shared/) into a combined
# synth-entry source root. Required before every package-build.mjs run because
# this repo has no library dist/ — see NOTES.md "Re-sync risks" for why the
# scope is limited to these two folders (everything else pulls in
# next/navigation, which breaks the whole shared bundle at runtime).
set -e
cd "$(dirname "$0")/.."
rm -rf .design-sync/.cache/ds-src
mkdir -p .design-sync/.cache/ds-src
cp -r src/components/ui .design-sync/.cache/ds-src/ui
cp -r src/components/shared .design-sync/.cache/ds-src/shared

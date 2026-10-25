#!/usr/bin/env bash
# Deploy only approved static files to Firebase Hosting from Cloud Shell.
# Never stage original student backups, secret keys or school data.
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI is missing. Use Firebase Cloud Shell or install firebase-tools first." >&2
  exit 1
fi
out=".firebase-deploy-safe-public"
if [[ -e "$out" ]]; then
  echo "Safety check: $out already exists; inspect and remove it before retrying." >&2
  exit 1
fi
mkdir -p "$out"
for f in index.html migration.html styles.css app.js migration.js \
  firebase-sync.js config.js service-worker.js manifest.webmanifest robots.txt; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required static asset: $f" >&2
    exit 1
  fi
  cp -- "$f" "$out/"
done
if [[ ! -d icons ]]; then echo "Missing icons directory" >&2; exit 1; fi
cp -R -- icons "$out/"
echo "Safe static files prepared (no real student backups included)."
echo "Publishing to Firebase Hosting project: student-guidance2"
firebase deploy --only hosting --project student-guidance2
echo "If deployment succeeded, open https://student-guidance2.web.app/"

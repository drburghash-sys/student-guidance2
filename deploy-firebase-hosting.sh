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
  if [[ -L "$out" || ! -d "$out" ]]; then echo "Invalid staging directory" >&2; exit 1; fi
  # Only remove an earlier generated public folder if it contains exclusively
  # known static files and icons; refuse any unexpected, possibly private file.
  for entry in "$out"/* "$out"/.[!.]* "$out"/..?*; do
    [[ -e "$entry" || -L "$entry" ]] || continue
    case "${entry##*/}" in
      index.html|migration.html|styles.css|app.js|migration.js|firebase-sync.js|config.js|pdf-export.js|service-worker.js|manifest.webmanifest|robots.txt|icons) ;;
      *) echo "Unexpected file in staging folder; refusing to redeploy: $entry" >&2; exit 1 ;;
    esac
  done
  rm -rf -- "$out"
fi
mkdir -p "$out"
for f in index.html migration.html styles.css app.js migration.js \
  firebase-sync.js config.js pdf-export.js service-worker.js manifest.webmanifest robots.txt; do
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

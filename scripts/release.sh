#!/usr/bin/env bash
# RegUP demo: tekshirish va GitHub'ga joylash.
#
#   bash scripts/release.sh check     — testlar + build + sahifalarni avtomatik tekshirish (hech narsa joylanmaydi)
#   bash scripts/release.sh publish   — check, keyin: main'ga push, versiya tegi, build'ni gh-pages'ga joylash
#
# publish faqat barcha o'zgarishlar commit qilingan bo'lsa ishlaydi. Biror qadam xato bersa,
# skript to'xtaydi va ochiq sayt eski holatda qoladi.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL=$(git remote get-url origin)

step() { printf '\n▸ %s\n' "$1"; }
die() { printf '\n✗ %s\n' "$1" >&2; exit 1; }

check() {
  step "Testlar"
  npx vitest run --reporter=dot
  step "Build"
  rm -rf dist
  npx vite build --logLevel warn
  step "Sahifalarni avtomatik tekshirish (admin/xodim, yorug'/qorong'i, kompyuter/telefon)"
  node scripts/smoke.mjs
}

next_version() {
  local d n
  d=$(date +%Y.%m.%d)
  n=1
  while git rev-parse -q --verify "refs/tags/v$d-$n" >/dev/null || git ls-remote --exit-code --tags origin "v$d-$n" >/dev/null 2>&1; do n=$((n + 1)); done
  echo "v$d-$n"
}

publish() {
  [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "main branchida emassiz"
  [ -z "$(git status --porcelain)" ] || die "Commit qilinmagan o'zgarishlar bor. Avval commit qiling."
  git fetch -q origin main
  git merge-base --is-ancestor origin/main HEAD || die "GitHub'dagi main'da sizda yo'q o'zgarishlar bor. Avval ularni oling (git pull)."

  check

  local v msg tmp
  v=$(next_version)
  msg=$(git log -1 --format=%s)
  step "Versiya: $v"
  git tag -a "$v" -m "$msg"
  git push -q origin main "$v"

  step "Build'ni gh-pages'ga joylash"
  tmp=$(mktemp -d)
  git clone -q --branch gh-pages --single-branch "$REPO_URL" "$tmp/pages"
  git -C "$tmp/pages" rm -q -r --ignore-unmatch assets index.html
  cp -R dist/assets dist/index.html "$tmp/pages/"
  git -C "$tmp/pages" add -A
  if git -C "$tmp/pages" diff --cached --quiet; then
    echo "  Build oldingisi bilan bir xil — saytda o'zgarish yo'q."
  else
    git -C "$tmp/pages" commit -q -m "Deploy $v: $msg"
  fi
  git -C "$tmp/pages" tag -a "pages-$v" -m "$v (build)"
  git -C "$tmp/pages" push -q origin gh-pages "pages-$v"
  rm -rf "$tmp"

  printf '\n✓ %s joylandi: https://izzatbekadhamov.github.io/regup-demo/ (1–10 daqiqada yangilanadi)\n' "$v"
  printf '  Claude artifact uchun: dist/ papkasini artifactga qayta joylash kerak (Claude qiladi).\n'
  printf '  Orqaga qaytish: bash scripts/rollback.sh <oldingi versiya>\n'
}

case "${1:-}" in
  check) check; printf '\n✓ Hammasi o‘tdi. Joylash: bash scripts/release.sh publish\n' ;;
  publish) publish ;;
  *) echo "Ishlatish: bash scripts/release.sh check | publish"; exit 2 ;;
esac

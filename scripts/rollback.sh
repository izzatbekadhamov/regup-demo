#!/usr/bin/env bash
# RegUP demo: ochiq saytni oldingi versiyaga qaytarish.
#
#   bash scripts/rollback.sh                   — mavjud versiyalar ro'yxati
#   bash scripts/rollback.sh v2026.11.26-1      — saytni (gh-pages) shu versiyaga qaytarish
#   bash scripts/rollback.sh v2026.11.26-1 --source  — manba kodni (main) ham shu versiyaga qaytarish
#
# Hech narsa o'chirilmaydi: qaytarish tarixga yangi commit bo'lib qo'shiladi, keyin yana oldinga o'tish mumkin.
# Shu versiyaning build fayllari dist-rollback/ ga ham chiqariladi — Claude artifactga ularni joylaydi.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL=$(git remote get-url origin)
git fetch -q --tags origin

if [ -z "${1:-}" ]; then
  echo "Mavjud versiyalar (eng yangisi tepada):"
  git for-each-ref --sort=-v:refname --format='  %(refname:short)  %(creatordate:short)  %(contents:subject)' 'refs/tags/v*'
  echo; echo "Qaytarish: bash scripts/rollback.sh <versiya> [--source]"
  exit 0
fi

V="$1"
git rev-parse -q --verify "refs/tags/pages-$V" >/dev/null || { echo "✗ pages-$V tegi topilmadi. Ro'yxat: bash scripts/rollback.sh"; exit 1; }

printf '\n▸ Sayt (gh-pages) %s ga qaytarilmoqda\n' "$V"
tmp=$(mktemp -d)
git clone -q --branch gh-pages --single-branch "$REPO_URL" "$tmp/pages"
git -C "$tmp/pages" fetch -q origin "refs/tags/pages-$V:refs/tags/pages-$V"
git -C "$tmp/pages" rm -q -r --ignore-unmatch assets index.html
git -C "$tmp/pages" checkout "pages-$V" -- .
git -C "$tmp/pages" add -A
if git -C "$tmp/pages" diff --cached --quiet; then
  echo "  Sayt allaqachon shu versiyada."
else
  git -C "$tmp/pages" commit -q -m "Rollback: sayt $V ga qaytarildi"
  git -C "$tmp/pages" push -q origin gh-pages
  echo "  ✓ Sayt qaytarildi (1–10 daqiqada ko'rinadi)."
fi
rm -rf dist-rollback && mkdir -p dist-rollback
cp -R "$tmp/pages/assets" "$tmp/pages/index.html" dist-rollback/
rm -rf "$tmp"
echo "  Build fayllari: dist-rollback/ (Claude artifact uchun)"

if [ "${2:-}" = "--source" ]; then
  printf '\n▸ Manba kod (main) %s ga qaytarilmoqda\n' "$V"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "✗ Commit qilinmagan o'zgarishlar bor — manba kod qaytarilmadi."; exit 1; }
  git pull -q --ff-only origin main
  if [ "$(git rev-parse "$V^{commit}")" = "$(git rev-parse HEAD)" ]; then
    echo "  Manba kod allaqachon shu versiyada."
  else
    ORIG=$(git rev-parse HEAD)
    git revert --no-edit "$V..HEAD" >/dev/null
    # Joylash/qaytarish vositalari eski versiyada bo'lmasa ham saqlanib qoladi
    git checkout "$ORIG" -- scripts package.json package-lock.json .gitignore
    if ! git diff --cached --quiet; then git commit -q -m "Rollback: joylash va qaytarish skriptlari saqlab qolindi"; fi
    git push -q origin main
    echo "  ✓ main $V holatiga qaytarildi (revert commitlari qo'shildi)."
  fi
fi
printf '\n✓ Tayyor.\n'

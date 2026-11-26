#!/usr/bin/env bash
# Copia a versão mais recente do jogo para jogo/ dentro do site.
# Uso: tools/atualizar-jogo.sh [pasta-do-jogo]   (padrão: ~/Downloads/game)
set -euo pipefail
SRC="${1:-$HOME/Downloads/game}"
DST="$(cd "$(dirname "$0")/.." && pwd)/jogo"
[ -f "$SRC/index.html" ] || { echo "Não achei $SRC/index.html" >&2; exit 1; }
rm -rf "$DST"; mkdir -p "$DST"
# só o que o navegador precisa; ferramentas de teste e arquivos de editor ficam de fora
tar -C "$SRC" -cf - \
  --exclude './.git' --exclude './.godot' --exclude './tools' --exclude './node_modules' \
  --exclude '*.tgz' --exclude '*.zip' --exclude '.DS_Store' . | tar -C "$DST" -xf -
echo "Jogo copiado de $SRC para $DST ($(du -sh "$DST" | cut -f1))."

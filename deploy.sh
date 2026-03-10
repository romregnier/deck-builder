#!/bin/bash
# ⚠️  DEPLOY SCRIPT — Deck Builder
# Domaine CORRECT : deck-builder.surge.sh
# NE PAS déployer sur the-tailor.surge.sh (projet différent — avatar 3D)

set -e

echo "📦 Build..."
npm run build

echo "🚀 Deploy → deck-builder.surge.sh"
SURGE_TOKEN=ff76844a18a0a46b59bad88b5d5d1060 npx surge dist deck-builder.surge.sh

echo "✅ Déployé sur https://deck-builder.surge.sh"

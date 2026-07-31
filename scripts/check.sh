#!/usr/bin/env sh
set -eu
(cd frontend && npm run lint && npm test -- --run && npm run build)
(cd backend && pytest -q)
for workflow in n8n/workflows/*.json; do
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$workflow"
done
echo "All checks passed."

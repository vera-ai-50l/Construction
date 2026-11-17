#!/usr/bin/env bash
# Without n8n: run the Type A pipeline from cron and keep the results in out/runs/.
# crontab -e:  17 7 * * 1  /opt/leads/lead-scraper/deploy/cron-type-a.sh >> /var/log/leads-type-a.log 2>&1
# (Mondays 07:17. Needs node 22 and the repo's npm install; or use the Docker image.)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f deploy/.env ] && . deploy/.env; set +a
exec node --no-warnings src/pipeline.mjs --preset type_a

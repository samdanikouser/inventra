#!/usr/bin/env bash
# Render build script — runs on every deploy.
# Installs deps, collects static, applies migrations, then bootstraps
# the role Groups and the first superuser (idempotent).

set -o errexit  # exit on first error

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Idempotent — creates role groups every deploy, and creates the first
# superuser only if DJANGO_SUPERUSER_* env vars are set AND no superuser
# exists yet.
python manage.py bootstrap

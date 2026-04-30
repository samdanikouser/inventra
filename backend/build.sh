#!/usr/bin/env bash
# Render build script — runs on every deploy.
# Installs deps, collects static files, then applies migrations.

set -o errexit  # exit on first error

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

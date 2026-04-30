"""
Bootstrap command — runs on every deploy via build.sh.

Idempotent setup for fresh environments (Render, Docker, fresh local DB):
  1. Creates the three role Groups (MANAGER / SUPERVISOR / STAFF).
  2. Creates a superuser when DJANGO_SUPERUSER_* env vars are set AND
     no superuser exists yet.

Safe to run repeatedly — every step is a no-op when the target already exists.
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, User


class Command(BaseCommand):
    help = "Idempotent bootstrap: create role groups + first superuser."

    def handle(self, *args, **options):
        self._ensure_groups()
        self._ensure_superuser()

    # ----- Groups -------------------------------------------------------
    def _ensure_groups(self):
        roles = ['MANAGER', 'SUPERVISOR', 'STAFF']
        created = []
        for name in roles:
            _, was_created = Group.objects.get_or_create(name=name)
            if was_created:
                created.append(name)
        if created:
            self.stdout.write(self.style.SUCCESS(
                f"Created groups: {', '.join(created)}"
            ))
        else:
            self.stdout.write("Groups already exist — skipping.")

    # ----- Superuser ----------------------------------------------------
    def _ensure_superuser(self):
        username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
        email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')

        if not username or not password:
            self.stdout.write(
                "DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD not set — "
                "skipping superuser bootstrap."
            )
            return

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write("A superuser already exists — skipping.")
            return

        User.objects.create_superuser(
            username=username, email=email, password=password,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Created superuser '{username}'."
        ))

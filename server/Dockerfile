FROM python:3.12-slim AS build
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*
RUN pip install uv
WORKDIR /app
# Copy project metadata and (optionally) lockfile for better caching
COPY pyproject.toml ./
COPY uv.lock* ./
# Install dependencies; if no lockfile present, create it first
RUN if [ -f uv.lock ]; then \
			uv sync --frozen; \
		else \
			echo "No uv.lock found; generating lock and installing"; \
			uv lock && uv sync; \
		fi
COPY . .
# Collect static files (ignore errors if no static apps yet)
RUN uv run python manage.py collectstatic --noinput || true

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=build /app /app
# Activate venv by default
ENV VIRTUAL_ENV=/app/.venv \
	PATH="/app/.venv/bin:$PATH" \
	PYTHONPATH="/app/backend:$PYTHONPATH"
RUN useradd -m django && chown -R django:django /app
USER django
EXPOSE 8000
RUN chmod +x backend/entrypoint.sh || true
ENTRYPOINT ["bash", "backend/entrypoint.sh"]

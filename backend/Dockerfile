# One image for the API and the worker (F48). Build from backend/:
#   docker build -t johnson-road-backend .                       (API only, stub/no model)
#   docker build -t johnson-road-backend --build-arg WITH_AI=1 .  (adds torch + ultralytics: large)
# Run the API:     docker run --env-file .env -p 5000:5000 johnson-road-backend
# Run the worker:  docker run --env-file .env johnson-road-backend python -m app.worker
# Apply migrations once per release, before starting new API/worker containers:
#                  docker run --env-file .env johnson-road-backend python -m app.database.migrate
# Secrets come from the environment at run time; none are copied into the image (.dockerignore excludes .env).
FROM python:3.12-slim

ARG WITH_AI=0
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# OpenCV needs these shared libraries at run time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt requirements-ai.txt ./
RUN pip install -r requirements.txt \
 && if [ "$WITH_AI" = "1" ]; then pip install -r requirements-ai.txt; fi

COPY app ./app
COPY migrations ./migrations

# Run as an unprivileged user; storage is a mounted volume owned by it.
RUN useradd --create-home --uid 10001 jr && mkdir -p /data && chown jr /data
USER jr
ENV STORAGE_ROOT=/data
VOLUME ["/data"]

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/live', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers"]

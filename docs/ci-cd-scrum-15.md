# SCRUM-15 CI/CD and Container Foundation

## Added Workflow

- `.github/workflows/ci.yml`

## Pipeline Steps

1. Checkout the repository.
2. Install Node.js 20 with npm cache.
3. Run `npm ci`.
4. Run `npm test`.
5. Run `npx tsc --noEmit`.
6. Run `npx eslint .`.

## Container Assets Already Present

- `Dockerfile` for the Next.js app.
- `docker-compose.yml` for local multi-service development.
- `docker-compose.prod.yml` for production-style composition.
- `backend/Dockerfile` for the FastAPI backend.

## Safety Notes

- The workflow does not mutate infrastructure or deploy artifacts.
- The local-only `.docker-compose.local.yml` file remains untouched.
- The new CI job only verifies the current codebase foundations.

## Local Verification Commands

```bash
npm test
npx tsc --noEmit
npx eslint .
```

## Production Follow-Ups

- Add image build and registry publish jobs once branch and registry rules are finalized.
- Add migration/seed gating for deployment jobs instead of baking that logic into CI.
- Add environment-specific deployment workflows after the cloud target is fixed.

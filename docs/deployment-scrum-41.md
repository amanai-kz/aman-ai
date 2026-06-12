# SCRUM-41 Deployment Modes Foundation

## Supported Modes

- `AMAN_DEPLOYMENT_MODE=local`
- `AMAN_DEPLOYMENT_MODE=cloud`

## Local Mode

- Default if `AMAN_DEPLOYMENT_MODE` is unset.
- Uses file-backed site configuration through `SITE_CONFIG_PATH`.
- Works with the current Docker/local Prisma development setup.
- Recommended commands:

```bash
docker compose up -d db
npm test
npx tsc --noEmit
npm run dev
```

## Cloud Mode

- Uses environment-backed site configuration.
- `PATCH /api/admin/site-config` becomes read-only and returns `409 SITE_CONFIG_READ_ONLY`.
- Intended for platforms where configuration is managed through environment variables or secret managers.

## Environment Variables

- `AMAN_DEPLOYMENT_MODE`
- `SITE_CONFIG_PATH`
- `SITE_NAME`
- `DICOM_ENDPOINT`
- `FHIR_ENDPOINT`
- `INFERENCE_ENDPOINT`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URI`

## Health and Check Commands

```bash
npm test
npx tsc --noEmit
npx eslint .
docker compose ps
```

## Safe Production Checklist

- Set `NODE_ENV=production`.
- Provide `AUTH_SECRET`.
- Provide `DATABASE_URL`.
- Configure public endpoint values for DICOM, FHIR, inference, and OIDC.
- Keep OIDC client secrets in a secret manager, not in site-config API payloads.
- Treat local file-backed site config as a development convenience only unless persistent disk is guaranteed.

## What Is Foundation-Only

- No cloud deployment workflow is pushed yet.
- No managed secret-store integration is implemented yet.
- No runtime platform-specific health endpoint changes were needed for this sprint.

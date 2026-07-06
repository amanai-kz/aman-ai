# SCRUM-80 Backend Login Auth

## What was unsafe before

`/api/v1/auth/login` accepted any email and password and issued a signed JWT.
The token used caller-controlled identity data, so a caller could request a
token for another user and bypass patient authorization added in SCRUM-60.

The backend also had a production-unsafe `SECRET_KEY` default.

## New login behavior

`POST /api/v1/auth/login` now:

- looks up `users.email` in the existing Prisma-owned `users` table
- requires a stored password hash
- verifies the submitted password with passlib bcrypt
- returns `401` for an unknown email or wrong password
- issues a bearer JWT only after credential verification

The response shape remains:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

## Token identity source

JWT claims are derived from database rows, not request body fields:

- `sub`: `users.id`
- `role`: `users.role`
- `patient_id`: `patients.id` where `patients.userId = users.id`
- `doctor_id`: `doctors.id` where `doctors.userId = users.id`
- `assigned_patient_ids`: `doctor_patients.patientId` for the doctor

FastAPI has no SQLAlchemy ORM models for these Prisma tables, so
`backend/app/core/auth_repository.py` uses small parameterized SQL queries
through the existing async SQLAlchemy session.

## Doctor assignment handling

Login includes `assigned_patient_ids` as a DB-derived token-time snapshot for
frontend/backend compatibility.

Protected FastAPI request auth does not trust those assignment claims for the
current authorization context. It validates the JWT signature and expiry, then
uses the token subject (`sub`) to reload user role, patient id, doctor id, and
doctor-patient assignments from the database.

Explicit `X-Test-*` headers are still allowed only when `AMAN_AUTH_TEST_MODE=1`.

## SECRET_KEY requirement

Production fails fast if `SECRET_KEY` is:

- missing or empty
- `super-secret-key-change-in-production`
- the dev-only default
- shorter than 32 characters

Generate a production value with:

```bash
openssl rand -hex 32
```

Then set:

```env
SECRET_KEY="replace-with-generated-secret"
```

Do not commit the generated value.

## Local/dev/test behavior

Development and test modes can use the dev-only default or an explicit test
secret. Production is detected when `ENVIRONMENT=production`,
`NODE_ENV=production`, or `DEBUG=false`.

## Tests added

`backend/tests/test_auth_scrum_80.py` covers:

- correct email/password returns a token
- wrong password and unknown email return `401`
- caller-supplied role/patient/doctor/assignment fields are ignored
- patient token claims come from DB fixtures
- doctor assignments come from `doctor_patients`
- production SECRET_KEY validation rejects unsafe values
- SCRUM-60 protected encounter endpoint accepts a valid DB-backed token
- invalid bearer token returns `401`

## Production checklist

- Set a strong `SECRET_KEY`.
- Keep Prisma migrations for `users`, `patients`, `doctors`, and
  `doctor_patients` applied before enabling backend login.
- Consider shortening JWT expiry if assignment revocation needs faster effect.
- Add Alembic or shared migration coverage if FastAPI begins owning these
  tables directly.

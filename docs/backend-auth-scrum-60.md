# SCRUM-60 Backend Auth

## Protected endpoints

Authentication is required for these FastAPI route groups:

- `/api/v1/encounters`
- `/api/v1/users`
- `/api/v1/services/ct-mri`
- `/api/v1/services/blood`
- `/api/v1/services/genetics`
- `/api/v1/services/questionnaire`
- `/api/v1/services/iot`
- `/api/v1/services/rehabilitation`

`/api/v1/auth/login` and `/api/v1/auth/register` remain public. `/api/v1/auth/me` now requires authentication.

## Auth model

The backend auth dependency returns:

```json
{
  "user_id": "user id from token subject",
  "role": "ADMIN | DOCTOR | PATIENT",
  "patient_id": "optional patient id",
  "doctor_id": "optional doctor id"
}
```

Production requests must use `Authorization: Bearer <jwt>` signed with the backend `SECRET_KEY`. Tokens must include a `role` claim. Patient and doctor ids are optional claims, but patient-scoped checks need the relevant patient id context.

## Role rules

- `ADMIN`: may access any patient.
- `PATIENT`: may access only `patient_id` matching their authenticated context.
- `DOCTOR`: may access patients listed in authenticated `assigned_patient_ids`.

The TypeScript app resolves doctor assignment through Prisma `DoctorPatient`. The FastAPI database currently only has the `encounters` table, so FastAPI cannot query `doctor_patients` yet. Until those tables are shared or mirrored, doctor assignment is accepted only from signed JWT claims or explicit test-mode headers.

## Local and test auth

`X-User-Id` is not authentication and is ignored.

Tests can set:

```env
AMAN_AUTH_TEST_MODE=1
```

Then use explicit headers:

```http
X-Test-User-Id: doctor-user
X-Test-Role: DOCTOR
X-Test-Doctor-Id: doctor-1
X-Test-Assigned-Patient-Ids: patient-1,patient-2
```

Do not enable `AMAN_AUTH_TEST_MODE` in production.

## Behavior

- Missing auth returns `401`.
- Authenticated users without patient/user permission return `403`.
- Existing not-found placeholders still return `404` after auth succeeds.
- Existing response shapes are preserved for successful mock/service responses.

## What changed

- Encounters now use the authenticated user id, not `X-User-Id` or `?user_id`.
- User read/update/delete routes require auth; delete is admin-only.
- Patient-data route groups require auth.
- Routes that accept `patient_id` call the shared patient access guard.

## Production follow-ups

- Replace mock `/auth/login` with real user lookup and password verification.
- Share or mirror the Prisma user/patient/doctor/doctor_patients tables in FastAPI.
- Put doctor patient assignments in signed backend-issued tokens only after validating them from the database.

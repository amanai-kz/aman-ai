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

Production requests must use `Authorization: Bearer <jwt>` signed with the backend `SECRET_KEY`. SCRUM-80 changes backend-issued tokens so role, patient id, doctor id, and doctor assignments are loaded from the database instead of caller input.

## Role rules

- `ADMIN`: may access any patient.
- `PATIENT`: may access only `patient_id` matching their authenticated context.
- `DOCTOR`: may access patients listed in authenticated `assigned_patient_ids`.

The TypeScript app resolves doctor assignment through Prisma `DoctorPatient`. SCRUM-80 adds a small FastAPI repository that queries the same Prisma-owned `users`, `patients`, `doctors`, and `doctor_patients` tables for login and JWT request authorization.

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

- Keep Prisma migrations for `users`, `patients`, `doctors`, and `doctor_patients` available to the FastAPI database connection.
- Consider shorter JWT expiry or assignment-version checks if doctor assignment revocation must take effect immediately.

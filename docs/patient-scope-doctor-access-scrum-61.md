# SCRUM-61 Patient-Scoped Doctor Access

## Routes protected

- `GET /api/consultation`
- `GET /api/reports`
- `POST /api/ingestion/studies`
- `POST /api/inference/jobs`
- `GET /api/inference/jobs/[id]`

## Role rules

Matches `src/lib/authz.ts`:

- `ADMIN`: can access all patients.
- `DOCTOR`: can access only patients linked through `DoctorPatient`.
- `PATIENT`: can access only their own patient record.

## Before / after

Before:

- Doctor listing routes could return reports for every patient.
- Doctor ingestion and inference only checked role, not assigned patient access.

After:

- Consultation and voice report listings add SQL patient filters for doctors.
- Ingestion validates the target `patientId` with `assertPatientAccess`.
- Inference validates the loaded analysis patient with `assertPatientAccess`.

## Sample 403

```json
{
  "error": "Doctor is not assigned to this patient",
  "errorKey": "FORBIDDEN"
}
```

## Tests added

- Report listing scope tests for admin, patient, and doctor filters.
- Ingestion test for unassigned doctor `403`.
- Inference tests for admin create, assigned doctor status, and unassigned doctor `403` on create/status.

## Production follow-ups

None for this ticket. The fix uses the existing `DoctorPatient` authorization model and database tables.

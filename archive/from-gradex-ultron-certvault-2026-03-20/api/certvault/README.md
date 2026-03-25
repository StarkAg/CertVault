# CertVault API

Certificate verification system for IEEE CS SRM Hize.

## Endpoints

### POST /api/certvault/verify

Verify a certificate by ID and recipient name.

**Request Body:**
```json
{
  "certificateId": "CV-2026-D60377",
  "name": "John Doe"
}
```

**Response (Verified):**
```json
{
  "success": true,
  "verified": true,
  "certificateData": {
    "name": "John Doe",
    "event": "IEEE CS Workshop 2026",
    "date": "March 15, 2026",
    "organization": "IEEE CS SRM Hize"
  }
}
```

**Response (Not Verified):**
```json
{
  "success": true,
  "verified": false,
  "message": "Name does not match our records for this certificate"
}
```

## Database Schema

The API expects a `certificates` table in Supabase with columns:

- `certificate_id` (text, primary key)
- `recipient_name` (text)
- `event_name` (text, optional)
- `issue_date` (date, optional)
- `organization` (text, optional)

## Frontend

Verification page: `/certvault/verify?id=CV-2026-D60377`

The page uses a hardcoded verified attendees list (no API call) for instant verification.

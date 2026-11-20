# Digital Diary Backup Specification (Format Version 2.0) 📄

This document specifies the standard portable JSON backup format for the **Digital Diary** application. This specification ensures that any third-party tool, custom script, or future version of the application can accurately parse and restore diary data for decades to come.

---

## 🏗️ Top-Level JSON Schema

```json
{
  "format_version": "2.0",
  "app_name": "My Diary",
  "created_at": "2026-11-20T08:30:00.000Z",
  "user_id": "optional-origin-user-uuid",
  "notes": [
    {
      "id": "note-001",
      "user_id": "optional-user-uuid",
      "title": "Today's Business Hisaab",
      "content": "Raju se ₹5,000 lena hai\nSohail ko ₹2,500 diya",
      "color": "sand",
      "is_pinned": true,
      "is_archived": false,
      "is_deleted": false,
      "is_checklist": false,
      "checklist_items": [],
      "reminder_date": null,
      "labels": [
        {
          "id": "lbl-001",
          "name": "Business",
          "color": "#3B82F6"
        }
      ],
      "created_at": "2026-11-19T10:00:00.000Z",
      "updated_at": "2026-11-19T12:00:00.000Z"
    }
  ],
  "labels": [
    {
      "id": "lbl-001",
      "name": "Business",
      "color": "#3B82F6",
      "created_at": "2026-11-19T10:00:00.000Z"
    }
  ],
  "note_versions": [
    {
      "id": "ver-001",
      "note_id": "note-001",
      "title": "Today's Business Hisaab (Draft)",
      "content": "Raju se ₹5,000 lena hai",
      "color": "sand",
      "is_checklist": false,
      "version_number": 1,
      "change_summary": "Auto checkpoint before update",
      "created_at": "2026-11-19T10:30:00.000Z"
    }
  ],
  "user_preferences": {},
  "metadata": {
    "notes_count": 1,
    "labels_count": 1,
    "versions_count": 1,
    "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "generated_by": "Digital Diary Data Protection System v2.0"
  }
}
```

---

## 🔒 Security & Privacy Rules

1. **NO Private Credentials**:
   - The backup **never** contains passwords, Supabase JWT tokens, Google API keys, or secret tokens.
2. **Deterministic Checksum (SHA-256)**:
   - Checksum is computed over the canonical JSON string of `{ format_version, notes, labels, note_versions, user_preferences }` with notes and labels sorted by `id`.
   - Any tampering or truncation causes verification failure.
3. **Decoupled User Identity**:
   - The `user_id` field is treated as informational only.
   - During restore, notes and labels are remapped dynamically to the authenticated user's current ID (`auth.uid()`), ensuring complete recovery across independent database projects.

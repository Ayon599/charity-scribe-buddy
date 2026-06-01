## One-time import: 51 members from your Excel

### Source
`Prottoy Foundation Account Summary Up To 16 March 2025 (1).xlsx` — 51 rows, columns: Member No, Member Name, Reference Person Name, Member Type, Mobile Number, Email Address.

### Data summary
- **Member Nos**: 1–51
- **Type "Founding & Executive"**: rows 1–13 (linked to BOTH Founding and Executive types)
- **Type "General"**: rows 14–51
- **Reference Person**: present from row 14 onwards
- **Email**: only row 1 (`opunurullah@gmail.com`)
- **Mobile**: most rows, a few blank (rows 35–38, 40–50)
- **Existing in DB**: members #1 (Md Nurullah) and #14 (Asfat) — these will be **updated** per your choice
- **Member types**: Founding, Executive, General all already exist in DB — nothing to auto-create

### What I'll run (single SQL via the insert tool — no schema changes)
1. **Upsert into `members`** keyed on `member_no`:
   - `full_name`, `mobile` (blank → NULL), `email` (blank → NULL), `reference_person` (blank → NULL)
   - `joining_date` = today for new rows, kept as-is for existing rows
   - `is_active = true`
2. **Replace `member_member_types` links** for these 51 members:
   - Delete existing links for member_no 1–51
   - Insert: rows 1–13 → Founding + Executive (2 links each), rows 14–51 → General (1 link)

### After import
You'll see all 51 members on the `/members` page, with the type chips showing **Founding · Executive** for the first 13 and **General** for the rest. Reference Person column will be populated from row 14.

### Not in scope
- Monthly fees, joining dates, addresses (not in your sheet)
- Fund subscriptions (separate page)
- No UI changes
# Dues table: renamed columns, month counts, horizontal scroll

Presentation-only changes on the Dues page. No calculation, database, or business-logic changes.

## Column headers

| Now | Becomes |
| --- | --- |
| No. | Member Number |
| Member | Member Name |
| Fund | Fund Name |
| Joining month | Joining Month |
| Monthly | Monthly Amount |
| Months | Total Month |
| Expected | Expected Amount |
| — (new) | Paid Month |
| Paid | Paid Amount |
| — (new) | Due Month |
| Due | Due Amount |

## Behaviour

- Joining Month renders as "August 2024" instead of `2024-08`.
- Paid Month = number of months covered by payments = Paid Amount ÷ Monthly Amount, rounded down. Shows `—` for one-time funds (Registration) where there is no monthly amount.
- Due Month = Total Month − Paid Month, floored at 0. Shows `—` for one-time funds.
- The table sits in a horizontally scrollable container so all 11 columns stay readable on narrow screens; header row and totals row stay aligned.
- Totals row column span updated to match the new column count.

## Technical notes

- All edits in `src/pages/Dues.tsx`: add `joiningLabel`, `paidMonths`, `dueMonths` to the row mapping in the existing `useMemo`, and update the table markup.
- Month label formatted with `toLocaleString("en-US", { month: "long", year: "numeric" })` from the existing start date.
- Scroll: wrap the table in `overflow-x-auto` on the bordered container with `min-w-max` on the table.

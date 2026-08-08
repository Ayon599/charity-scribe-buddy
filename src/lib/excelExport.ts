// Excel export — rebuilds the "Reg and Monthly" sheet layout from live data.
import * as XLSX from "xlsx";
import { ymToHeader } from "./excelSheet";

export type ExportMember = {
  member_no: number;
  full_name: string;
  reference_person: string | null;
  member_type: string;
  registration_fee: number | null;
  registration_date: string | null;
  /** ym -> { date, amount } */
  monthly: Record<string, { date: string; amount: number }>;
};

/** Inclusive list of "YYYY-MM" between two months. */
export function monthRange(startYm: string, endYm: string): string[] {
  const out: string[] = [];
  let [y, m] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function buildRegAndMonthlyWorkbook(members: ExportMember[], months: string[]) {
  const aoa: (string | number | null)[][] = [
    [
      "Member No", "Member Name", "Reference Person Name", "Member Type", "Fee",
      ...months.flatMap((ym) => ["Date", ymToHeader(ym)]),
    ],
  ];

  for (const m of members) {
    const row: (string | number | null)[] = [
      m.member_no,
      m.full_name,
      m.reference_person ?? null,
      m.member_type,
      m.registration_fee ?? null,
      ...months.flatMap((ym) => {
        const cell = m.monthly[ym];
        return [cell ? cell.date : null, cell ? cell.amount : null];
      }),
    ];
    // Column F is the registration / first payment date in the source layout.
    if (!row[5]) row[5] = m.registration_date ?? null;
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 10 }, { wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 8 },
    ...months.flatMap(() => [{ wch: 12 }, { wch: 13 }]),
  ];
  ws["!freeze"] = { xSplit: "2", ySplit: "1" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reg and Monthly");
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName, { bookType: "xlsx", compression: true });
}

import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { filterTenders } from "@/lib/tender-logic";
import { MILESTONE_DEFS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await requireUser();
  const isAdmin = ctx.profile.role === "admin";

  const { searchParams } = new URL(request.url);
  const filters = {
    period: searchParams.get("period") ?? "all",
    area: searchParams.get("area") ?? "all",
    entitas: searchParams.get("entitas") ?? "all",
    customer: searchParams.get("customer") ?? "all",
    result: searchParams.get("result") ?? "all",
    search: searchParams.get("search") ?? "",
  };

  const tenders = await getAllTenders();
  const rows = filterTenders(tenders, filters);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tenders");

  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Area", key: "area", width: 14 },
    { header: "Tender No.", key: "tenderNo", width: 16 },
    { header: "Customer", key: "customer", width: 30 },
    { header: "Package", key: "product", width: 50 },
    { header: "Entity", key: "entitas", width: 14 },
    { header: "Period", key: "period", width: 12 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "OE (Rp)", key: "oe", width: 16 },
    { header: "OE Note", key: "oeCatatan", width: 20 },
    { header: "Bid Value (Rp)", key: "nilaiPenawaran", width: 16 },
    { header: "P&L", key: "pnl", width: 8 },
    ...MILESTONE_DEFS.map((d) => ({ header: d.label, key: d.key, width: 16 })),
    { header: "Result", key: "result", width: 20 },
    { header: "Carry Over", key: "carryOver", width: 20 },
    { header: "Remarks", key: "remarks", width: 50 },
    { header: "Remark", key: "remark", width: 30 },
    ...(isAdmin ? [{ header: "Internal Notes", key: "catatanInternal", width: 40 }] : []),
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((t) => {
    sheet.addRow({
      no: t.rowNo,
      area: t.area,
      tenderNo: t.tenderNo,
      customer: t.customer,
      product: t.product,
      entitas: t.entitas,
      period: t.period,
      qty: t.qty,
      oe: t.oe,
      oeCatatan: t.oeCatatan,
      nilaiPenawaran: t.nilaiPenawaran,
      pnl: t.pnl ? "Yes" : "",
      ...Object.fromEntries(MILESTONE_DEFS.map((d) => [d.key, t.milestones[d.key]])),
      result: t.result,
      carryOver: t.carryOver,
      remarks: t.remarks,
      remark: t.remark,
      ...(isAdmin ? { catatanInternal: t.catatanInternal } : {}),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `tenders-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

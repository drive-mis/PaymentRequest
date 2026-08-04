import type { PendingApplication } from "./types";

// Single source of truth for the pending-application upload: the template
// headers, the parser, and the validator all read from COLUMNS, so they can
// never disagree about what a valid sheet looks like.

type ColumnType = "text" | "number";

export interface UploadColumn {
  /** Canonical header written into the downloadable template. */
  header: string;
  field: keyof PendingApplication;
  type: ColumnType;
  required: boolean;
  /** Extra header spellings accepted on import (matched case-insensitively). */
  aliases?: string[];
  example: string;
}

export const COLUMNS: UploadColumn[] = [
  { header: "DRV_SALES_MAN", field: "DRV_SALES_MAN", type: "text", required: true, aliases: ["Sales Agent", "Sales Man", "Assigned Sales Agent", "Sales"], example: "Mona Aziz" },

  { header: "CUSTOMER_NAME", field: "CUSTOMER_NAME", type: "text", required: true, aliases: ["Customer Name"], example: "Ahmed Samir Fathallah" },
  { header: "CUSTOMER_ID_NUMBER", field: "CUSTOMER_ID_NUMBER", type: "text", required: true, aliases: ["Customer ID", "ID Number", "National ID"], example: "29001011234567" },
  { header: "APP_CUSTOMER_TYPE", field: "APP_CUSTOMER_TYPE", type: "text", required: true, aliases: ["Customer Type"], example: "Individual" },
  { header: "CUSTOMER_TITLE", field: "CUSTOMER_TITLE", type: "text", required: false, aliases: ["Title"], example: "Mr." },
  { header: "CUSTOMER_GENDER", field: "CUSTOMER_GENDER", type: "text", required: false, aliases: ["Gender"], example: "Male" },
  { header: "CUSTOMER_NATIONALITY", field: "CUSTOMER_NATIONALITY", type: "text", required: false, aliases: ["Nationality"], example: "Egyptian" },
  { header: "CUSTOMER_CLASS", field: "CUSTOMER_CLASS", type: "text", required: false, aliases: ["Customer Class", "Class"], example: "Retail" },
  { header: "ORGANIZATION_NAME", field: "ORGANIZATION_NAME", type: "text", required: false, aliases: ["Organization Name", "Company Name"], example: "" },
  { header: "ORG_TYPE", field: "ORG_TYPE", type: "text", required: false, aliases: ["Organization Type"], example: "" },
  { header: "ORG_REG_NUMBER", field: "ORG_REG_NUMBER", type: "text", required: false, aliases: ["Registration Number", "Org Reg Number"], example: "" },

  { header: "BRAND_NAME", field: "BRAND_NAME", type: "text", required: true, aliases: ["Brand", "Brand Name", "Make"], example: "Toyota" },
  { header: "MODEL", field: "MODEL", type: "text", required: true, aliases: ["Model"], example: "Corolla" },
  { header: "CHASIS_NUMBER", field: "CHASIS_NUMBER", type: "text", required: true, aliases: ["Chassis Number", "Chasis Number", "Chassis No", "VIN"], example: "JTDKN3DU0A0123457" },
  { header: "MOTOR_NUMBER", field: "MOTOR_NUMBER", type: "text", required: true, aliases: ["Motor Number", "Engine Number"], example: "MTR-100235" },
  { header: "COLOR", field: "COLOR", type: "text", required: false, aliases: ["Colour", "Color"], example: "Silver" },
  { header: "ENGINE_SIZE", field: "ENGINE_SIZE", type: "text", required: false, aliases: ["Engine Size"], example: "1.6L" },
  { header: "YEAR_OF_PRODUCT", field: "YEAR_OF_PRODUCT", type: "number", required: true, aliases: ["Year", "Year of Product", "Model Year"], example: "2023" },

  { header: "APP_PROGRAM_ID", field: "APP_PROGRAM_ID", type: "number", required: true, aliases: ["Program ID"], example: "101" },
  { header: "PROGRAM_NAME", field: "PROGRAM_NAME", type: "text", required: true, aliases: ["Program", "Program Name"], example: "Standard Auto Loan" },

  // Financial / loan terms. PRICE, DOWN_PAYMENT, LOAN_AMOUNT, BANK_NAME and
  // BANK_BRANCH are required because the payment-request gate checks them —
  // requiring them here means a bad row is caught at upload, where Admin can
  // fix it, rather than stalling Operations later.
  { header: "PRICE", field: "PRICE", type: "number", required: true, aliases: ["Car Price", "Price"], example: "1800000" },
  { header: "DOWN_PAYMENT", field: "DOWN_PAYMENT", type: "number", required: true, aliases: ["Down Payment", "Downpayment"], example: "360000" },
  { header: "LOAN_AMOUNT", field: "LOAN_AMOUNT", type: "number", required: true, aliases: ["Loan Amount", "Finance Amount"], example: "1440000" },
  { header: "MONTHLY_INSTALLMENT", field: "MONTHLY_INSTALLMENT", type: "number", required: false, aliases: ["Monthly Installment", "Monthly Instalment", "Installment", "Instalment", "Monthly Payment"], example: "42500" },
  { header: "INTEREST_RATE", field: "INTEREST_RATE", type: "number", required: false, aliases: ["Interest Rate", "Rate"], example: "21.5" },
  { header: "TENOR_MONTH", field: "TENOR_MONTH", type: "number", required: false, aliases: ["Tenor", "Tenor Months", "Tenure"], example: "48" },
  { header: "ADMIN_FEES", field: "ADMIN_FEES", type: "number", required: false, aliases: ["Admin Fees", "Administration Fees"], example: "12000" },
  { header: "BANK_NAME", field: "BANK_NAME", type: "text", required: true, aliases: ["Bank", "Bank Name"], example: "National Bank of Egypt" },
  { header: "BANK_BRANCH", field: "BANK_BRANCH", type: "text", required: true, aliases: ["Bank Branch", "Branch of Bank"], example: "Nasr City" },

  // Credit assessment output — comes from the credit system, so Operations
  // reads it rather than writing it.
  { header: "DEVIATION", field: "DEVIATION", type: "text", required: false, aliases: ["Deviation", "Policy Deviation", "Credit Deviation"], example: "" },
  { header: "FEEDBACK", field: "FEEDBACK", type: "text", required: false, aliases: ["Credit Feedback", "Feedback", "Credit Comments"], example: "" },
];

export const TEMPLATE_HEADERS = COLUMNS.map((c) => c.header);

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_.-]+/g, "");
}

/** Map each sheet header to its column index, tolerating aliases and case. */
function mapHeaders(headerRow: string[]): {
  indexByField: Partial<Record<keyof PendingApplication, number>>;
  missingRequired: string[];
  unrecognized: string[];
} {
  const normalizedHeaders = headerRow.map((h) => normalize(String(h ?? "")));
  const indexByField: Partial<Record<keyof PendingApplication, number>> = {};
  const matchedIdx = new Set<number>();

  for (const col of COLUMNS) {
    const candidates = [col.header, ...(col.aliases ?? [])].map(normalize);
    const idx = normalizedHeaders.findIndex((h) => h && candidates.includes(h));
    if (idx >= 0) {
      indexByField[col.field] = idx;
      matchedIdx.add(idx);
    }
  }

  const missingRequired = COLUMNS.filter((c) => c.required && indexByField[c.field] === undefined).map(
    (c) => c.header
  );
  const unrecognized = headerRow
    .map((h, i) => ({ h: String(h ?? "").trim(), i }))
    .filter((x) => x.h && !matchedIdx.has(x.i))
    .map((x) => x.h);

  return { indexByField, missingRequired, unrecognized };
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  applications: PendingApplication[];
  errors: RowError[];
  /** Headers in the file that matched no known column — surfaced as a warning. */
  unrecognizedHeaders: string[];
  totalDataRows: number;
}

function isBlankRow(cells: unknown[]): boolean {
  return cells.every((c) => c === null || c === undefined || String(c).trim() === "");
}

/**
 * Turn a sheet (first row = headers) into PendingApplications. Invalid rows are
 * reported rather than silently dropped, so a bad upload never looks like a
 * partial success.
 */
export function rowsToApplications(rows: unknown[][]): ParseResult {
  const errors: RowError[] = [];

  if (!rows.length) {
    return { applications: [], errors: [{ row: 0, message: "The file is empty." }], unrecognizedHeaders: [], totalDataRows: 0 };
  }

  const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""));
  const { indexByField, missingRequired, unrecognized } = mapHeaders(headerRow);

  if (missingRequired.length) {
    return {
      applications: [],
      errors: [
        {
          row: 1,
          message: `Missing required column(s): ${missingRequired.join(", ")}. Download the template to see the expected headers.`,
        },
      ],
      unrecognizedHeaders: unrecognized,
      totalDataRows: 0,
    };
  }

  const dataRows = rows.slice(1).filter((r) => !isBlankRow(r ?? []));
  const applications: PendingApplication[] = [];
  const now = new Date().toISOString();
  const seenChassis = new Map<string, number>();

  dataRows.forEach((cells, i) => {
    const sheetRow = i + 2; // 1-based, +1 for the header row
    const raw: Record<string, unknown> = {};
    let rowFailed = false;

    for (const col of COLUMNS) {
      const idx = indexByField[col.field];
      const cell = idx === undefined ? undefined : cells[idx];
      const text = cell === null || cell === undefined ? "" : String(cell).trim();

      if (!text) {
        if (col.required) {
          errors.push({ row: sheetRow, message: `${col.header} is required but empty.` });
          rowFailed = true;
        } else {
          raw[col.field] = null;
        }
        continue;
      }

      if (col.type === "number") {
        const n = Number(text);
        if (!Number.isFinite(n)) {
          errors.push({ row: sheetRow, message: `${col.header} must be a number (got "${text}").` });
          rowFailed = true;
          continue;
        }
        raw[col.field] = n;
      } else {
        raw[col.field] = text;
      }
    }

    if (rowFailed) return;

    const chassis = String(raw.CHASIS_NUMBER);
    const firstSeen = seenChassis.get(chassis);
    if (firstSeen !== undefined) {
      errors.push({
        row: sheetRow,
        message: `Duplicate CHASIS_NUMBER "${chassis}" — already used on row ${firstSeen}.`,
      });
      return;
    }
    seenChassis.set(chassis, sheetRow);

    applications.push({
      ASSIGNMENT_ID: `ASG-${chassis}-${String(raw.CUSTOMER_ID_NUMBER)}`,
      UploadedAt: now,
      ConsumedByAppId: null,
      ...(raw as unknown as Omit<PendingApplication, "ASSIGNMENT_ID" | "UploadedAt" | "ConsumedByAppId">),
    });
  });

  return { applications, errors, unrecognizedHeaders: unrecognized, totalDataRows: dataRows.length };
}

/** Parse an uploaded .xlsx or .csv file into pending applications. */
export async function parseUploadFile(file: File): Promise<ParseResult> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";

  if (isCsv) {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return rowsToApplications(parsed.data as unknown[][]);
  }

  if (!/\.xlsx$/i.test(file.name)) {
    return {
      applications: [],
      errors: [{ row: 0, message: `Unsupported file type "${file.name}". Upload a .xlsx or .csv file.` }],
      unrecognizedHeaders: [],
      totalDataRows: 0,
    };
  }

  // Subpath import: the package exposes no root entry, and parsing happens in
  // the browser. Dynamically imported so it stays out of the main bundle.
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const rows = await readXlsxFile(file);
  return rowsToApplications(rows as unknown as unknown[][]);
}

/** Build a CSV template with the canonical headers plus one example row. */
export function buildTemplateCsv(): string {
  const headers = TEMPLATE_HEADERS.join(",");
  const example = COLUMNS.map((c) => (c.example.includes(",") ? `"${c.example}"` : c.example)).join(",");
  return `${headers}\n${example}\n`;
}

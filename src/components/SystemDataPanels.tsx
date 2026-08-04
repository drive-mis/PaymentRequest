import { ReadOnlyPanel } from "./ReadOnlyPanel";
import { formatCurrency } from "@/lib/format";

// One definition of the system-sourced panels, shared by the New Contract form
// and the Request Detail view so the two can never drift apart. Both a raw
// source-system record and a saved CarLoanRequest satisfy these shapes, since
// the request row carries the same field names.
//
// `data` may be null: the New Contract form renders these panels before a
// record has been picked, so the agent can see up-front exactly which fields
// the system will fill in (all showing "—" until a selection is made).

export interface CustomerLike {
  CUSTOMER_NAME: string;
  CUSTOMER_ID_NUMBER: string;
  APP_CUSTOMER_TYPE: string;
  CUSTOMER_GENDER?: string | null;
  CUSTOMER_NATIONALITY?: string | null;
  CUSTOMER_TITLE?: string | null;
  CUSTOMER_CLASS?: string | null;
  ORGANIZATION_NAME?: string | null;
  ORG_TYPE?: string | null;
  ORG_REG_NUMBER?: string | null;
}

export interface VehicleLike {
  BRAND_NAME: string;
  MODEL: string;
  CHASIS_NUMBER: string;
  MOTOR_NUMBER: string;
  COLOR: string;
  ENGINE_SIZE: string;
  YEAR_OF_PRODUCT: number;
}

export interface ProgramLike {
  PROGRAM_NAME: string;
  APP_PROGRAM_ID: number;
}

export interface FinancialLike {
  PRICE: number | null;
  DOWN_PAYMENT: number | null;
  LOAN_AMOUNT: number | null;
  INTEREST_RATE: number | null;
  TENOR_MONTH: number | null;
  ADMIN_FEES: number | null;
  BANK_NAME: string | null;
  BANK_BRANCH: string | null;
}

const AWAITING = "awaiting selection";

export function CustomerPanel({ data }: { data: CustomerLike | null }) {
  return (
    <ReadOnlyPanel
      title="Customer Data"
      sourceLabel={data ? "sourced from system · read-only" : AWAITING}
      fields={[
        { label: "Customer Name", value: data?.CUSTOMER_NAME },
        { label: "ID Number", value: data?.CUSTOMER_ID_NUMBER },
        { label: "Customer Type", value: data?.APP_CUSTOMER_TYPE },
        { label: "Title", value: data?.CUSTOMER_TITLE },
        { label: "Gender", value: data?.CUSTOMER_GENDER },
        { label: "Nationality", value: data?.CUSTOMER_NATIONALITY },
        { label: "Customer Class", value: data?.CUSTOMER_CLASS },
        { label: "Organization Name", value: data?.ORGANIZATION_NAME },
        { label: "Organization Type", value: data?.ORG_TYPE },
        { label: "Org. Reg. Number", value: data?.ORG_REG_NUMBER },
      ]}
    />
  );
}

export function VehiclePanel({ data }: { data: VehicleLike | null }) {
  return (
    <ReadOnlyPanel
      title="Vehicle Data"
      sourceLabel={data ? "sourced from system · read-only" : AWAITING}
      fields={[
        { label: "Brand Name", value: data?.BRAND_NAME },
        { label: "Model", value: data?.MODEL },
        { label: "Chassis Number", value: data?.CHASIS_NUMBER },
        { label: "Motor Number", value: data?.MOTOR_NUMBER },
        { label: "Color", value: data?.COLOR },
        { label: "Engine Size", value: data?.ENGINE_SIZE },
        { label: "Year of Product", value: data?.YEAR_OF_PRODUCT },
      ]}
    />
  );
}

export function FinancialPanel({ data }: { data: FinancialLike | null }) {
  const calculated =
    data && data.PRICE !== null && data.DOWN_PAYMENT !== null ? data.PRICE - data.DOWN_PAYMENT : null;

  return (
    <ReadOnlyPanel
      title="Financial / Loan Details"
      sourceLabel={data ? "sourced from system · read-only" : AWAITING}
      fields={[
        { label: "Price", value: data ? formatCurrency(data.PRICE) : null },
        { label: "Down Payment", value: data ? formatCurrency(data.DOWN_PAYMENT) : null },
        { label: "Loan Amount", value: data ? formatCurrency(data.LOAN_AMOUNT) : null },
        { label: "Loan Amount (calculated)", value: data ? formatCurrency(calculated) : null },
        { label: "Interest Rate", value: data?.INTEREST_RATE != null ? `${data.INTEREST_RATE}%` : null },
        { label: "Tenor", value: data?.TENOR_MONTH != null ? `${data.TENOR_MONTH} months` : null },
        { label: "Admin Fees", value: data ? formatCurrency(data.ADMIN_FEES) : null },
        { label: "Bank Name", value: data?.BANK_NAME },
        { label: "Bank Branch", value: data?.BANK_BRANCH },
      ]}
    />
  );
}

export function ProgramPanel({ data }: { data: ProgramLike | null }) {
  return (
    <ReadOnlyPanel
      title="Program Data"
      sourceLabel={data ? "sourced from system · read-only" : AWAITING}
      fields={[
        { label: "Program Name", value: data?.PROGRAM_NAME },
        { label: "Program ID", value: data?.APP_PROGRAM_ID },
      ]}
      columns={2}
    />
  );
}

import { MOCK_CUSTOMERS, MOCK_VEHICLES } from "./mockSource";
import { BANKS } from "./choices";
import type { PendingApplication } from "./types";

// Stand-in for the spreadsheet Admin would normally upload, so a fresh browser
// has assigned work to look at. Each entry pairs a customer with a vehicle and
// names the sales agent responsible. Admin can clear these and upload the real
// data from the Admin → Application Data screen.

const ASSIGNED_AGENTS = ["Mona Aziz", "Karim Adel"];

export function buildSeedAssignments(): PendingApplication[] {
  const now = new Date().toISOString();

  // Vehicles 0-2 are already used by the seeded CarLoanRequests, so start at 3
  // to keep these genuinely un-contracted.
  return MOCK_VEHICLES.slice(3).map((vehicle, i) => {
    const customer = MOCK_CUSTOMERS[(i + 3) % MOCK_CUSTOMERS.length];
    const bank = BANKS[i % BANKS.length];
    const price = 1_600_000 + i * 250_000;
    const down = Math.round(price * 0.2);
    return {
      ASSIGNMENT_ID: `ASG-${vehicle.CHASIS_NUMBER}-${customer.CUSTOMER_ID_NUMBER}`,
      DRV_SALES_MAN: ASSIGNED_AGENTS[i % ASSIGNED_AGENTS.length],

      CUSTOMER_NAME: customer.CUSTOMER_NAME,
      CUSTOMER_ID_NUMBER: customer.CUSTOMER_ID_NUMBER,
      APP_CUSTOMER_TYPE: customer.APP_CUSTOMER_TYPE,
      CUSTOMER_TITLE: customer.CUSTOMER_TITLE,
      CUSTOMER_GENDER: customer.CUSTOMER_GENDER,
      CUSTOMER_NATIONALITY: customer.CUSTOMER_NATIONALITY,
      CUSTOMER_CLASS: customer.CUSTOMER_CLASS,
      ORGANIZATION_NAME: customer.ORGANIZATION_NAME ?? null,
      ORG_TYPE: customer.ORG_TYPE ?? null,
      ORG_REG_NUMBER: customer.ORG_REG_NUMBER ?? null,

      BRAND_NAME: vehicle.BRAND_NAME,
      MODEL: vehicle.MODEL,
      CHASIS_NUMBER: vehicle.CHASIS_NUMBER,
      MOTOR_NUMBER: vehicle.MOTOR_NUMBER,
      COLOR: vehicle.COLOR,
      ENGINE_SIZE: vehicle.ENGINE_SIZE,
      YEAR_OF_PRODUCT: vehicle.YEAR_OF_PRODUCT,

      APP_PROGRAM_ID: customer.APP_PROGRAM_ID,
      PROGRAM_NAME: customer.PROGRAM_NAME,

      PRICE: price,
      DOWN_PAYMENT: down,
      LOAN_AMOUNT: price - down,
      MONTHLY_INSTALLMENT: Math.round(((price - down) * 1.35) / [36, 42, 48, 60][i % 4]),
      INTEREST_RATE: 21 + (i % 4) * 0.5,
      TENOR_MONTH: [36, 42, 48, 60][i % 4],
      ADMIN_FEES: 10_000 + i * 1_000,
      BANK_NAME: bank.BANK_NAME,
      BANK_BRANCH: bank.branches[0],

      // Credit-system output. Most deals come back clean; a couple carry a
      // deviation so the read-only credit panel has something to show.
      DEVIATION: i % 3 === 0 ? "Down payment 2% below program floor — approved by exception." : null,
      FEEDBACK:
        i % 3 === 0
          ? "Approved with condition: salary transfer letter to be collected before disbursement."
          : "Credit approved — no conditions.",

      UploadedAt: now,
      ConsumedByAppId: null,
    };
  });
}

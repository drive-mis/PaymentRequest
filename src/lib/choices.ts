// Branch list as configured in the business's own system (see the Label list
// screenshot). NOTE: that screenshot was scrolled — entries alphabetically
// before "Drive-D5" or after "GB-Suhag" were cut off and are not included here.
export const BRANCHES = [
  "Drive-D5",
  "Drive-El Sheikh Zayed",
  "Drive-Giza",
  "Drive-Heliopolis",
  "Drive-Ismailia",
  "Drive-Katameya",
  "Drive-Tanta",
  "GB-Aswan",
  "GB-Damanhur",
  "GB-Damietta",
  "GB-Hurgada",
  "GB-Luxor",
  "GB-Mansoura",
  "GB-Port Said",
  "GB-Qena",
  "GB-Sharm El Sheikh",
  "GB-Shebin ElKom",
  "GB-Suhag",
];

// Finance programs. These are NOT agent-selectable — a customer's program comes
// from the source system with their record (see mockSource.ts) and is displayed
// read-only, same as their other master data.
export const PROGRAMS = [
  { APP_PROGRAM_ID: 101, PROGRAM_NAME: "Standard Auto Loan" },
  { APP_PROGRAM_ID: 102, PROGRAM_NAME: "Premium Auto Loan" },
  { APP_PROGRAM_ID: 103, PROGRAM_NAME: "Corporate Fleet Finance" },
  { APP_PROGRAM_ID: 104, PROGRAM_NAME: "Certified Pre-Owned Finance" },
];

// ---- Agent-selectable dropdowns -------------------------------------------

export const CAR_TYPES = ["New", "Used"];

export const CONTRACT_TYPES = ["عقد خارجي", "عقد داخلي"];

export const INSURANCE_TYPES = ["بدون تامين", "خارجي", "خزينة درايف", "تقسيط"];

export const RECEIVAL_METHODS = ["استلام العقد من الفرع", "استلام العقد من خارج الفرع"];

export const CONTRACT_READY_STATUSES = ["Not Ready", "Ready for Review", "Sent for Review"];

// ---- Contract-stage document uploads --------------------------------------
// The nine attachments captured on the New Contract form, in the order the
// business lists them. `field` is the exact existing business field name the
// file is stored under; only "Invoice" (فاتورة) had no pre-existing field.
export const CONTRACT_DOCUMENTS: { field: string; labelAr: string; labelEn: string }[] = [
  { field: "Cheque", labelAr: "صورة الشيك", labelEn: "Cheque photo" },
  { field: "Invoice", labelAr: "فاتورة", labelEn: "Invoice" },
  { field: "Pricing", labelAr: "تسعير", labelEn: "Pricing" },
  { field: "Receipt", labelAr: "ايصال", labelEn: "Receipt" },
  { field: "Inspection", labelAr: "معاينة", labelEn: "Inspection" },
  { field: "Car Documents", labelAr: "اوراق السيارة", labelEn: "Car documents" },
  { field: "Benefciary Documents", labelAr: "اوراق المستفيد", labelEn: "Beneficiary documents" },
  { field: "External Contract", labelAr: "عقد خارجي", labelEn: "External contract" },
  { field: "Customer Cheque", labelAr: "صورة الشيك للعميل", labelEn: "Customer cheque photo" },
];

export const BANKS = [
  { BANK_NAME: "National Bank of Egypt", branches: ["Nasr City", "Heliopolis", "Downtown"] },
  { BANK_NAME: "CIB", branches: ["Maadi", "Zamalek", "New Cairo"] },
  { BANK_NAME: "QNB Al Ahli", branches: ["Mohandessin", "6th of October"] },
  { BANK_NAME: "Banque Misr", branches: ["Alexandria Corniche", "Mansoura Main"] },
];

export const SALES_MANAGERS = ["Hossam Younes", "Dina Farag"];

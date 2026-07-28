// Simulates the existing business data sources that Section 4.2/4.3 fields are
// auto-populated from (customer master + vehicle inventory). This is NOT the
// CarLoanRequest workflow table — it's the "existing data source" the brief
// says to simulate as a lookup during contract creation. Selected records are
// copied onto the CarLoanRequest row and locked from then on.

export interface CustomerRecord {
  CUSTOMER_ID_NUMBER: string;
  CUSTOMER_NAME: string;
  CUSTOMER_GENDER: string;
  CUSTOMER_NATIONALITY: string;
  CUSTOMER_TITLE: string;
  CUSTOMER_CLASS: string;
  APP_CUSTOMER_TYPE: "Individual" | "Corporate";
  ORGANIZATION_NAME?: string;
  ORG_TYPE?: string;
  ORG_REG_NUMBER?: string;
}

export interface VehicleRecord {
  CHASIS_NUMBER: string;
  BRAND_NAME: string;
  MODEL: string;
  CarType: string;
  MOTOR_NUMBER: string;
  COLOR: string;
  ENGINE_SIZE: string;
  YEAR_OF_PRODUCT: number;
}

export const MOCK_CUSTOMERS: CustomerRecord[] = [
  { CUSTOMER_ID_NUMBER: "29001011234567", CUSTOMER_NAME: "Ahmed Samir Fathallah", CUSTOMER_GENDER: "Male", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Mr.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "29203157654321", CUSTOMER_NAME: "Salma Adel Ibrahim", CUSTOMER_GENDER: "Female", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Ms.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "28806229988776", CUSTOMER_NAME: "Mostafa Khaled Nour", CUSTOMER_GENDER: "Male", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Mr.", CUSTOMER_CLASS: "Premium", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "30001019876543", CUSTOMER_NAME: "Nourhan Tarek Shawky", CUSTOMER_GENDER: "Female", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Mrs.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "27505124455667", CUSTOMER_NAME: "Youssef Hany Abdelrahman", CUSTOMER_GENDER: "Male", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Mr.", CUSTOMER_CLASS: "Premium", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "29112087712345", CUSTOMER_NAME: "Rania Mohsen El-Sayed", CUSTOMER_GENDER: "Female", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Dr.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "26909305544332", CUSTOMER_NAME: "Karim Wael Mansour", CUSTOMER_GENDER: "Male", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Eng.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
  { CUSTOMER_ID_NUMBER: "10100000000011", CUSTOMER_NAME: "Nile Logistics Co.", CUSTOMER_GENDER: "-", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Company", CUSTOMER_CLASS: "Corporate", APP_CUSTOMER_TYPE: "Corporate", ORGANIZATION_NAME: "Nile Logistics Co.", ORG_TYPE: "LLC", ORG_REG_NUMBER: "REG-88213" },
  { CUSTOMER_ID_NUMBER: "10100000000022", CUSTOMER_NAME: "Delta Fleet Rentals", CUSTOMER_GENDER: "-", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Company", CUSTOMER_CLASS: "Corporate", APP_CUSTOMER_TYPE: "Corporate", ORGANIZATION_NAME: "Delta Fleet Rentals", ORG_TYPE: "Joint Stock", ORG_REG_NUMBER: "REG-55120" },
  { CUSTOMER_ID_NUMBER: "29408067788990", CUSTOMER_NAME: "Hana Sherif Kamal", CUSTOMER_GENDER: "Female", CUSTOMER_NATIONALITY: "Egyptian", CUSTOMER_TITLE: "Mrs.", CUSTOMER_CLASS: "Retail", APP_CUSTOMER_TYPE: "Individual" },
];

export const MOCK_VEHICLES: VehicleRecord[] = [
  { CHASIS_NUMBER: "WBA3A5C50DF123456", BRAND_NAME: "BMW", MODEL: "320i", CarType: "Sedan", MOTOR_NUMBER: "MTR-100234", COLOR: "White", ENGINE_SIZE: "2.0L", YEAR_OF_PRODUCT: 2024 },
  { CHASIS_NUMBER: "JTDKN3DU0A0123457", BRAND_NAME: "Toyota", MODEL: "Corolla", CarType: "Sedan", MOTOR_NUMBER: "MTR-100235", COLOR: "Silver", ENGINE_SIZE: "1.6L", YEAR_OF_PRODUCT: 2023 },
  { CHASIS_NUMBER: "1HGCM82633A123458", BRAND_NAME: "Honda", MODEL: "CR-V", CarType: "SUV", MOTOR_NUMBER: "MTR-100236", COLOR: "Black", ENGINE_SIZE: "1.5L Turbo", YEAR_OF_PRODUCT: 2024 },
  { CHASIS_NUMBER: "WVWZZZ1KZAW123459", BRAND_NAME: "Volkswagen", MODEL: "Tiguan", CarType: "SUV", MOTOR_NUMBER: "MTR-100237", COLOR: "Grey", ENGINE_SIZE: "2.0L", YEAR_OF_PRODUCT: 2022 },
  { CHASIS_NUMBER: "KMHD35LE1EU123460", BRAND_NAME: "Hyundai", MODEL: "Elantra", CarType: "Sedan", MOTOR_NUMBER: "MTR-100238", COLOR: "Red", ENGINE_SIZE: "1.6L", YEAR_OF_PRODUCT: 2023 },
  { CHASIS_NUMBER: "5YJ3E1EA0JF123461", BRAND_NAME: "Tesla", MODEL: "Model 3", CarType: "Sedan", MOTOR_NUMBER: "MTR-100239", COLOR: "Blue", ENGINE_SIZE: "Electric", YEAR_OF_PRODUCT: 2024 },
  { CHASIS_NUMBER: "JN1AZ4EH9CM123462", BRAND_NAME: "Nissan", MODEL: "Sunny", CarType: "Sedan", MOTOR_NUMBER: "MTR-100240", COLOR: "White", ENGINE_SIZE: "1.5L", YEAR_OF_PRODUCT: 2021 },
  { CHASIS_NUMBER: "WDDGF4HB0DA123463", BRAND_NAME: "Mercedes-Benz", MODEL: "C200", CarType: "Sedan", MOTOR_NUMBER: "MTR-100241", COLOR: "Black", ENGINE_SIZE: "2.0L Turbo", YEAR_OF_PRODUCT: 2024 },
  { CHASIS_NUMBER: "MR0FR22G701123464", BRAND_NAME: "Toyota", MODEL: "Fortuner", CarType: "SUV", MOTOR_NUMBER: "MTR-100242", COLOR: "Pearl White", ENGINE_SIZE: "2.7L", YEAR_OF_PRODUCT: 2023 },
  { CHASIS_NUMBER: "1FTFW1ET0EF123465", BRAND_NAME: "Ford", MODEL: "F-150", CarType: "Pickup", MOTOR_NUMBER: "MTR-100243", COLOR: "Grey", ENGINE_SIZE: "3.5L V6", YEAR_OF_PRODUCT: 2022 },
];

export function findCustomers(query: string): CustomerRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_CUSTOMERS;
  return MOCK_CUSTOMERS.filter(
    (c) => c.CUSTOMER_NAME.toLowerCase().includes(q) || c.CUSTOMER_ID_NUMBER.includes(q)
  );
}

export function findVehicles(query: string): VehicleRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_VEHICLES;
  return MOCK_VEHICLES.filter(
    (v) =>
      v.CHASIS_NUMBER.toLowerCase().includes(q) ||
      v.BRAND_NAME.toLowerCase().includes(q) ||
      v.MODEL.toLowerCase().includes(q)
  );
}

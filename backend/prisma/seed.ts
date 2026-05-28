import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.pharmacyContactLog.deleteMany();
  await prisma.pharmacy.deleteMany();
  await prisma.searchSession.deleteMany();

  const session = await prisma.searchSession.create({
    data: {
      medicationName: "Lisinopril",
      strength: "10mg",
      quantity: "30 tablets",
      zipCode: "08901",
      radius: 10,
      userNotes: "Demo session — confirm stock by phone.",
      pharmacies: {
        create: [
          {
            name: "Community Care Pharmacy",
            address: "120 Main St, New Brunswick, NJ",
            phone: "(732) 555-2010",
            distanceMiles: 0.9,
            source: "seed",
            contactLogs: {
              create: {
                status: "in_stock",
                note: "Has generic in stock. Can transfer from CVS.",
                insuranceAccepted: "yes",
                priceQuoted: "$12 copay",
              },
            },
          },
          {
            name: "Riverside Drug & Wellness",
            address: "88 Oak Ave, New Brunswick, NJ",
            phone: "(732) 555-3102",
            distanceMiles: 1.5,
            source: "seed",
            contactLogs: {
              create: {
                status: "called",
                note: "On hold 8 min — asked to call back after 2pm.",
                nextStep: "Call back after 2pm",
                insuranceAccepted: "unknown",
              },
            },
          },
          {
            name: "Northside Family Pharmacy",
            address: "410 Cedar Ln, New Brunswick, NJ",
            phone: "(732) 555-8821",
            distanceMiles: 2.3,
            source: "seed",
            contactLogs: {
              create: {
                status: "out_of_stock",
                note: "Out until Thursday per technician.",
                insuranceAccepted: "yes",
              },
            },
          },
          {
            name: "Green Valley Apothecary",
            address: "9 Park Plaza, New Brunswick, NJ",
            distanceMiles: 3.1,
            source: "seed",
          },
        ],
      },
    },
  });

  console.log(`Seeded demo search session: ${session.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { prisma } from "../src/lib/db";

async function main() {
  console.info("No seed data inserted. Populate the database through real connectors.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

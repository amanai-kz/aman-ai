import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // Пароли для тестовых аккаунтов
  const patientPassword = await hash("Aibek2024!", 12)
  const doctorPassword = await hash("Daulet2024!", 12)
  const adminPassword = await hash("Admin2024!", 12)

  // 1. Тестовый пациент
  const patient = await prisma.user.upsert({
    where: { email: "aibek@amanai.kz" },
    update: {},
    create: {
      email: "aibek@amanai.kz",
      name: "Айбек Сериков",
      password: patientPassword,
      role: "PATIENT",
      patient: {
        create: {
          gender: "MALE",
          bloodType: "B+",
        },
      },
    },
  })
  console.log("✅ Created patient:", patient.email)

  // 2. Тестовый врач
  const doctor = await prisma.user.upsert({
    where: { email: "daulet@amanai.kz" },
    update: {},
    create: {
      email: "daulet@amanai.kz",
      name: "Дәулет Қасымов",
      password: doctorPassword,
      role: "DOCTOR",
      doctor: {
        create: {
          specialization: "Невролог",
          hospital: "Aman AI Clinic",
        },
      },
    },
  })
  console.log("✅ Created doctor:", doctor.email)

  // 3. Тестовый админ
  const admin = await prisma.user.upsert({
    where: { email: "admin@amanai.kz" },
    update: {},
    create: {
      email: "admin@amanai.kz",
      name: "Нұрлан Әбдірахманов",
      password: adminPassword,
      role: "ADMIN",
    },
  })
  console.log("✅ Created admin:", admin.email)

  console.log("")
  console.log("🎉 Seeding complete!")
  console.log("")
  console.log("📋 Test accounts:")
  console.log("   - aibek@amanai.kz   / Aibek2024!  (Пациент)")
  console.log("   - daulet@amanai.kz  / Daulet2024! (Врач)")
  console.log("   - admin@amanai.kz   / Admin2024!  (Админ)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })



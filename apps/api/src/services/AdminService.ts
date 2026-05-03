import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const AdminService = {
  // ── Products ──────────────────────────────────────────────
  async listProducts(includeInactive = true) {
    const rows = await prisma.product.findMany({
      where: includeInactive ? undefined : { active: true },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
    })
    return rows.map((p) => ({ ...p, price: Number(p.price) }))
  },

  async createProduct(data: {
    categoryId: string
    name: string
    price: number
    isFavorite: boolean
  }) {
    const row = await prisma.product.create({ data })
    return { ...row, price: Number(row.price) }
  },

  async updateProduct(
    id: string,
    data: Partial<{ categoryId: string; name: string; price: number; isFavorite: boolean; active: boolean }>,
  ) {
    const row = await prisma.product.update({ where: { id }, data })
    return { ...row, price: Number(row.price) }
  },

  // ── Categories ────────────────────────────────────────────
  async listCategories(includeInactive = true) {
    return prisma.category.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { displayOrder: 'asc' },
    })
  },

  async createCategory(data: {
    name: string
    color: string
    icon: string
    displayOrder: number
  }) {
    return prisma.category.create({ data })
  },

  async updateCategory(
    id: string,
    data: Partial<{ name: string; color: string; icon: string; displayOrder: number; active: boolean }>,
  ) {
    return prisma.category.update({ where: { id }, data })
  },

  // ── Tables ────────────────────────────────────────────────
  async listAllTables() {
    return prisma.table.findMany({ orderBy: { number: 'asc' } })
  },

  async createTable(number: number) {
    const existing = await prisma.table.findUnique({ where: { number } })
    if (existing) throw new Error(`Mesa ${number} já existe.`)
    return prisma.table.create({ data: { number, status: 'free' } })
  },

  async removeTable(id: string) {
    const table = await prisma.table.findUniqueOrThrow({ where: { id } })
    if (table.status !== 'free') throw new Error('Mesa tem venda ativa — encerre antes de remover.')
    return prisma.table.delete({ where: { id } })
  },

  // ── Users ─────────────────────────────────────────────────
  async listUsers() {
    return prisma.user.findMany({
      select: { id: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  },

  async createUser(data: { name: string; pin: string; role: string }) {
    const hashedPin = await bcrypt.hash(data.pin, 10)
    return prisma.user.create({
      data: { name: data.name, pin: hashedPin, role: data.role },
      select: { id: true, name: true, role: true, active: true, createdAt: true },
    })
  },

  async updateUser(
    id: string,
    data: Partial<{ name: string; role: string; active: boolean }>,
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, active: true, createdAt: true },
    })
  },

  async changePin(id: string, newPin: string) {
    const hashedPin = await bcrypt.hash(newPin, 10)
    return prisma.user.update({
      where: { id },
      data: { pin: hashedPin },
      select: { id: true, name: true },
    })
  },
}

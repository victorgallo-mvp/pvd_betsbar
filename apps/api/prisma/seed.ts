import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Users
  const adminPin = await bcrypt.hash('1234', 10)
  const op1Pin = await bcrypt.hash('2222', 10)
  const op2Pin = await bcrypt.hash('3333', 10)

  const admin = await prisma.user.upsert({
    where: { id: 'user_admin' },
    update: {},
    create: { id: 'user_admin', name: 'Admin', pin: adminPin, role: 'admin' },
  })

  const op1 = await prisma.user.upsert({
    where: { id: 'user_op1' },
    update: {},
    create: { id: 'user_op1', name: 'João', pin: op1Pin, role: 'operator' },
  })

  const op2 = await prisma.user.upsert({
    where: { id: 'user_op2' },
    update: {},
    create: { id: 'user_op2', name: 'Maria', pin: op2Pin, role: 'operator' },
  })

  console.log('✅ Users:', admin.name, op1.name, op2.name)

  // Categories
  const categories = [
    { id: 'cat_favoritos', name: 'Favoritos', color: '#F59E0B', icon: 'Star', displayOrder: 1 },
    { id: 'cat_fichas', name: 'Fichas', color: '#3B82F6', icon: 'Ticket', displayOrder: 2 },
    { id: 'cat_espetos', name: 'Espetos', color: '#10B981', icon: 'Flame', displayOrder: 3 },
    { id: 'cat_porcoes', name: 'Porções', color: '#10B981', icon: 'UtensilsCrossed', displayOrder: 4 },
    { id: 'cat_bebidas', name: 'Bebidas', color: '#10B981', icon: 'Coffee', displayOrder: 5 },
    { id: 'cat_pastelaria', name: 'Pastelaria', color: '#6B7280', icon: 'ShoppingBasket', displayOrder: 6 },
    { id: 'cat_cervejas', name: 'Cervejas/Chopps', color: '#6B7280', icon: 'Beer', displayOrder: 7 },
    { id: 'cat_burguer', name: 'Burguer', color: '#EF4444', icon: 'Sandwich', displayOrder: 8 },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    })
  }
  console.log('✅ Categories: 8 created')

  // Products
  const products = [
    // Favoritos (will also appear in original categories)
    { id: 'prod_boi_espeto', categoryId: 'cat_favoritos', name: 'Boi Espeto', price: 13.0, isFavorite: true },
    { id: 'prod_bohemia', categoryId: 'cat_favoritos', name: 'Bohemia 600ml', price: 7.99, isFavorite: true },
    { id: 'prod_agua_gas', categoryId: 'cat_favoritos', name: 'Água c/ Gás', price: 6.0, isFavorite: true },
    // Fichas
    { id: 'prod_ingresso_masc', categoryId: 'cat_fichas', name: 'Ingresso Masculino', price: 20.0 },
    { id: 'prod_ingresso_fem', categoryId: 'cat_fichas', name: 'Ingresso Feminino', price: 0.01 },
    { id: 'prod_couvert', categoryId: 'cat_fichas', name: 'Couvert Artístico', price: 15.0 },
    { id: 'prod_ficha_10', categoryId: 'cat_fichas', name: 'Ficha R$10', price: 10.0 },
    { id: 'prod_ficha_20', categoryId: 'cat_fichas', name: 'Ficha R$20', price: 20.0 },
    { id: 'prod_ficha_50', categoryId: 'cat_fichas', name: 'Ficha R$50', price: 50.0 },
    // Espetos
    { id: 'prod_espeto_boi', categoryId: 'cat_espetos', name: 'Espeto Boi', price: 13.0 },
    { id: 'prod_espeto_frango', categoryId: 'cat_espetos', name: 'Espeto Frango', price: 11.0 },
    { id: 'prod_espeto_queijo', categoryId: 'cat_espetos', name: 'Espeto Queijo', price: 10.0 },
    { id: 'prod_espeto_linguica', categoryId: 'cat_espetos', name: 'Espeto Linguiça', price: 12.0 },
    // Porções
    { id: 'prod_batata_frita', categoryId: 'cat_porcoes', name: 'Batata Frita 300g', price: 35.0 },
    { id: 'prod_mandioca', categoryId: 'cat_porcoes', name: 'Mandioca Frita', price: 28.0 },
    { id: 'prod_frango_frito', categoryId: 'cat_porcoes', name: 'Frango Frito 500g', price: 42.0 },
    { id: 'prod_calabresa', categoryId: 'cat_porcoes', name: 'Calabresa Acebolada', price: 38.0 },
    // Bebidas
    { id: 'prod_coca_normal', categoryId: 'cat_bebidas', name: 'Coca-Cola 350ml', price: 7.0 },
    { id: 'prod_coca_zero', categoryId: 'cat_bebidas', name: 'Coca-Cola Zero', price: 7.0 },
    { id: 'prod_agua_mineral', categoryId: 'cat_bebidas', name: 'Água Mineral 500ml', price: 5.0 },
    { id: 'prod_suco_laranja', categoryId: 'cat_bebidas', name: 'Suco de Laranja', price: 12.0 },
    { id: 'prod_suco_maracuja', categoryId: 'cat_bebidas', name: 'Suco de Maracujá', price: 12.0 },
    // Pastelaria
    { id: 'prod_pastel_carne', categoryId: 'cat_pastelaria', name: 'Pastel de Carne', price: 8.0 },
    { id: 'prod_pastel_queijo', categoryId: 'cat_pastelaria', name: 'Pastel de Queijo', price: 7.5 },
    { id: 'prod_coxinha', categoryId: 'cat_pastelaria', name: 'Coxinha de Frango', price: 6.0 },
    // Cervejas/Chopps
    { id: 'prod_bohemia_600', categoryId: 'cat_cervejas', name: 'Bohemia 600ml', price: 7.99 },
    { id: 'prod_skol_600', categoryId: 'cat_cervejas', name: 'Skol 600ml', price: 6.99 },
    { id: 'prod_chopp_300', categoryId: 'cat_cervejas', name: 'Chopp 300ml', price: 8.0 },
    { id: 'prod_chopp_500', categoryId: 'cat_cervejas', name: 'Chopp 500ml', price: 12.0 },
    // Burguer
    { id: 'prod_x_burguer', categoryId: 'cat_burguer', name: 'X-Burguer', price: 22.0 },
    { id: 'prod_x_bacon', categoryId: 'cat_burguer', name: 'X-Bacon', price: 26.0 },
    { id: 'prod_x_salada', categoryId: 'cat_burguer', name: 'X-Salada', price: 24.0 },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        price: p.price,
        isFavorite: p.isFavorite ?? false,
      },
    })
  }
  console.log(`✅ Products: ${products.length} created`)

  // Tables (20 mesas)
  for (let n = 1; n <= 20; n++) {
    await prisma.table.upsert({
      where: { number: n },
      update: {},
      create: { number: n, status: 'free' },
    })
  }
  console.log('✅ Tables: 20 created (numbers 1–20)')

  console.log('\n🎉 Seed complete!')
  console.log('   Admin PIN: 1234')
  console.log('   Operador João PIN: 2222')
  console.log('   Operadora Maria PIN: 3333')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

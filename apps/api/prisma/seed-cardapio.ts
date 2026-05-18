/**
 * Seed do cardápio real do Bet's Bar.
 * Apaga todos os produtos e categorias existentes e recria com os dados reais.
 * ⚠️  Drinks: preços não constam no PDF — inseridos com R$1 (placeholder).
 *
 * Rodar: cd apps/api && npx tsx prisma/seed-cardapio.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Categorias ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'cat_favoritos',  name: 'Favoritos',           color: '#F59E0B', icon: 'Star',            displayOrder: 0 },
  // Bebidas
  { id: 'cat_cerv600',    name: 'Cervejas 600ml',       color: '#F59E0B', icon: 'Beer',            displayOrder: 1 },
  { id: 'cat_artesanal',  name: 'Cervejas Artesanais',  color: '#8B5CF6', icon: 'Beer',            displayOrder: 2 },
  { id: 'cat_longneck',   name: 'Long Neck',             color: '#F97316', icon: 'Beer',            displayOrder: 3 },
  { id: 'cat_cervzero',   name: 'Cerveja Zero',          color: '#6B7280', icon: 'Beer',            displayOrder: 4 },
  { id: 'cat_chopp',      name: 'Chopp',                 color: '#F59E0B', icon: 'Beer',            displayOrder: 5 },
  { id: 'cat_drinks',     name: 'Drinks',                color: '#EC4899', icon: 'Wine',            displayOrder: 6 },
  { id: 'cat_shot',       name: 'Shot',                  color: '#EF4444', icon: 'Flame',           displayOrder: 7 },
  { id: 'cat_refri',      name: 'Refrigerantes',         color: '#06B6D4', icon: 'Coffee',          displayOrder: 8 },
  { id: 'cat_suco',       name: 'Sucos',                 color: '#10B981', icon: 'Apple',           displayOrder: 9 },
  { id: 'cat_agua',       name: 'Água',                  color: '#3B82F6', icon: 'Coffee',          displayOrder: 10 },
  // Comidas
  { id: 'cat_comida',     name: 'Comidas',               color: '#EF4444', icon: 'UtensilsCrossed', displayOrder: 11 },
]

// ─── Produtos ─────────────────────────────────────────────────
// sendToKitchen: false = preparo no balcão/bar | true = vai para a cozinha
const PRODUCTS: {
  categoryId: string; name: string; price: number
  isFavorite: boolean; sendToKitchen: boolean; note?: string
}[] = [
  // Cervejas 600ml
  { categoryId: 'cat_cerv600',   name: 'Heineken 600ml',         price: 18,  isFavorite: true,  sendToKitchen: false },
  { categoryId: 'cat_cerv600',   name: 'Original 600ml',         price: 15,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_cerv600',   name: 'Stella Artois 600ml',    price: 17,  isFavorite: false, sendToKitchen: false },

  // Cervejas Artesanais
  { categoryId: 'cat_artesanal', name: 'Walls',                  price: 20,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_artesanal', name: 'Lagoinha',               price: 18,  isFavorite: false, sendToKitchen: false },

  // Long Neck
  { categoryId: 'cat_longneck',  name: 'Heineken Long Neck',     price: 10,  isFavorite: true,  sendToKitchen: false },
  { categoryId: 'cat_longneck',  name: 'Corona Long Neck',       price: 12,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_longneck',  name: 'Cerveja Ultra',          price: 10,  isFavorite: false, sendToKitchen: false },

  // Cerveja Zero
  { categoryId: 'cat_cervzero',  name: 'Heineken Zero',          price: 10,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_cervzero',  name: 'Corona Zero',            price: 10,  isFavorite: false, sendToKitchen: false },

  // Chopp
  { categoryId: 'cat_chopp',     name: 'Chopp 300ml',            price: 8,   isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_chopp',     name: 'Chopp 450ml',            price: 12,  isFavorite: true,  sendToKitchen: false },

  // Drinks
  { categoryId: 'cat_drinks',    name: 'Drink Red',              price: 17,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_drinks',    name: 'Drink All In',           price: 17,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_drinks',    name: 'Drink Green',            price: 17,  isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_drinks',    name: 'Drink DNB',              price: 17,  isFavorite: false, sendToKitchen: false },

  // Shot
  { categoryId: 'cat_shot',      name: 'Shot de Limão',          price: 2,   isFavorite: false, sendToKitchen: false },

  // Refrigerantes
  { categoryId: 'cat_refri',     name: 'Coca-Cola',              price: 7,   isFavorite: true,  sendToKitchen: false },
  { categoryId: 'cat_refri',     name: 'Guaraná Antarctica',     price: 7,   isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_refri',     name: 'Sprite',                 price: 7,   isFavorite: false, sendToKitchen: false },

  // Sucos
  { categoryId: 'cat_suco',      name: 'Del Valle',              price: 7,   isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_suco',      name: 'Limonada Del Valle',     price: 7,   isFavorite: false, sendToKitchen: false },

  // Água
  { categoryId: 'cat_agua',      name: 'Água',                   price: 4,   isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_agua',      name: 'Água com Gás',           price: 5,   isFavorite: false, sendToKitchen: false },
  { categoryId: 'cat_agua',      name: 'H2O Limoneto',           price: 7,   isFavorite: false, sendToKitchen: false },

  // Comidas
  { categoryId: 'cat_comida',    name: 'All-In de Contra Filé',  price: 60,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Double Bet Suíno',       price: 50,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Lucky Wings',            price: 45,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Carta da Mesa',          price: 45,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Fritas Clássicas',       price: 20,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Fritas Premiadas',       price: 30,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Bolinho de Linguiça',    price: 50,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Bolinho de Costela',     price: 55,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: 'Jackpot Mineiro',        price: 55,  isFavorite: false, sendToKitchen: true },
  { categoryId: 'cat_comida',    name: "Mega Jackpot Bet's Bar", price: 130, isFavorite: false, sendToKitchen: true },
]

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Limpando produtos e categorias existentes...')

  // Tenta apagar; se houver FK constraint (SaleItems existentes), desativa
  try {
    const deleted = await prisma.product.deleteMany()
    console.log(`   ${deleted.count} produto(s) apagado(s)`)
  } catch {
    const deactivated = await prisma.product.updateMany({ data: { active: false } })
    console.log(`   ⚠️  FK constraint — ${deactivated.count} produto(s) desativado(s) (histórico preservado)`)
  }

  try {
    const deleted = await prisma.category.deleteMany()
    console.log(`   ${deleted.count} categoria(s) apagada(s)`)
  } catch {
    const deactivated = await prisma.category.updateMany({ data: { active: false } })
    console.log(`   ⚠️  FK constraint — ${deactivated.count} categoria(s) desativada(s)`)
  }

  console.log('\n📂 Criando categorias...')
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, color: cat.color, icon: cat.icon, displayOrder: cat.displayOrder, active: true },
      create: { ...cat, active: true },
    })
  }
  console.log(`   ✅ ${CATEGORIES.length} categorias`)

  console.log('\n🍺 Criando produtos...')
  const placeholders: string[] = []

  for (const p of PRODUCTS) {
    await prisma.product.create({
      data: {
        categoryId: p.categoryId,
        name: p.name,
        price: p.price,
        isFavorite: p.isFavorite,
        sendToKitchen: p.sendToKitchen,
        active: true,
      },
    })
    if (p.note) placeholders.push(p.name)
  }
  console.log(`   ✅ ${PRODUCTS.length} produtos`)

  if (placeholders.length > 0) {
    console.log('\n⚠️  DRINKS SEM PREÇO (R$1 placeholder — atualize em Cadastro > Produtos):')
    placeholders.forEach((n) => console.log(`   • ${n}`))
  }

  console.log('\n🎉 Cardápio atualizado com sucesso!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

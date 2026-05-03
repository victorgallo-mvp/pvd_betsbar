import type { FastifyPluginAsync } from 'fastify'
import { SaleService } from '../services/SaleService.js'

export const productsRoutes: FastifyPluginAsync = async (app) => {
  // GET /products/categories
  app.get('/categories', async () => SaleService.getCategories())

  // GET /products?categoryId=xxx
  app.get('/', async (request) => {
    const { categoryId } = request.query as { categoryId?: string }
    return SaleService.getProducts(categoryId)
  })
}

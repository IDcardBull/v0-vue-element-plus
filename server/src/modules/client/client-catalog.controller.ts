import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { Public } from '@/common/decorators/public.decorator'
import { ProductService } from '../product/product.service'
import { CategoryService } from '../category/category.service'
import { BrandService } from '../brand/brand.service'

/**
 * 小程序端浏览接口
 * 路径前缀 /client/*，全部公开（不需要登录也能浏览商品）
 */
@Controller('client')
export class ClientCatalogController {
  constructor(
    private readonly productSvc: ProductService,
    private readonly categorySvc: CategoryService,
    private readonly brandSvc: BrandService,
  ) {}

  // ---------- 分类 / 品牌 ----------

  @Public()
  @Get('categories/tree')
  categoryTree() {
    return this.categorySvc.tree()
  }

  @Public()
  @Get('categories')
  categoryList() {
    return this.categorySvc.findAll()
  }

  @Public()
  @Get('brands')
  brandList() {
    return this.brandSvc.findAll()
  }

  // ---------- 商品 ----------

  /**
   * 商品列表
   * 可用参数：categoryId、brandId、keyword、sort（sales|new|price_asc|price_desc）、page、pageSize
   * 仅返回「已上架 + 允许零售」的商品
   */
  @Public()
  @Get('products')
  products(@Query() q: any) {
    const sortMap: Record<string, any> = {
      sales: { field: 'salesCount', order: 'desc' },
      new: { field: 'createdAt', order: 'desc' },
      price_asc: { field: 'retailPrice', order: 'asc' },
      price_desc: { field: 'retailPrice', order: 'desc' },
    }
    const sort = sortMap[q.sort] || sortMap.new
    return this.productSvc.search({
      categoryId: q.categoryId ? Number(q.categoryId) : undefined,
      brandId: q.brandId ? Number(q.brandId) : undefined,
      keyword: q.keyword,
      status: 1, // 上架
      channel: 'retail',
      page: Number(q.page) || 1,
      pageSize: Number(q.pageSize) || 10,
      sortField: sort.field,
      sortOrder: sort.order,
    })
  }

  /**
   * 推荐商品（首页用）—— 按销量倒序 top N
   */
  @Public()
  @Get('products/recommend')
  recommend(@Query('limit') limit?: string) {
    const size = Math.min(Number(limit) || 8, 30)
    return this.productSvc.search({
      status: 1,
      channel: 'retail',
      page: 1,
      pageSize: size,
      sortField: 'salesCount',
      sortOrder: 'desc',
    })
  }

  /** 商品详情（含 SKU 列表） */
  @Public()
  @Get('products/:id')
  productDetail(@Param('id', ParseIntPipe) id: number) {
    return this.productSvc.findById(id)
  }
}

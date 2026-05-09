import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { Public } from '@/common/decorators/public.decorator'
import { ProductService } from '../product/product.service'
import { CategoryService } from '../category/category.service'

/**
 * 小程序端浏览接口
 * 路径前缀 /client/*，全部公开（不需要登录也能浏览商品）
 */
@Controller('client')
export class ClientCatalogController {
  constructor(
    private readonly productSvc: ProductService,
    private readonly categorySvc: CategoryService,
  ) {}

  // ---------- 分类 ----------

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

  // ---------- 商品 ----------

  /**
   * 商品列表
   * 可用参数：categoryId、brandId、keyword、channel（retail|wholesale）、sort（sales|new|price_asc|price_desc）、page、pageSize
   * 默认返回零售商品；批发端传 channel=wholesale。
   */
  @Public()
  @Get('products')
  products(@Query() q: any) {
    return this.productList(q)
  }

  /** 兼容小程序端旧/新路径：/client/product/list */
  @Public()
  @Get('product/list')
  productList(@Query() q: any) {
    const sortMap: Record<string, any> = {
      sales: { field: 'salesCount', order: 'desc' },
      new: { field: 'createdAt', order: 'desc' },
      price_asc: { field: 'retailPrice', order: 'asc' },
      price_desc: { field: 'retailPrice', order: 'desc' },
    }
    const sort = sortMap[q.sort] || sortMap.new
    const channel = q.channel === 'wholesale' ? 'wholesale' : 'retail'
    return this.productSvc.search({
      categoryId: q.categoryId ? Number(q.categoryId) : undefined,
      keyword: q.keyword,
      status: 1,
      channel,
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

  /** 商品详情（含 SKU 列表）。channel=wholesale 才返回阶梯价/批发字段，默认零售。 */
  @Public()
  @Get('products/:id')
  productDetail(@Param('id', ParseIntPipe) id: number, @Query('channel') channel?: string) {
    return this.productSvc.findById(id, channel === 'wholesale' ? 'wholesale' : 'retail')
  }

  /** 兼容小程序端路径：/client/product/:id */
  @Public()
  @Get('product/:id')
  productDetailAlias(@Param('id', ParseIntPipe) id: number, @Query('channel') channel?: string) {
    return this.productSvc.findById(id, channel === 'wholesale' ? 'wholesale' : 'retail')
  }
}

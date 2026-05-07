"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientCatalogController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const product_service_1 = require("../product/product.service");
const category_service_1 = require("../category/category.service");
const brand_service_1 = require("../brand/brand.service");
/**
 * 小程序端浏览接口
 * 路径前缀 /client/*，全部公开（不需要登录也能浏览商品）
 */
let ClientCatalogController = class ClientCatalogController {
    constructor(productSvc, categorySvc, brandSvc) {
        this.productSvc = productSvc;
        this.categorySvc = categorySvc;
        this.brandSvc = brandSvc;
    }
    // ---------- 分类 / 品牌 ----------
    categoryTree() {
        return this.categorySvc.tree();
    }
    categoryList() {
        return this.categorySvc.findAll();
    }
    brandList() {
        return this.brandSvc.findAll();
    }
    // ---------- 商品 ----------
    /**
     * 商品列表
     * 可用参数：categoryId、brandId、keyword、channel（retail|wholesale）、sort（sales|new|price_asc|price_desc）、page、pageSize
     * 默认返回零售商品；批发端传 channel=wholesale。
     */
    products(q) {
        return this.productList(q);
    }
    /** 兼容小程序端旧/新路径：/client/product/list */
    productList(q) {
        const sortMap = {
            sales: { field: 'salesCount', order: 'desc' },
            new: { field: 'createdAt', order: 'desc' },
            price_asc: { field: 'retailPrice', order: 'asc' },
            price_desc: { field: 'retailPrice', order: 'desc' },
        };
        const sort = sortMap[q.sort] || sortMap.new;
        const channel = q.channel === 'wholesale' ? 'wholesale' : 'retail';
        return this.productSvc.search({
            categoryId: q.categoryId ? Number(q.categoryId) : undefined,
            brandId: q.brandId ? Number(q.brandId) : undefined,
            keyword: q.keyword,
            status: 1,
            channel,
            page: Number(q.page) || 1,
            pageSize: Number(q.pageSize) || 10,
            sortField: sort.field,
            sortOrder: sort.order,
        });
    }
    /**
     * 推荐商品（首页用）—— 按销量倒序 top N
     */
    recommend(limit) {
        const size = Math.min(Number(limit) || 8, 30);
        return this.productSvc.search({
            status: 1,
            channel: 'retail',
            page: 1,
            pageSize: size,
            sortField: 'salesCount',
            sortOrder: 'desc',
        });
    }
    /** 商品详情（含 SKU 列表） */
    productDetail(id) {
        return this.productSvc.findById(id);
    }
    /** 兼容小程序端路径：/client/product/:id */
    productDetailAlias(id) {
        return this.productSvc.findById(id);
    }
};
exports.ClientCatalogController = ClientCatalogController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories/tree'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "categoryTree", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "categoryList", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('brands'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "brandList", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "products", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('product/list'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "productList", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('products/recommend'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "recommend", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('products/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "productDetail", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('product/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ClientCatalogController.prototype, "productDetailAlias", null);
exports.ClientCatalogController = ClientCatalogController = __decorate([
    (0, common_1.Controller)('client'),
    __metadata("design:paramtypes", [product_service_1.ProductService,
        category_service_1.CategoryService,
        brand_service_1.BrandService])
], ClientCatalogController);
//# sourceMappingURL=client-catalog.controller.js.map
import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Product } from './entities/product.entity'
import { CreateProductDto, UpdateProductDto } from './dto/product.dto'

const BACKOFFICE_CACHE_KEY = 'products:backoffice'
const PUBLIC_CACHE_KEY = 'products:public'

export type PublicProductDto = {
    id: string
    name: string
    price: number
    points: number
    imageUrl?: string | null
    description?: string | null
    available: boolean
    stockStatus: 'available' | 'out_of_stock'
}

@Injectable()
export class ProductsService {
    constructor(
        @InjectRepository(Product)
        private productRepo: Repository<Product>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    private roundMoney(value: unknown) {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return 0
        return Math.round(parsed * 100) / 100
    }

    private normalizeText(value?: string | null) {
        const trimmed = value?.trim()
        return trimmed ? trimmed : undefined
    }

    private normalizePayload(dto: CreateProductDto | UpdateProductDto) {
        const payload: Partial<Product> = {}

        if (dto.name !== undefined) payload.name = this.normalizeText(dto.name) ?? ''
        if (dto.price !== undefined) payload.price = this.roundMoney(dto.price)
        if (dto.points !== undefined) payload.points = this.roundMoney(dto.points)
        if (dto.cost !== undefined) payload.cost = this.roundMoney(dto.cost)
        if (dto.stock !== undefined) payload.stock = Math.max(0, Math.round(Number(dto.stock) || 0))
        if (dto.imageUrl !== undefined) payload.imageUrl = this.normalizeText(dto.imageUrl) ?? null
        if (dto.description !== undefined) payload.description = this.normalizeText(dto.description) ?? null
        if (dto.active !== undefined) payload.active = dto.active

        return payload
    }

    private toPublicProduct(product: Product): PublicProductDto {
        const available = product.active && Number(product.stock ?? 0) > 0
        return {
            id: product.id,
            name: product.name,
            price: product.price,
            points: product.points,
            imageUrl: product.imageUrl,
            description: product.description,
            available,
            stockStatus: available ? 'available' : 'out_of_stock',
        }
    }

    private async clearProductsCache() {
        await Promise.all([
            this.cacheManager.del(BACKOFFICE_CACHE_KEY),
            this.cacheManager.del(PUBLIC_CACHE_KEY),
            this.cacheManager.del('products_all'),
        ])
    }

    async findAll() {
        const cached = await this.cacheManager.get(BACKOFFICE_CACHE_KEY)
        if (cached) return cached

        const products = await this.productRepo.find({
            order: {
                active: 'DESC',
                name: 'ASC',
            },
        })

        await this.cacheManager.set(BACKOFFICE_CACHE_KEY, products, 600000)
        return products
    }

    async findPublic() {
        const cached = await this.cacheManager.get(PUBLIC_CACHE_KEY)
        if (cached) return cached

        const products = await this.productRepo.find({
            where: { active: true },
            order: { name: 'ASC' },
        })
        const publicProducts = products.map((product) => this.toPublicProduct(product))

        await this.cacheManager.set(PUBLIC_CACHE_KEY, publicProducts, 600000)
        return publicProducts
    }

    async findOne(id: string) {
        const product = await this.productRepo.findOne({ where: { id } })
        if (!product) throw new NotFoundException('Product not found')
        return product
    }

    async create(dto: CreateProductDto) {
        const payload = this.normalizePayload(dto)
        if (!payload.name) throw new BadRequestException('El nombre del producto es requerido')
        const product = this.productRepo.create({
            ...payload,
            stock: payload.stock ?? 0,
            cost: payload.cost ?? 0,
            active: payload.active ?? true,
        })
        const saved = await this.productRepo.save(product)
        await this.clearProductsCache()
        return saved
    }

    async update(id: string, dto: UpdateProductDto) {
        const product = await this.findOne(id)
        const payload = this.normalizePayload(dto)
        if (payload.name !== undefined && !payload.name) {
            throw new BadRequestException('El nombre del producto es requerido')
        }
        this.productRepo.merge(product, payload)
        const saved = await this.productRepo.save(product)
        await this.clearProductsCache()
        return saved
    }

    async adjustStock(id: string, delta: number) {
        if (!Number.isInteger(delta)) {
            throw new BadRequestException('El ajuste de stock debe ser un entero')
        }
        const product = await this.findOne(id)
        const nextStock = (product.stock || 0) + delta
        if (nextStock < 0) {
            throw new BadRequestException('El stock no puede quedar en negativo')
        }
        product.stock = nextStock
        const saved = await this.productRepo.save(product)
        await this.clearProductsCache()
        return saved
    }

    async remove(id: string) {
        return this.update(id, { active: false })
    }
}

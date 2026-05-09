import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common'
import { ProductsService } from './products.service'
import { AdjustStockDto, CreateProductDto, UpdateProductDto } from './dto/product.dto'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('loyalty/public/products')
export class PublicProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    findPublic() {
        return this.productsService.findPublic()
    }
}

@Controller('loyalty/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    private assertBackoffice(user: any) {
        if (user.role !== 'admin' && user.role !== 'seller') {
            throw new ForbiddenException('No tienes permisos para ver productos')
        }
    }

    private assertAdmin(user: any) {
        if (user.role !== 'admin') {
            throw new ForbiddenException('Solo admin puede modificar productos')
        }
    }

    @Get()
    findAll(@CurrentUser() user: any) {
        this.assertBackoffice(user)
        return this.productsService.findAll()
    }

    @Post()
    create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
        this.assertAdmin(user)
        return this.productsService.create(dto)
    }

    @Put(':id')
    update(@Body() dto: UpdateProductDto, @Param('id') id: string, @CurrentUser() user: any) {
        this.assertAdmin(user)
        return this.productsService.update(id, dto)
    }

    @Post(':id/adjust-stock')
    adjustStock(@Param('id') id: string, @Body() body: AdjustStockDto, @CurrentUser() user: any) {
        this.assertAdmin(user)
        return this.productsService.adjustStock(id, body.delta)
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        this.assertAdmin(user)
        return this.productsService.remove(id)
    }
}

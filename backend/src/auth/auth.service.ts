import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { User } from '../loyalty/entities/user.entity'
import { UserActivity } from '../loyalty/entities/user-activity.entity'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { MailService } from '../mail/mail.service'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserActivity) private readonly activityRepo: Repository<UserActivity>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) { }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase()
    const normalizedCedula = dto.cedula.replace(/\D/g, '')
    if (!normalizedCedula) {
      throw new BadRequestException('La cédula es obligatoria')
    }

    const byEmail = await this.userRepo.findOne({ where: { email: normalizedEmail } })
    const byCedula = await this.userRepo.findOne({ where: { cedula: normalizedCedula } })

    let pendingUser: User | null = null

    if (byEmail && byCedula) {
      if (byEmail.id === byCedula.id) {
        pendingUser = byEmail
      } else {
        throw new ConflictException('Conflicto: Email y cédula pertenecen a cuentas distintas')
      }
    } else if (byEmail) {
      pendingUser = byEmail
    } else if (byCedula) {
      pendingUser = byCedula
    }

    if (pendingUser) {
      if (!pendingUser.isProvisional) {
        if (pendingUser.email === normalizedEmail) throw new ConflictException('El usuario ya existe')
        throw new ConflictException('La cédula ya está registrada')
      }
      // Merge/Upgrade Provisional
      const passwordHash = await bcrypt.hash(dto.password, 10)
      pendingUser.email = normalizedEmail
      pendingUser.cedula = normalizedCedula
      pendingUser.passwordHash = passwordHash
      pendingUser.name = dto.name
      pendingUser.phoneNumber = dto.phone
      pendingUser.isProvisional = false
      pendingUser.provisionalExpiresAt = null
      // Keep role as client unless specified? Guest is client.
      if (dto.role) pendingUser.role = dto.role

      const saved = await this.userRepo.save(pendingUser)
      const token = this.signToken(saved)
      return { token, user: this.cleanUser(saved) }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = this.userRepo.create({
      email: normalizedEmail,
      cedula: normalizedCedula,
      name: dto.name,
      phoneNumber: dto.phone,
      passwordHash,
      role: dto.role ?? 'client',
      isProvisional: false,
      provisionalExpiresAt: null,
    })
    const saved = await this.userRepo.save(user)
    const token = this.signToken(saved)

    return { token, user: this.cleanUser(saved) }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    // Log Activity only for client accounts
    if (user.role === 'client') {
      await this.activityRepo.save({
        user,
        type: 'LOGIN',
        data: { method: 'credentials', at: new Date() },
      })
    }

    const token = this.signToken(user)
    return { token, user: this.cleanUser(user) }
  }

  private signToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role }
    return this.jwtService.sign(payload)
  }

  cleanUser(user: User) {
    const { passwordHash, resetCode, resetCodeExpiresAt, ...rest } = user
    return rest
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } })
    if (!user) {
      return { message: 'Si el correo existe, se envió el código.' }
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    // 10 minutes expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    user.resetCode = code
    user.resetCodeExpiresAt = expiresAt
    await this.userRepo.save(user)

    await this.mailService.sendResetCode(user.email, code)

    return { message: 'Código enviado a tu correo' }
  }

  async resetPassword(dto: { email: string; code: string; newPassword: string }) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } })
    if (!user || !user.resetCode || !user.resetCodeExpiresAt) {
      throw new BadRequestException('Código inválido o expirado')
    }

    if (user.resetCode !== dto.code) {
      throw new BadRequestException('Código inválido')
    }

    if (new Date() > user.resetCodeExpiresAt) {
      throw new BadRequestException('El código ha expirado')
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10)
    user.passwordHash = passwordHash
    user.resetCode = null
    user.resetCodeExpiresAt = null
    await this.userRepo.save(user)

    return { message: 'Contraseña restablecida correctamente' }
  }
}

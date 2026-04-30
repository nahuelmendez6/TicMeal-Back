import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../entities/invitation.entity';
import * as crypto from 'crypto';
import { addDays } from 'date-fns';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
  ) {}

  async createInvitation(email: string, companyId: number): Promise<Invitation> {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (e.g., 7 days)
    const expiresAt = addDays(new Date(), 7);

    const invitation = this.invitationRepo.create({
      email,
      token,
      expiresAt,
      companyId,
    });

    return this.invitationRepo.save(invitation);
  }

  async validateToken(token: string): Promise<Invitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { token, used: false },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no válida o ya utilizada');
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('La invitación ha expirado');
    }

    return invitation;
  }

  async markAsUsed(id: string): Promise<void> {
    await this.invitationRepo.update(id, { used: true });
  }
}

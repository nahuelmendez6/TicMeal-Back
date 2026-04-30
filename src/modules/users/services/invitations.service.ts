import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../entities/invitation.entity';
import { Company } from 'src/modules/companies/entities/company.entity';
import { MailService } from 'src/modules/mail/services/mail.service';
import * as crypto from 'crypto';
import { addDays } from 'date-fns';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepo: Repository<Invitation>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly mailService: MailService,
  ) {}

  async createInvitation(email: string, companyId: number): Promise<Invitation> {
    const company = await this.companyRepo.findOneBy({ id: companyId });
    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

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

    const savedInvitation = await this.invitationRepo.save(invitation);

    // Send the invitation email
    await this.mailService.sendInvitation(email, company.name, token);

    return savedInvitation;
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

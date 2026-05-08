import { Injectable, Logger } from '@nestjs/common';
import * as SibApiV3Sdk from '@getbrevo/brevo';
import { ConfigService } from '@nestjs/config';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import { join } from 'path';
import { User } from 'src/modules/users/entities/user.entity';
import { Company } from 'src/modules/companies/entities/company.entity';

@Injectable()
export class MailService {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    
    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not defined in environment variables. Email service will not work correctly.');
    } else {
      // Configuración de la API KEY de Brevo
      this.apiInstance.setApiKey(
        SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
        apiKey,
      );
    }
  }

  // Función auxiliar para procesar tus plantillas .hbs actuales
  private async compileTemplate(
    templateName: string,
    context: any,
  ): Promise<string> {
    const templatePath = join(
      process.cwd(),
      'dist/modules/mail/templates',
      `${templateName}.hbs`,
    );
    
    if (!fs.existsSync(templatePath)) {
      this.logger.error(`Template not found at: ${templatePath}`);
      throw new Error(`Template ${templateName} not found`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);
    return compiledTemplate(context);
  }

  async sendUserCredentials(
    user: User,
    company: Company,
    plainPassword?: string,
    pin?: string,
  ) {
    try {
      const htmlContent = await this.compileTemplate('user-credentials', {
        firstName: user.firstName ?? 'usuario',
        username: user.username ?? user.email,
        password: plainPassword,
        pin: pin,
        companyName: company.name,
      });

      const mailUser = this.configService.get<string>('MAIL_USER');

      await this.apiInstance.sendTransacEmail({
        subject: `Bienvenido a ${company.name}`,
        htmlContent: htmlContent,
        sender: { name: 'TicMeal', email: mailUser },
        to: [{ email: user.email }],
      });

      this.logger.log(`Email de credenciales enviado a ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Error API Brevo (${user.email}):`,
        error.response?.body || error,
      );
    }
  }

  async sendVerificationCode(
    user: User,
    company: Company,
    verificationCode: string,
  ) {
    try {
      const htmlContent = await this.compileTemplate('email-verification', {
        firstName: user.firstName ?? 'usuario',
        verificationCode: verificationCode,
        companyName: company.name,
      });

      const mailUser = this.configService.get<string>('MAIL_USER');

      await this.apiInstance.sendTransacEmail({
        subject: `Código de verificación para ${company.name}`,
        htmlContent: htmlContent,
        sender: { name: 'TicMeal', email: mailUser },
        to: [{ email: user.email }],
      });

      this.logger.log(`Email de verificación enviado a ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Error API Brevo (${user.email}):`,
        error.response?.body || error,
      );
    }
  }

  async sendInvitation(email: string, companyName: string, token: string) {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const registrationUrl = `${frontendUrl}/register?token=${token}`;
      const htmlContent = await this.compileTemplate('invitation', {
        companyName,
        registrationUrl,
        token,
      });

      const mailUser = this.configService.get<string>('MAIL_USER');

      await this.apiInstance.sendTransacEmail({
        subject: `Invitación a unirte a ${companyName} en TicMeal`,
        htmlContent: htmlContent,
        sender: { name: 'TicMeal', email: mailUser },
        to: [{ email }],
      });

      this.logger.log(`Email de invitación enviado a ${email}`);
    } catch (error) {
      this.logger.error(
        `Error API Brevo enviando invitación a ${email}:`,
        error.response?.body || error,
      );
    }
  }

  async sendMenuUpdate(
    user: User,
    companyName: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const platformUrl = `${frontendUrl}/menus`;
      const htmlContent = await this.compileTemplate('menu-update', {
        firstName: user.firstName ?? 'Diner',
        companyName,
        startDate,
        endDate,
        platformUrl,
      });

      const mailUser = this.configService.get<string>('MAIL_USER');

      await this.apiInstance.sendTransacEmail({
        subject: `🍽️ Nuevo Menú publicado en ${companyName}`,
        htmlContent: htmlContent,
        sender: { name: 'TicMeal', email: mailUser },
        to: [{ email: user.email }],
      });

      this.logger.log(`Email de actualización de menú enviado a ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Error API Brevo enviando actualización de menú a ${user.email}:`,
        error.response?.body || error,
      );
    }
  }
}

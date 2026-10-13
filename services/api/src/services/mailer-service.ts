import nodemailer, { Transporter } from "nodemailer";

export type SupportedLang = "pt" | "es" | "en";

export interface MailerConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  requireTLS?: boolean;
  user?: string;
  password?: string;
  from?: string;
  appPublicUrl?: string;
}

export interface VerificationEmailParams {
  to: string;
  name?: string;
  code: string;
  link?: string;
  lang?: SupportedLang;
  countryCode?: string;
}

export interface WelcomeEmailParams {
  to: string;
  name?: string;
  appUrl?: string;
  lang?: SupportedLang;
  countryCode?: string;
}

export interface RecoveryEmailParams {
  to: string;
  link: string;
  lang?: SupportedLang;
  countryCode?: string;
}

export class MailerService {
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appPublicUrl: string;

  constructor(config: MailerConfig = {}) {
    const host = config.host || process.env.SMTP_HOST;
    const port = config.port || Number(process.env.SMTP_PORT || 587);
    const user = config.user || process.env.SMTP_USER;
    const password = config.password || process.env.SMTP_PASSWORD;
    const secure = config.secure ?? (process.env.SMTP_SECURE === "true");
    const requireTLS = config.requireTLS ?? (process.env.SMTP_REQUIRE_TLS !== "false" && !secure);

    this.from = config.from || process.env.SMTP_FROM || "Binmax Broker <suporte@binmaxbroker.com>";
    this.appPublicUrl = config.appPublicUrl || process.env.APP_PUBLIC_URL || "https://binmaxbroker.com";

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
        auth: user && password ? { user, pass: password } : undefined
      });
    }
  }

  public isConfigured(): boolean {
    return this.transporter !== null;
  }

  public resolveLang(countryCode?: string, preferredLang?: string): SupportedLang {
    if (preferredLang === "pt" || preferredLang === "es" || preferredLang === "en") {
      return preferredLang;
    }
    const cc = (countryCode || "").toUpperCase().trim();
    if (["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"].includes(cc)) {
      return "pt";
    }
    if ([
      "ES", "MX", "CO", "AR", "CL", "PE", "UY", "VE", "EC",
      "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA"
    ].includes(cc)) {
      return "es";
    }
    return "en";
  }

  public async sendVerificationEmail(params: VerificationEmailParams): Promise<boolean> {
    if (!this.transporter) return false;

    const lang = params.lang || this.resolveLang(params.countryCode);
    const name = params.name ? params.name.trim() : "Trader";
    const link = params.link || `${this.appPublicUrl}/verificar?code=${encodeURIComponent(params.code)}`;

    const content = {
      pt: {
        subject: `Seu código de verificação: ${params.code} — Binmax Broker`,
        badge: "VERIFICAÇÃO DE SEGURANÇA",
        headline: `Confirmação de acesso, ${name}`,
        intro: `Para concluir a ativação da sua conta e liberar sua banca demonstrativa de <strong style="color: #22C47A;">$10.000 USD</strong> na sala de operações, utilize o código de segurança abaixo:`,
        codeLabel: "CÓDIGO DE ATIVAÇÃO:",
        buttonText: "Confirmar E-mail e Acessar Plataforma",
        footerNote: "Válido por 15 minutos. Contas verificadas possuem saques prioritários e proteção de capital.",
        text: `Olá ${name},\n\nSeu código de ativação Binmax é: ${params.code}\n\nOu abra este link para ativar em 1 clique:\n${link}\n\nCódigo válido por 15 minutos.\nEquipe Binmax Broker`
      },
      es: {
        subject: `Tu código de verificación: ${params.code} — Binmax Broker`,
        badge: "VERIFICACIÓN DE SEGURIDAD",
        headline: `Confirmación de acceso, ${name}`,
        intro: `Para completar la activación de tu cuenta y liberar tu saldo de práctica de <strong style="color: #22C47A;">$10.000 USD</strong> en la sala de operaciones, utiliza el código de seguridad:`,
        codeLabel: "CÓDIGO DE ACTIVACIÓN:",
        buttonText: "Confirmar Correo y Entrar a la Plataforma",
        footerNote: "Válido por 15 minutos. Las cuentas verificadas cuentan con retiros prioritarios y protección de capital.",
        text: `Hola ${name},\n\nTu código de activación Binmax es: ${params.code}\n\nO abre este enlace para activar en 1 clic:\n${link}\n\nCódigo válido por 15 minutos.\nEquipo Binmax Broker`
      },
      en: {
        subject: `Your verification code: ${params.code} — Binmax Broker`,
        badge: "SECURITY VERIFICATION",
        headline: `Access confirmation, ${name}`,
        intro: `To complete your account activation and unlock your <strong style="color: #22C47A;">$10,000 USD</strong> practice balance on the trading floor, enter the code below:`,
        codeLabel: "ACTIVATION CODE:",
        buttonText: "Verify Email & Open Trading Room",
        footerNote: "Valid for 15 minutes. Verified accounts enjoy priority withdrawals and capital protection.",
        text: `Hello ${name},\n\nYour Binmax activation code is: ${params.code}\n\nOr open this link to verify in 1 click:\n${link}\n\nCode valid for 15 minutes.\nBinmax Broker Team`
      }
    }[lang];

    const html = this.wrapTemplate({
      title: content.subject,
      badge: content.badge,
      headline: content.headline,
      bodyHtml: `
        <p style="margin: 0 0 20px; color: #8A92A1; font-size: 14px; line-height: 1.6;">
          ${content.intro}
        </p>

        <!-- Precision OTP Code Box (Turbo Prata Design System) -->
        <div style="background-color: #0D0F14; border: 1px solid #232936; border-radius: 8px; padding: 22px 16px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; font-weight: 600; color: #8A92A1; letter-spacing: 1.5px; margin-bottom: 10px; text-transform: uppercase;">
            ${content.codeLabel}
          </div>
          <div style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #F4F5F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; display: inline-block;">
            ${params.code}
          </div>
        </div>
      `,
      ctaText: content.buttonText,
      ctaUrl: link,
      footerNote: content.footerNote
    });

    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: content.subject,
      text: content.text,
      html
    });

    return true;
  }

  public async sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
    if (!this.transporter) return false;

    const lang = params.lang || this.resolveLang(params.countryCode);
    const name = params.name ? params.name.trim() : "Trader";
    const appUrl = params.appUrl || this.appPublicUrl;

    const content = {
      pt: {
        subject: "Conta Verificada: Sua banca de $10.000 está liberada — Binmax Broker",
        badge: "CONTA VERIFICADA",
        headline: `Tudo pronto para operar, ${name}`,
        intro: `Sua conta na <strong>Binmax Broker</strong> foi verificada com sucesso. Liberamos a sua banca demonstrativa de <strong style="color: #22C47A;">$10.000,00 USD</strong> para você operar sem risco no mercado ao vivo.`,
        cta: "Acessar Sala de Operações",
        text: `Olá ${name},\n\nSua conta Binmax está verificada e seus $10.000 USD de saldo demo foram liberados.\n\nAcesse a sala de operações: ${appUrl}\n\nEquipe Binmax`
      },
      es: {
        subject: "Cuenta Verificada: Tu saldo de $10.000 está listo — Binmax Broker",
        badge: "CUENTA VERIFICADA",
        headline: `Todo listo para operar, ${name}`,
        intro: `Tu cuenta en <strong>Binmax Broker</strong> ha sido verificada con éxito. Hemos acreditado tu saldo completo de <strong style="color: #22C47A;">$10.000,00 USD</strong> para operar sin riesgo en el mercado real.`,
        cta: "Entrar a la Sala de Trading",
        text: `Hola ${name},\n\nTu cuenta Binmax está verificada y tus $10.000 USD de saldo demo han sido liberados.\n\nAccede a la sala de trading: ${appUrl}\n\nEquipo Binmax`
      },
      en: {
        subject: "Account Verified: Your $10,000 balance is ready — Binmax Broker",
        badge: "VERIFIED ACCOUNT",
        headline: `Ready to trade, ${name}`,
        intro: `Your <strong>Binmax Broker</strong> account is successfully verified. We have unlocked your full <strong style="color: #22C47A;">$10,000.00 USD</strong> practice balance for live synthetic markets.`,
        cta: "Open Trading Floor",
        text: `Hello ${name},\n\nYour Binmax account is verified and your $10,000 USD demo balance is fully unlocked.\n\nAccess the trading floor: ${appUrl}\n\nBinmax Team`
      }
    }[lang];

    const html = this.wrapTemplate({
      title: content.subject,
      badge: content.badge,
      headline: content.headline,
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #8A92A1; font-size: 14px; line-height: 1.6;">
          ${content.intro}
        </p>
        <div style="background-color: #0D0F14; border: 1px solid #232936; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color: #8A92A1; font-size: 13px;">Saldo Demonstrativo:</td>
              <td align="right" style="color: #22C47A; font-size: 15px; font-weight: 700; font-family: monospace;">$10.000,00 USD</td>
            </tr>
            <tr>
              <td style="color: #8A92A1; font-size: 13px; padding-top: 8px;">Mercado:</td>
              <td align="right" style="color: #DCE1EA; font-size: 13px; font-weight: 500; padding-top: 8px;">Índices Sintéticos 24/7</td>
            </tr>
          </table>
        </div>
      `,
      ctaText: content.cta,
      ctaUrl: appUrl
    });

    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: content.subject,
      text: content.text,
      html
    });

    return true;
  }

  public async sendRecoveryEmail(params: RecoveryEmailParams): Promise<boolean> {
    if (!this.transporter) return false;

    const lang = params.lang || this.resolveLang(params.countryCode);
    const content = {
      pt: {
        subject: "Redefinição de Senha — Binmax Broker",
        badge: "SEGURANÇA",
        headline: "Recuperação de Acesso",
        intro: "Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Binmax Broker</strong>.",
        cta: "Redefinir Minha Senha",
        footer: "Se você não solicitou esta alteração, ignore este e-mail. Este link expira em 15 minutos.",
        text: `Abra este link para redefinir sua senha (válido por 15 minutos):\n${params.link}\n\nEquipe Binmax`
      },
      es: {
        subject: "Restablecer Contraseña — Binmax Broker",
        badge: "SEGURIDAD",
        headline: "Recuperación de Acceso",
        intro: "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Binmax Broker</strong>.",
        cta: "Restablecer Contraseña",
        footer: "Si no solicitaste este cambio, ignora este mensaje. Este enlace expira en 15 minutos.",
        text: `Abre este enlace para restablecer tu contraseña (válido por 15 minutos):\n${params.link}\n\nEquipo Binmax`
      },
      en: {
        subject: "Password Reset Request — Binmax Broker",
        badge: "SECURITY",
        headline: "Access Recovery",
        intro: "We received a request to reset your password for your <strong>Binmax Broker</strong> account.",
        cta: "Reset My Password",
        footer: "If you did not request this change, please ignore this email. This link expires in 15 minutes.",
        text: `Open this link to reset your password (valid for 15 minutes):\n${params.link}\n\nBinmax Team`
      }
    }[lang];

    const html = this.wrapTemplate({
      title: content.subject,
      badge: content.badge,
      headline: content.headline,
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #8A92A1; font-size: 14px; line-height: 1.6;">
          ${content.intro}
        </p>
      `,
      ctaText: content.cta,
      ctaUrl: params.link,
      footerNote: content.footer
    });

    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: content.subject,
      text: content.text,
      html
    });

    return true;
  }

  private wrapTemplate(data: {
    title: string;
    badge: string;
    headline: string;
    bodyHtml: string;
    ctaText: string;
    ctaUrl: string;
    footerNote?: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0F14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F4F5F7;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0D0F14; padding: 48px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container (Turbo Prata System: Panel #151922, Border #232936) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #151922; border: 1px solid #232936; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
          
          <!-- Header Branding (Official Dual Chevron Symbol + Wordmark) -->
          <tr>
            <td style="padding: 28px 32px 24px; border-bottom: 1px solid #232936;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Símbolo Seta Dupla (Prata #DCE1EA e Aço #8A92A1) -->
                        <td style="vertical-align: middle; padding-right: 12px; line-height: 0;">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28" fill="none">
                            <path d="M 9 26 L 24 11 L 39 26" stroke="#DCE1EA" stroke-width="6.5" stroke-linejoin="miter" stroke-linecap="square" />
                            <path d="M 9 41 L 24 26 L 39 41" stroke="#8A92A1" stroke-width="6.5" stroke-linejoin="miter" stroke-linecap="square" />
                          </svg>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 19px; font-weight: 700; letter-spacing: -0.2px; color: #DCE1EA; display: inline-block;">BINMAX</span>
                          <span style="font-size: 10px; font-weight: 600; letter-spacing: 2px; color: #8A92A1; display: inline-block; margin-left: 4px;">BROKER</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <!-- Badge Discreto em Metal (Anti-Cassino) -->
                    <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 600; color: #8A92A1; background-color: #0D0F14; border: 1px solid #232936; border-radius: 4px; letter-spacing: 0.8px;">
                      ${data.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 19px; font-weight: 600; color: #F4F5F7; line-height: 1.35; letter-spacing: -0.2px;">
                ${data.headline}
              </h1>

              ${data.bodyHtml}

              <!-- CTA Button (Verde Ganancia #22C47A - Precision Refined) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 14px;">
                <tr>
                  <td align="center">
                    <a href="${data.ctaUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #22C47A; color: #0D0F14; text-align: center; padding: 13px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; text-decoration: none;">
                      ${data.ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              ${data.footerNote ? `
                <p style="margin: 18px 0 0; font-size: 12px; color: #8A92A1; text-align: center; line-height: 1.5;">
                  ${data.footerNote}
                </p>
              ` : ""}
            </td>
          </tr>

          <!-- Legal / Risk Footer -->
          <tr>
            <td style="background-color: #0D0F14; padding: 22px 32px; border-top: 1px solid #232936; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #8A92A1; line-height: 1.4;">
                © 2026 Binmax Broker. Todos os direitos reservados.
              </p>
              <p style="margin: 0; font-size: 10px; color: #535B6A; line-height: 1.4;">
                Aviso de Risco: A negociação de derivativos e índices sintéticos envolve risco substancial de perda. Opere apenas com capital que você pode se permitir perder.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

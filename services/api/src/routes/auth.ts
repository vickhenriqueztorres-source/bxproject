import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../services/auth-service.js";
import { MailerService } from "../services/mailer-service.js";

interface AuthRoutesOptions {
  sendRecoveryEmail?: (email: string, link: string) => Promise<void>;
  sendWelcomeEmail?: (email: string, name: string) => Promise<void>;
  sendVerificationEmail?: (email: string, code: string, link: string, country?: string, name?: string) => Promise<void>;
  mailerService?: MailerService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (server, options) => {
  const authService = new AuthService(server.pg);
  const appPublicUrl = process.env.APP_PUBLIC_URL;
  const recoveryBase = appPublicUrl ? new URL("/recuperar", appPublicUrl) : null;
  const mailerService = options.mailerService || new MailerService();

  const sendRecoveryEmail = options.sendRecoveryEmail || (mailerService.isConfigured() && recoveryBase
    ? async (email: string, link: string) => {
        await mailerService.sendRecoveryEmail({ to: email, link });
      }
    : null);

  const sendWelcomeEmail = options.sendWelcomeEmail || (mailerService.isConfigured()
    ? async (email: string, name: string) => {
        await mailerService.sendWelcomeEmail({ to: email, name });
      }
    : null);

  const sendVerificationEmail = options.sendVerificationEmail || (mailerService.isConfigured()
    ? async (email: string, code: string, link: string, country?: string, name?: string) => {
        await mailerService.sendVerificationEmail({
          to: email,
          name,
          code,
          link,
          countryCode: country
        });
      }
    : null);

  // Helper para registrar rotas com suporte a ambos os prefixos (/api/v1/auth e /v1/auth)
  const registerAuthRoutes = (prefix: string) => {
    // 1. Registro
    server.post(`${prefix}/register`, async (request, reply) => {
      const body = request.body as any;
      if (!body) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "Cuerpo de solicitud requerido" });
      }

      const result = await authService.register({
        name: body.name,
        email: body.email,
        password: body.password,
        country: body.country || body.country_code
      });

      if (!result.success) {
        return reply.status(result.error.status).send(result.error);
      }

      // Gera código de 6 dígitos para o fluxo de verificação
      try {
        const verif = await authService.requestEmailVerification(result.data.user.id);
        const verifLink = `${appPublicUrl || "https://binmaxbroker.com"}/verificar?code=${verif.code}`;
        if (sendVerificationEmail) {
          await sendVerificationEmail(body.email, verif.code, verifLink, body.country, body.name);
        } else if (sendWelcomeEmail) {
          await sendWelcomeEmail(body.email, body.name || "");
        }
      } catch (error) {
        server.log.error({ err: error }, "Failed to generate or send verification email");
      }

      return reply.status(201).send(result.data);
    });

    // 2. Login
    server.post(`${prefix}/login`, async (request, reply) => {
      const body = request.body as any;
      if (!body) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "Cuerpo de solicitud requerido" });
      }

      const result = await authService.login({
        email: body.email,
        password: body.password
      });

      if (!result.success) {
        if (result.error.retry_after_seconds) {
          reply.header("Retry-After", result.error.retry_after_seconds.toString());
        }
        return reply.status(result.error.status).send(result.error);
      }

      return reply.status(200).send(result.data);
    });

    // 3. Solicitação de recuperação de senha
    server.post(`${prefix}/recovery/request`, async (request, reply) => {
      const body = request.body as any;
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: "VALIDATION_ERROR", message: "Email inválido" });
      }

      if (!sendRecoveryEmail || !recoveryBase) {
        return reply.status(503).send({ error: "RECOVERY_UNAVAILABLE" });
      }
      const res = await authService.requestPasswordRecovery(email);
      if (res) {
        const link = new URL(recoveryBase);
        link.hash = `token=${encodeURIComponent(res.token)}`;
        try {
          await sendRecoveryEmail(email, link.toString());
        } catch (error) {
          server.log.error({ err: error }, "Failed to send recovery email");
        }
      }
      return reply.status(200).send({
        success: true,
        message: "Si el correo está registrado, recibirás un enlace de recuperación válido por 15 minutos."
      });
    });

    // 4. Redefinição de senha com token
    server.post(`${prefix}/recovery/reset`, async (request, reply) => {
      const body = request.body as any;
      const token = body?.token;
      const newPassword = body?.new_password || body?.newPassword || body?.password;

      if (!token || !newPassword) {
        return reply.status(400).send({ error: "VALIDATION_ERROR", message: "Token y nueva contraseña requeridos" });
      }

      const success = await authService.resetPassword({
        token,
        newPassword
      });

      if (!success) {
        return reply.status(400).send({
          error: "INVALID_TOKEN",
          message: "El enlace de recuperación es inválido o ha expirado (límite de 15 minutos)."
        });
      }

      return reply.status(200).send({
        success: true,
        message: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña."
      });
    });

    // 5. Verificação de e-mail (OTP ou Magic Link)
    server.post(`${prefix}/verify-email`, async (request, reply) => {
      const body = request.body as any;
      const code = typeof body?.code === "string" ? body.code.trim() : undefined;
      const token = typeof body?.token === "string" ? body.token.trim() : undefined;
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;

      if (!code && !token) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Código de 6 dígitos o token requerido para verificar el correo"
        });
      }

      const res = await authService.verifyEmail({ code, token, email });
      if (!res.success) {
        return reply.status(400).send({
          error: res.error || "INVALID_CODE",
          message: "Código de activación inválido o expirado (límite de 15 minutos)"
        });
      }

      // Envia e-mail comemorativo de conta verificada com $10.000 liberados
      if (sendWelcomeEmail && res.user) {
        try {
          await sendWelcomeEmail(res.user.email, res.user.name);
        } catch (error) {
          server.log.error({ err: error }, "Failed to send verified welcome email");
        }
      }

      return reply.status(200).send({
        success: true,
        message: "Correo electrónico verificado exitosamente. Tu saldo completo de $10.000 USD está desbloqueado.",
        user: res.user
      });
    });

    // 6. Reenvio de código de verificação
    server.post(`${prefix}/resend-verification`, async (request, reply) => {
      const body = request.body as any;
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!email) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",
          message: "Correo electrónico requerido"
        });
      }

      const res = await authService.resendVerificationCode(email);
      if (res && sendVerificationEmail) {
        const verifLink = `${appPublicUrl || "https://binmaxbroker.com"}/verificar?code=${res.code}`;
        try {
          await sendVerificationEmail(res.user.email, res.code, verifLink, res.user.country, res.user.name);
        } catch (error) {
          server.log.error({ err: error }, "Failed to resend verification email");
        }
      }

      return reply.status(200).send({
        success: true,
        message: "Si la cuenta no está verificada, recibirás un nuevo código de activación."
      });
    });

    // 7. Perfil atual /me
    server.get(
      `${prefix}/me`,
      {
        preHandler: [(server as any).authenticate]
      },
      async (request, reply) => {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "UNAUTHORIZED", message: "Usuario no autenticado" });
        }

        const fullUser = await authService.getUserById(user.id);
        if (!fullUser) {
          return reply.status(404).send({ error: "USER_NOT_FOUND" });
        }

        return reply.status(200).send(fullUser);
      }
    );

    // 8. Atualização de perfil PUT /me
    server.put(
      `${prefix}/me`,
      {
        preHandler: [(server as any).authenticate]
      },
      async (request, reply) => {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "UNAUTHORIZED", message: "Usuario no autenticado" });
        }

        const body = (request.body || {}) as any;
        try {
          const updatedUser = await authService.updateProfile(user.id, {
            name: body.name,
            country: body.country,
            phone_code: body.phone_code || body.phoneCode,
            phone_number: body.phone_number || body.phoneNumber
          });

          const token = await authService.createToken(updatedUser);
          return reply.status(200).send({
            success: true,
            message: "Perfil guardado con éxito",
            user: updatedUser,
            token
          });
        } catch (err: any) {
          server.log.error(err, "Failed to update profile");
          const msg = err.message || "Error al actualizar perfil";
          return reply.status(400).send({ error: "BAD_REQUEST", message: msg });
        }
      }
    );

    // 9. Alteração de senha PUT /password
    server.put(
      `${prefix}/password`,
      {
        preHandler: [(server as any).authenticate]
      },
      async (request, reply) => {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "UNAUTHORIZED", message: "Usuario no autenticado" });
        }

        const body = (request.body || {}) as any;
        try {
          const res = await authService.updatePassword(user.id, {
            current_password: body.current_password || body.currentPassword,
            new_password: body.new_password || body.newPassword
          });

          return reply.status(200).send(res);
        } catch (err: any) {
          server.log.error(err, "Failed to update password");
          const msg = err.message || "Error al actualizar contraseña";
          return reply.status(400).send({ error: "BAD_REQUEST", message: msg });
        }
      }
    );
  };

  registerAuthRoutes("/api/v1/auth");
  registerAuthRoutes("/v1/auth");
};

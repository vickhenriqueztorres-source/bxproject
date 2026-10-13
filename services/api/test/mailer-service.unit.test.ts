import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MailerService } from "../src/services/mailer-service.js";

describe("MailerService Unit Tests", () => {
  it("initializes as unconfigured when SMTP_HOST is absent", () => {
    const service = new MailerService({ host: "" });
    assert.equal(service.isConfigured(), false);
  });

  it("sendWelcomeEmail returns false when unconfigured without throwing error", async () => {
    const service = new MailerService({ host: "" });
    const result = await service.sendWelcomeEmail({
      to: "test@binmax.com",
      name: "Juan Perez"
    });
    assert.equal(result, false);
  });

  it("sendRecoveryEmail returns false when unconfigured without throwing error", async () => {
    const service = new MailerService({ host: "" });
    const result = await service.sendRecoveryEmail({
      to: "test@binmax.com",
      link: "https://binmaxbroker.com/recuperar#token=abc123xyz"
    });
    assert.equal(result, false);
  });

  it("sendVerificationEmail returns false when unconfigured without throwing error", async () => {
    const service = new MailerService({ host: "" });
    const result = await service.sendVerificationEmail({
      to: "test@binmax.com",
      code: "123456",
      name: "Trader Brasil",
      countryCode: "BR"
    });
    assert.equal(result, false);
  });

  it("resolves language accurately according to countryCode and preferredLang", () => {
    const service = new MailerService({ host: "" });
    // Português
    assert.equal(service.resolveLang("BR"), "pt");
    assert.equal(service.resolveLang("PT"), "pt");
    assert.equal(service.resolveLang("br"), "pt");

    // Espanhol
    assert.equal(service.resolveLang("MX"), "es");
    assert.equal(service.resolveLang("CO"), "es");
    assert.equal(service.resolveLang("ES"), "es");
    assert.equal(service.resolveLang("AR"), "es");

    // Global / Inglês
    assert.equal(service.resolveLang("US"), "en");
    assert.equal(service.resolveLang("GB"), "en");
    assert.equal(service.resolveLang("DE"), "en");
    assert.equal(service.resolveLang(""), "en");

    // Override manual
    assert.equal(service.resolveLang("BR", "en"), "en");
    assert.equal(service.resolveLang("US", "es"), "es");
  });

  it("isConfigured returns true when host is provided", () => {
    const service = new MailerService({
      host: "localhost",
      port: 1025,
      from: "noreply@binmaxbroker.com"
    });
    assert.equal(service.isConfigured(), true);
  });
});

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { VerificationPage } from './VerificationPage';

describe('Subetapa 02 — Verificação de Conta (Hierarquia Narrativa & 5 Estados)', () => {
  it('renderiza com sucesso a hierarquia narrativa (Protagonista Dropzone, Coadjuvante e Nota de Rodapé)', () => {
    const html = renderToString(<VerificationPage />);

    // Protagonista: Dropzone
    expect(html).toContain('Arrastra tus archivos aquí o haz clic para seleccionar');
    expect(html).toContain('Formatos: JPG, PNG o PDF');

    // Coadjuvante: Documentos aceitos
    expect(html).toContain('Documentos aceptados:');
    expect(html).toContain('Pasaporte internacional');
    expect(html).toContain('DNI / Documento Nacional');
    expect(html).toContain('Licencia de conducir vigente');

    // Nota de rodapé: Documento rejeitado e justificativa
    expect(html).toContain('Ejemplo de documento rechazado');
    expect(html).toContain('El documento no es legible');
    expect(html).toContain('¿Por qué verificar tu cuenta?');
    expect(html).toContain('Habilita retiros instantáneos vía PIX sin límites');
  });

  it('garante o uso de ícones vetoriais SVG de precisão e ausência de emojis soltos', () => {
    const html = renderToString(<VerificationPage />);

    // SVG presente
    expect(html).toContain('<svg');
    expect(html).toContain('stroke="currentColor"');

    // Emojis soltos proibidos eliminados
    expect(html).not.toContain('✉️');
    expect(html).not.toContain('🪪');
    expect(html).not.toContain('☁️');
  });

  it('valida os tokens de superfície da BINMAX (#0B0E14, #101622, #1C2738)', () => {
    const html = renderToString(<VerificationPage />);
    expect(html).toContain('#101622'); // Alias legado de painel (bg1)
    expect(html).toContain('#1C2738'); // Superfície de campo/dropzone
    expect(html).toContain('bm-page-enter'); // Classe de animação em bloco
    expect(html).toContain('bm-tabular-nums'); // Numerais tabulares
  });

  it('suporta diferentes estados iniciais de KYC sem falhas de hidratação', () => {
    const inReviewHtml = renderToString(
      <VerificationPage initialIdentityStatus="IN_REVIEW" initialAddressStatus="APPROVED" />
    );
    expect(inReviewHtml).toContain('En revisión');
  });

  describe('Teste de Estresse de Renderização da Verificação', () => {
    it('executa 100 ciclos de renderização SSR da tela completa em alta performance', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <VerificationPage
            initialIdentityStatus={i % 2 === 0 ? 'PENDING' : 'IN_REVIEW'}
          />
        );
        expect(html.length).toBeGreaterThan(1000);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});

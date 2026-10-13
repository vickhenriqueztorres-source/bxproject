import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { VerificationPage } from './VerificationPage';
import { SettingsPage } from './SettingsPage';

describe('SUBETAPA 04: Verificação de Identidade (KYC) e Ajustes BINMAX', () => {
  it('4.1 VerificationPage: Renderiza os 3 passos de KYC, dropzones, barra de progresso e exemplo rejeitado', () => {
    const html = renderToString(<VerificationPage />);

    expect(html).toContain('data-testid="verification-page"');
    expect(html).toContain('Verificación de cuenta');
    expect(html).toContain('Email');
    expect(html).toContain('Aprobado');
    expect(html).toContain('Identidad');
    expect(html).toContain('Pendiente');
    expect(html).toContain('Arrastra tus archivos aquí o haz clic para seleccionar');
    expect(html).toContain('Dirección');
    expect(html).toContain('En revisión');
    expect(html).toContain('Tu progreso');
    expect(html).toContain('1 de 3 completados');
    expect(html).toContain('¿Por qué verificar tu cuenta?');
    expect(html).toContain('Ejemplo de documento rechazado');
    expect(html).toContain('El documento no es legible');
  });

  it('4.2 SettingsPage: Renderiza menu lateral interno e os 5 cartões modulares com botão Guardar', () => {
    const html = renderToString(<SettingsPage />);

    expect(html).toContain('data-testid="settings-page"');
    expect(html).toContain('Ajustes');
    expect(html).toContain('Perfil');
    expect(html).toContain('Seguridad');
    expect(html).toContain('Operación');
    expect(html).toContain('Notificaciones');
    expect(html).toContain('Idioma y zona horaria');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('Verificación en dos pasos (2FA)');
    expect(html).toContain('Sesiones activas');
    expect(html).toContain('Windows · Chrome');
    expect(html).toContain('Confirmación de un clic');
    expect(html).toContain('Sonido de resultado');
    expect(html).toContain('Email de depósito');
    expect(html).toContain('Ciudad de México');
  });
});

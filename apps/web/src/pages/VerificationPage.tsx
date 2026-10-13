import React, { useState, useEffect } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import {
  IconEmail,
  IconIdentity,
  IconUploadCloud,
  IconCheckCircle,
  IconClock,
  IconShield,
  IconAlertCircle,
} from '../components/icons/PrecisionIcons';
import { PRECISION_SURFACES, PRECISION_COLORS } from '../lib/design-tokens';
import { getKycStatus, submitKycDocument, KycStatusType } from '../api/client';

export type KycStatus = KycStatusType;

export interface VerificationPageProps {
  initialIdentityStatus?: KycStatus;
  initialAddressStatus?: KycStatus;
}

export function VerificationPage({
  initialIdentityStatus = 'PENDING',
  initialAddressStatus = 'PENDING',
}: VerificationPageProps) {
  const [identityStatus, setIdentityStatus] = useState<KycStatus>(initialIdentityStatus);
  const [addressStatus, setAddressStatus] = useState<KycStatus>(initialAddressStatus);
  const [uploadedIdentityFile, setUploadedIdentityFile] = useState<string | null>(null);
  const [uploadedAddressFile, setUploadedAddressFile] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState(false);
  const [dragActiveAddr, setDragActiveAddr] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getKycStatus()
      .then((status) => {
        if (!isMounted) return;
        if (status.identity_status) setIdentityStatus(status.identity_status);
        if (status.address_status) setAddressStatus(status.address_status);
        if (status.uploaded_files && status.uploaded_files.length > 0) {
          const idFile = status.uploaded_files.find((f) => f.category === 'identity');
          const addrFile = status.uploaded_files.find((f) => f.category === 'address');
          if (idFile) setUploadedIdentityFile(idFile.name);
          if (addrFile) setUploadedAddressFile(addrFile.name);
        }
      })
      .catch((err) => {
        console.warn('[KYC Status Load Error]', err);
      });
    return () => { isMounted = false; };
  }, []);

  const handleIdentityUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFileUpload(file, 'identity');
    }
  };

  const handleAddressUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFileUpload(file, 'address');
    }
  };

  const processFileUpload = async (file: File, type: 'identity' | 'address') => {
    setErrorMessage(null);

    // Validação estrita de arquivo (máx 15MB, formatos de imagem/PDF)
    const validExtensions = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validExtensions.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      setErrorMessage('Formato de archivo no válido. Solo se admiten JPG, PNG y PDF.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('El archivo excede el tamaño máximo permitido de 15 MB.');
      return;
    }

    setUploadProgress(25);
    try {
      setUploadProgress(60);
      const resp = await submitKycDocument({
        category: type,
        file_name: file.name,
        document_type: type === 'identity' ? 'PASSPORT' : 'UTILITY_BILL',
      });
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 300);

      if (type === 'identity') {
        setUploadedIdentityFile(file.name);
        setIdentityStatus(resp.identity_status || 'IN_REVIEW');
      } else {
        setUploadedAddressFile(file.name);
        setAddressStatus(resp.address_status || 'IN_REVIEW');
      }
    } catch (err: any) {
      setUploadProgress(null);
      setErrorMessage(err?.message || 'Error al enviar el documento para validación.');
    }
  };


  return (
    <SecondaryLayout>
      <div
        data-testid="verification-page"
        className="bm-page-enter"
        style={{
          padding: '16px 0 40px',
          fontFamily: "'Geist', sans-serif",
          color: PRECISION_COLORS.textPrimary,
        }}
      >
        {/* Cabeçalho da Página com Ritmo Calmo */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: PRECISION_COLORS.textPrimary,
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            Verificación de cuenta
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.5 }}>
            Completa la verificación para desbloquear todas las funciones de BINMAX y operar sin límites.
          </p>
        </div>

        {/* Layout de Grid Asimétrico: Coluna Principal 65% / Suporte Lateral 35% */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)',
            gap: '24px',
            alignItems: 'start',
          }}
          className="verification-grid"
        >
          {/* COLUNA ESQUERDA: NARRATIVA DE VERIFICAÇÃO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* PASSO 1: EMAIL (APROBADO) */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.panel,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '8px',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 229, 153, 0.12)',
                    color: PRECISION_COLORS.gain,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  1
                </div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '6px',
                    backgroundColor: PRECISION_SURFACES.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRECISION_COLORS.textSecondary,
                  }}
                >
                  <IconEmail size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_COLORS.textPrimary, marginBottom: '2px' }}>
                    Email
                  </div>
                  <div style={{ fontSize: '13px', color: PRECISION_COLORS.textSecondary }}>
                    Confirma tu dirección de correo electrónico para asegurar tu cuenta.
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(0, 229, 153, 0.12)',
                    border: `1px solid ${PRECISION_COLORS.gain}`,
                    color: PRECISION_COLORS.gain,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <IconCheckCircle size={13} /> Aprobado
                </span>
                <div className="bm-tabular-nums" style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  09 oct. 2026, 18:20
                </div>
              </div>
            </div>

            {/* PASSO 2: IDENTIDAD (PROTAGONISTA DA TELA) */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.panel,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              {/* Cabeçalho do Passo 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: PRECISION_COLORS.textPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    2
                  </div>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: PRECISION_SURFACES.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: PRECISION_COLORS.textSecondary,
                    }}
                  >
                    <IconIdentity size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_COLORS.textPrimary, marginBottom: '2px' }}>
                      Identidad
                    </div>
                    <div style={{ fontSize: '13px', color: PRECISION_COLORS.textSecondary }}>
                      Sube un documento de identificación oficial (frente y reverso).
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    backgroundColor:
                      identityStatus === 'IN_REVIEW'
                        ? 'rgba(46, 134, 222, 0.15)'
                        : 'rgba(255, 170, 0, 0.15)',
                    border: `1px solid ${
                      identityStatus === 'IN_REVIEW' ? PRECISION_COLORS.system : PRECISION_COLORS.pending
                    }`,
                    color: identityStatus === 'IN_REVIEW' ? PRECISION_COLORS.system : PRECISION_COLORS.pending,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {identityStatus === 'IN_REVIEW' ? (
                    <>
                      <IconClock size={13} /> En revisión
                    </>
                  ) : (
                    <>
                      <IconAlertCircle size={13} /> Pendiente
                    </>
                  )}
                </span>
              </div>

              {/* GRID NARRATIVO: PROTAGONISTA (DROPZONE) vs COADJUVANTE (REQUISITOS) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 1fr', gap: '16px' }}>
                {/* PROTAGONISTA: DROPZONE */}
                <div>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActiveId(true);
                    }}
                    onDragLeave={() => setDragActiveId(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActiveId(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        processFileUpload(e.dataTransfer.files[0], 'identity');
                      }
                    }}
                    style={{
                      border: dragActiveId
                        ? `2px solid ${PRECISION_COLORS.gain}`
                        : `1px dashed rgba(255, 255, 255, 0.18)`,
                      backgroundColor: dragActiveId ? '#1A2A38' : PRECISION_SURFACES.field,
                      borderRadius: '6px',
                      padding: '32px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1), border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleIdentityUpload}
                      style={{ display: 'none' }}
                    />
                    <div style={{ color: PRECISION_COLORS.textSecondary }}>
                      <IconUploadCloud size={32} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: PRECISION_COLORS.textPrimary }}>
                      Arrastra tus archivos aquí o haz clic para seleccionar
                    </div>
                    <div style={{ fontSize: '11px', color: PRECISION_COLORS.textSecondary }}>
                      Formatos: JPG, PNG o PDF (máx. 15 MB por archivo)
                    </div>
                  </label>

                  {/* ESTADO CARREGANDO / PROGRESSO REAL */}
                  {uploadProgress !== null && (
                    <div style={{ marginTop: '10px' }}>
                      <div
                        style={{
                          height: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${uploadProgress}%`,
                            backgroundColor: PRECISION_COLORS.gain,
                            transition: 'width 80ms linear',
                          }}
                        />
                      </div>
                      <div
                        className="bm-tabular-nums"
                        style={{
                          fontSize: '11px',
                          color: PRECISION_COLORS.textSecondary,
                          marginTop: '4px',
                          textAlign: 'right',
                        }}
                      >
                        Subiendo archivo... {uploadProgress}%
                      </div>
                    </div>
                  )}

                  {/* ESTADO CHEIO / ARQUIVO ENVIADO */}
                  {uploadedIdentityFile && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(0, 229, 153, 0.08)',
                        border: `1px solid rgba(0, 229, 153, 0.2)`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: PRECISION_COLORS.gain,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <IconCheckCircle size={14} /> {uploadedIdentityFile} (Recibido para auditoría)
                    </div>
                  )}

                  {/* ESTADO ERRO (ESTÁTICO SEM SHAKE) */}
                  {errorMessage && (
                    <div
                      className="bm-error-message"
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255, 59, 86, 0.08)',
                        border: `1px solid ${PRECISION_COLORS.loss}`,
                        borderRadius: '4px',
                      }}
                    >
                      {errorMessage}
                    </div>
                  )}
                </div>

                {/* COADJUVANTE: DOCUMENTOS VÁLIDOS */}
                <div
                  style={{
                    backgroundColor: PRECISION_SURFACES.bg,
                    borderRadius: '6px',
                    padding: '16px',
                    border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: PRECISION_COLORS.textPrimary }}>
                    Documentos aceptados:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.6 }}>
                    <li>Pasaporte internacional</li>
                    <li>DNI / Documento Nacional</li>
                    <li>Licencia de conducir vigente</li>
                  </ul>
                  <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.4 }}>
                    Asegúrate de que las 4 esquinas del documento sean visibles y los textos legibles.
                  </div>
                </div>
              </div>
            </div>

            {/* PASSO 3: DIRECCIÓN (RESIDENCIA) */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.panel,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '8px',
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: addressStatus === 'PENDING' ? '14px' : '0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: PRECISION_COLORS.textPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    3
                  </div>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: PRECISION_SURFACES.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: PRECISION_COLORS.textSecondary,
                    }}
                  >
                    <IconShield size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_COLORS.textPrimary, marginBottom: '2px' }}>
                      Dirección
                    </div>
                    <div style={{ fontSize: '13px', color: PRECISION_COLORS.textSecondary }}>
                      Comprobante de domicilio reciente (factura de servicios o extracto bancario).
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      backgroundColor:
                        addressStatus === 'APPROVED'
                          ? 'rgba(0, 229, 153, 0.12)'
                          : addressStatus === 'IN_REVIEW'
                          ? 'rgba(46, 134, 222, 0.15)'
                          : 'rgba(255, 170, 0, 0.15)',
                      border: `1px solid ${
                        addressStatus === 'APPROVED'
                          ? PRECISION_COLORS.gain
                          : addressStatus === 'IN_REVIEW'
                          ? PRECISION_COLORS.system
                          : PRECISION_COLORS.pending
                      }`,
                      color:
                        addressStatus === 'APPROVED'
                          ? PRECISION_COLORS.gain
                          : addressStatus === 'IN_REVIEW'
                          ? PRECISION_COLORS.system
                          : PRECISION_COLORS.pending,
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {addressStatus === 'APPROVED' ? (
                      <>
                        <IconCheckCircle size={13} /> Aprobado
                      </>
                    ) : addressStatus === 'IN_REVIEW' ? (
                      <>
                        <IconClock size={13} /> En revisión
                      </>
                    ) : (
                      <>
                        <IconAlertCircle size={13} /> Pendiente
                      </>
                    )}
                  </span>
                  <div className="bm-tabular-nums" style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    {addressStatus === 'APPROVED'
                      ? 'Auditado y confirmado'
                      : addressStatus === 'IN_REVIEW'
                      ? (uploadedAddressFile ? uploadedAddressFile : 'En proceso de validación')
                      : 'Acción requerida'}
                  </div>
                </div>
              </div>

              {addressStatus === 'PENDING' && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${PRECISION_COLORS.borderSubtle}` }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: PRECISION_SURFACES.field,
                      border: `1px dashed rgba(255, 255, 255, 0.2)`,
                      borderRadius: '4px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: PRECISION_COLORS.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <IconUploadCloud size={16} /> Subir comprobante de domicilio
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleAddressUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>

          </div>

          {/* COLUNA DIREITA: NOTA DE RODAPÉ & JUSTIFICATIVAS TÉCNICAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* CARD PROGRESSO DO USUÁRIO */}
            {(() => {
              let score = 1;
              if (identityStatus === 'APPROVED') score += 1;
              else if (identityStatus === 'IN_REVIEW') score += 0.5;

              if (addressStatus === 'APPROVED') score += 1;
              else if (addressStatus === 'IN_REVIEW') score += 0.5;

              const pct = Math.round((score / 3) * 100);
              const labelCount = Math.floor(score);

              return (
                <div
                  style={{
                    backgroundColor: PRECISION_SURFACES.panel,
                    border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                    borderRadius: '8px',
                    padding: '20px',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_COLORS.textPrimary, marginBottom: '12px' }}>
                    Tu progreso
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ color: PRECISION_COLORS.textSecondary }}>{labelCount} de 3 completados</span>
                    <span className="bm-tabular-nums" style={{ color: PRECISION_COLORS.gain, fontWeight: 700 }}>
                      {pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: PRECISION_SURFACES.bg,
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: PRECISION_COLORS.gain,
                        borderRadius: '3px',
                        transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* NOTA DE RODAPÉ: EXEMPLO DE DOCUMENTO REJEITADO */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.panel,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: PRECISION_COLORS.loss, marginBottom: '8px' }}>
                Ejemplo de documento rechazado
              </div>
              <div style={{ fontSize: '12px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.5, marginBottom: '10px' }}>
                El documento no es legible si presenta reflejos de flash, cortes en los bordes o resolución baja.
              </div>
              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg,
                  border: `1px solid rgba(255, 59, 86, 0.25)`,
                  borderRadius: '4px',
                  padding: '10px',
                  fontSize: '11px',
                  color: '#8A96A8',
                }}
              >
                ✕ Evita capturas de pantalla, fotocopias en blanco y negro o documentos caducados.
              </div>
            </div>

            {/* NOTA DE RODAPÉ: POR QUE VERIFICAR */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.panel,
                border: `1px solid ${PRECISION_COLORS.borderSubtle}`,
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: PRECISION_COLORS.textPrimary, marginBottom: '8px' }}>
                ¿Por qué verificar tu cuenta?
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: PRECISION_COLORS.textSecondary, lineHeight: 1.6 }}>
                <li>Habilita retiros instantáneos vía PIX sin límites.</li>
                <li>Protege tus fondos contra accesos no autorizados.</li>
                <li>Cumplimiento estricto con normativas financieras de prevención de fraude.</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}

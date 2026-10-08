import React, { useState, useEffect, useRef } from 'react';
import {
  calculateExpirySlots,
  type ExpirySlot,
} from './expiry-calculator';

export interface ExpiryDropdownProps {
  selectedSlotId: string;
  onSelectSlot: (slot: ExpirySlot) => void;
  timeZoneOffsetHours?: number;
}

export function ExpiryDropdown({
  selectedSlotId,
  onSelectSlot,
  timeZoneOffsetHours = -3,
}: ExpiryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [slots, setSlots] = useState<ExpirySlot[]>(() =>
    calculateExpirySlots(new Date(), timeZoneOffsetHours)
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Atualização em tempo real dos contadores a cada 500ms
  useEffect(() => {
    const timer = setInterval(() => {
      setSlots(calculateExpirySlots(new Date(), timeZoneOffsetHours));
    }, 500);
    return () => clearInterval(timer);
  }, [timeZoneOffsetHours]);

  // Fechar dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeSlot = slots.find((s) => s.id === selectedSlotId) ?? slots[0];

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      {/* Gatilho Clicável da Boleta (Card de Tempo) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#101a2f',
          border: '1px solid ' + (isOpen ? '#00e676' : '#1f2e4b'),
          borderRadius: '10px',
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
        title="Clique para selecionar o tempo de expiração"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#8898b8', fontWeight: 600 }}>
            TEMPO DE EXPIRAÇÃO 🕒
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#00e676',
              background: 'rgba(0, 230, 118, 0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {activeSlot.label}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <strong style={{ fontSize: '20px', fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>
              {activeSlot.targetTimeFormatted}
            </strong>
            <small style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>
              {activeSlot.remainingFormatted}
            </small>
          </div>
          <span style={{ color: '#8898b8', fontSize: '12px' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Menu Dropdown de Opções */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '105%',
            left: 0,
            right: 0,
            background: '#141c2c',
            border: '1px solid #2a3d5e',
            borderRadius: '10px',
            padding: '10px 0',
            boxShadow: '0 12px 35px rgba(0,0,0,0.85)',
            zIndex: 50,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              padding: '4px 16px 8px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#6e82a3',
              borderBottom: '1px solid #1f2e4b',
              marginBottom: '6px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Escolha a Expiração</span>
            <span>Tipo</span>
          </div>

          {slots.map((slot) => {
            const isSelected = slot.id === activeSlot.id;
            return (
              <div
                key={slot.id}
                onClick={() => {
                  onSelectSlot(slot);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                  borderLeft: isSelected ? '3px solid #00e676' : '3px solid transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', color: isSelected ? '#00e676' : '#8898b8' }}>
                    🕒
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                        {slot.targetTimeFormatted}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                        {slot.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: isSelected ? '#00e676' : '#7b8da7' }}>
                      {slot.remainingFormatted}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: slot.category === 'TURBO' ? 'rgba(255, 183, 77, 0.15)' : '#1f2e4b',
                    color: slot.category === 'TURBO' ? '#ffb74d' : '#a0b3d1',
                  }}
                >
                  {slot.category === 'TURBO' ? 'Tempo Fixo' : 'Fim de Vela'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

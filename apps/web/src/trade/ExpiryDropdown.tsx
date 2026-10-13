import React, { useState, useEffect, useRef } from 'react';
import {
  calculateExpirySlots,
  type ExpirySlot,
} from './expiry-calculator';
import { IconClock, IconChevronDown } from '../components/icons/PrecisionIcons';

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
        data-testid="expiry-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#101622',
          border: `1px solid ${isOpen ? '#22C47A' : '#1C2738'}`,
          borderRadius: '10px',
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          userSelect: 'none',
        }}
        title="Clique para selecionar o tempo de expiração"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: '#8A97A8',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <IconClock size={13} color="#8A97A8" />
            TIEMPO DE EXPIRACIÓN
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#22C47A',
              background: 'rgba(34, 196, 122, 0.12)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeSlot.label}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <strong
              style={{
                fontSize: '20px',
                fontFamily: "'Geist Mono', 'Space Grotesk', monospace, sans-serif",
                color: '#F4F5F7',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {activeSlot.targetTimeFormatted}
            </strong>
            <small
              style={{
                fontSize: '12px',
                color: '#BACAD6',
                fontWeight: 600,
                fontFamily: "'Geist Mono', monospace, sans-serif",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {activeSlot.remainingFormatted}
            </small>
          </div>
          <IconChevronDown
            size={14}
            color="#8A97A8"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Menu Dropdown de Opções */}
      {isOpen && (
        <div
          data-testid="expiry-dropdown-menu"
          style={{
            position: 'absolute',
            bottom: '105%',
            left: 0,
            right: 0,
            background: '#151D2B',
            border: '1px solid #1C2738',
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
              color: '#6E7A8A',
              borderBottom: '1px solid #1C2738',
              marginBottom: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>Elija la Expiración</span>
            <span>Tipo</span>
          </div>

          {slots.map((slot) => {
            const isSelected = slot.id === activeSlot.id;
            return (
              <div
                key={slot.id}
                data-testid={`expiry-slot-${slot.id}`}
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
                  background: isSelected ? 'rgba(34, 196, 122, 0.12)' : 'transparent',
                  borderLeft: isSelected ? '3px solid #22C47A' : '3px solid transparent',
                  transition: 'background 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconClock size={15} color={isSelected ? '#22C47A' : '#8A97A8'} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#F4F5F7',
                          fontFamily: "'Geist Mono', monospace, sans-serif",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {slot.targetTimeFormatted}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#BACAD6' }}>
                        {slot.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: isSelected ? '#22C47A' : '#8A97A8',
                        fontFamily: "'Geist Mono', monospace, sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
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
                    background: slot.category === 'TURBO' ? 'rgba(255, 183, 77, 0.15)' : '#1C2738',
                    color: slot.category === 'TURBO' ? '#FFB74D' : '#BACAD6',
                    letterSpacing: '0.02em',
                  }}
                >
                  {slot.category === 'TURBO' ? 'Turbo Fijo' : 'Fin de Vela'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';

export const ONBOARDING_STORAGE_KEY = 'BINMAX_ONBOARDING_SEEN';

export interface TourStep {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  position: 'ticket-amount' | 'asset-selector' | 'order-direction';
}

export const TOUR_STEPS: TourStep[] = [
  {
    stepNumber: 1,
    totalSteps: 3,
    title: 'Elige cuánto invertir',
    description: 'Empieza con poco en la cuenta de práctica.',
    position: 'ticket-amount',
  },
  {
    stepNumber: 2,
    totalSteps: 3,
    title: 'Selecciona el activo',
    description: 'Explora los activos y su porcentaje de ganancia.',
    position: 'asset-selector',
  },
  {
    stepNumber: 3,
    totalSteps: 3,
    title: 'Pronostica la dirección',
    description: 'Pronostica si el precio subirá o bajará en el tiempo elegido.',
    position: 'order-direction',
  },
];

export interface LeadOnboardingTourProps {
  isOpen?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  initialStep?: number;
}

export const LeadOnboardingTour: React.FC<LeadOnboardingTourProps> = ({
  isOpen: controlledIsOpen,
  onComplete,
  onSkip,
  initialStep = 1,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep - 1);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (controlledIsOpen !== undefined) return controlledIsOpen;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (controlledIsOpen !== undefined) {
      setIsVisible(controlledIsOpen);
    }
  }, [controlledIsOpen]);

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleFinish = (skipped = false) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      }
    } catch {
      // Storage access protected in sandboxed environments
    }
    setIsVisible(false);
    if (skipped) {
      onSkip?.();
    } else {
      onComplete?.();
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      handleFinish(false);
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  // Posicionamento estilizado baseado no passo
  const getPositionStyles = (): React.CSSProperties => {
    switch (step.position) {
      case 'ticket-amount':
        return {
          position: 'fixed',
          right: '165px',
          bottom: '160px',
        };
      case 'asset-selector':
        return {
          position: 'fixed',
          left: '260px',
          top: '68px',
        };
      case 'order-direction':
        return {
          position: 'fixed',
          right: '165px',
          bottom: '75px',
        };
      default:
        return {
          position: 'fixed',
          right: '165px',
          bottom: '160px',
        };
    }
  };

  return (
    <div
      data-testid="onboarding-tour-root"
      style={{
        ...getPositionStyles(),
        zIndex: 2200,
        pointerEvents: 'auto',
        animation: 'fadeInCoachmark 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        data-testid="onboarding-tour-card"
        style={{
          width: '280px',
          background: '#151922',
          border: '1px solid #00e5ff',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75), 0 0 16px rgba(0, 229, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: '#F4F5F7',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Indicador de Passo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            data-testid="onboarding-step-indicator"
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#00e5ff',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {`Paso ${step.stepNumber} de ${step.totalSteps}`}
          </span>
          <button
            type="button"
            data-testid="btn-onboarding-skip"
            onClick={() => handleFinish(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#8A92A1',
              fontSize: '11px',
              cursor: 'pointer',
              padding: '2px 4px',
              transition: 'color 0.15s ease',
            }}
          >
            Saltar
          </button>
        </div>

        {/* Título e Descrição */}
        <div>
          <h4
            data-testid="onboarding-title"
            style={{
              margin: '0 0 4px',
              fontSize: '14px',
              fontWeight: 800,
              color: '#F4F5F7',
              letterSpacing: '-0.2px',
            }}
          >
            {step.title}
          </h4>
          <p
            data-testid="onboarding-body"
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#DCE1EA',
              lineHeight: 1.45,
            }}
          >
            {step.description}
          </p>
        </div>

        {/* Botão de Avanço */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
          <button
            type="button"
            data-testid="btn-onboarding-next"
            onClick={handleNext}
            style={{
              background: 'linear-gradient(135deg, #00e5ff 0%, #00b4d8 100%)',
              border: 'none',
              color: '#0B0E14',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.2px',
              boxShadow: '0 2px 10px rgba(0, 229, 255, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {isLastStep ? 'Entendido' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};

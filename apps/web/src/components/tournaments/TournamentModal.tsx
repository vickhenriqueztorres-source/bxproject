import React, { useState, useEffect } from 'react';
import { TournamentModalProps, TournamentItem } from './TournamentTypes';
import { TOURNAMENTS_LIST_DATA } from './tournaments-mock-data';
import { TournamentListView } from './TournamentListView';
import { TournamentDetailView } from './TournamentDetailView';
import { getJoinedTournamentIds, joinTournamentLocal } from './tournament-enrollment';
import { useRouter } from '../../router/RouterContext';

export function TournamentModal({
  isOpen,
  onClose,
  initialTournamentId = 'copa-binmax',
  initialView = 'list',
  onOpenArena,
  onJoinTournament,
}: TournamentModalProps) {
  const { navigate, currentPath } = useRouter();
  const [currentView, setCurrentView] = useState<'list' | 'details'>(initialView);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId);
  const [joinedIds, setJoinedIds] = useState<string[]>(() => getJoinedTournamentIds());

  // Sincroniza estado inicial ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView);
      if (initialTournamentId) {
        setSelectedTournamentId(initialTournamentId);
      }
      setJoinedIds(getJoinedTournamentIds());
    }
  }, [isOpen, initialView, initialTournamentId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSync = () => setJoinedIds(getJoinedTournamentIds());
    window.addEventListener('binmax:tournaments-updated', handleSync);
    return () => window.removeEventListener('binmax:tournaments-updated', handleSync);
  }, []);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedTournament: TournamentItem =
    TOURNAMENTS_LIST_DATA.find((t) => t.id === selectedTournamentId) || TOURNAMENTS_LIST_DATA[0];

  const handleSelectTournament = (id: string) => {
    setSelectedTournamentId(id);
    setCurrentView('details');
  };

  const handleBackToList = () => {
    setCurrentView('list');
  };

  const handleJoin = (id: string) => {
    const res = joinTournamentLocal(id);
    if (res.success) {
      setJoinedIds(res.joinedIds);
      onJoinTournament?.(id);
    }
  };

  const handleOpenArena = () => {
    onClose();
    if (onOpenArena) {
      onOpenArena();
    } else {
      navigate('/arena');
    }
  };

  const handleStartTrading = () => {
    onClose();
    if (currentPath !== '/' && currentPath !== '/operar') {
      navigate('/operar');
    }
  };

  return (
    <div
      data-testid="tournament-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Backdrop escurecido com desfoque de alta precisão */}
      <div
        data-testid="tournament-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(5, 8, 16, 0.78)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Caixa de Diálogo Principal */}
      <div
        data-testid="tournament-modal-dialog"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: currentView === 'list' ? '1200px' : '1100px',
          maxHeight: '92vh',
          backgroundColor: '#070A0E',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1,
          fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
          color: '#F4F5F7',
          transition: 'max-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {currentView === 'list' ? (
          <TournamentListView
            tournaments={TOURNAMENTS_LIST_DATA}
            onSelectTournament={handleSelectTournament}
            onClose={onClose}
            joinedIds={joinedIds}
            onOpenArena={handleOpenArena}
          />
        ) : (
          <TournamentDetailView
            tournament={selectedTournament}
            onBack={handleBackToList}
            onClose={onClose}
            isJoined={joinedIds.includes(selectedTournament.id)}
            onJoin={handleJoin}
            onStartTrading={handleStartTrading}
            onOpenArena={handleOpenArena}
          />
        )}
      </div>
    </div>
  );
}


# Subetapa 1: Motor de Efeitos Sonoros Web Audio API (Synthesizer Engine)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Segurança:** `security-reviewer`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 1 APROVADO)  

---

## 1. Objetivo da Etapa
Construir um módulo dedicado de síntese de áudio de alta fidelidade em `apps/web/src/lib/sound-engine.ts` utilizando a **Web Audio API**:
- **Som Tátil (UI Click)**: Click sutil de alta frequência ao alternar valores e botões.
- **Som de Disparo de Ordem (Order Open)**: Swoosh harmônico de confirmação com rampa de frequência ascendente.
- **Som de Vitória (WIN Chime)**: Arpeggio comemorativo em Tríade Maior (C5 -> E5 -> G5 -> C6) com reverb simulado e envelope ADSR brilhante.
- **Som de Empate/Derrota (LOSS / DRAW)**: Tom suave e neutro sem ser punitivo.
- **Controle Global de Mute**: Respeito instantâneo ao toggle de som da barra lateral, sem criar nós zumbis no grafo de áudio.

---

## 2. Especificação Arquitetural
```typescript
export interface SoundEngine {
  playClick(): void;
  playOrderOpen(): void;
  playWin(): void;
  playLoss(): void;
  playDraw(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}
```
- Gerenciamento de ciclo de vida seguro:
  - Criação de um único `AudioContext` singleton compartilhado.
  - Desconexão automática dos nós de oscilador e ganho após o término de cada som para prevenir memory leaks.
  - Desbloqueio automático (`resume()`) no primeiro clique do usuário.

---

## 3. Matriz de Testes & Validação da Etapa 1

### A. Teste de Estresse (Disparo Rápido de Sons)
- Disparar 50 efeitos sonoros em menos de 1 segundo:
  - Nenhum crash ou gargalo no thread de áudio.
  - Nós de áudio finalizados e liberados para Garbage Collection.

### B. Teste de Segurança (AudioContext Lifecycle & Bloqueio de Autoplay)
- Inicializar sem clique prévio: o módulo não deve emitir exceções não tratadas no console.
- Respeitar a configuração de mudo (`muted === true`) bloqueando a criação de osciladores.

---

## 4. Critérios de Passagem (Quality Gate 1)
- [ ] Módulo `sound-engine.ts` implementado e exportado com métodos limpos.
- [ ] Sons de click, disparo de ordem e vitória (arpeggio WIN) audíveis e agradáveis.
- [ ] Build do `@indices/web` 100% verde sem erros.
- [ ] Teste unitário e de lifecycle aprovado.

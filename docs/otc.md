otc 

1. Como Funciona a "Vantagem Matemática da Casa" no OTC
                                                                                                                                                                                           
Em opções binárias tradicionais, mesmo que você não faça nenhuma intervenção no gráfico, a matemática já joga a favor da corretora devido ao payout:                                       
                                                                                                                                                                                           
* Payout de 85%:                                                                                                                                                                           
  * Se o usuário perde: A casa ganha 100% do valor apostado.                                                                                                                               
  * Se o usuário ganha: A casa paga 85% de lucro e devolve o valor apostado.                                                                                                               
* Margem da Casa (House Edge): Em um cenário de 50% de acerto aleatório dos traders:                                                                                                       
  $$\text{Expectativa da Casa por Operação} = (0.50 \times 1.00) - (0.50 \times 0.85) = +7.5\%$$                                                                                           

A cada R$ 10.000 movimentados em volume total na plataforma, a casa retém estatisticamente cerca de R$ 750 a R$ 1.500 de lucro operacional líquido.                                        
                                                                                                                                                                                           
O seu único perigo real é a variância de curto prazo (muitas pessoas acertando a mesma vela ao mesmo tempo antes de você ter volume suficiente). É aqui que entra o teto atrelado aos depósitos.                                                                                                                                                                                      

                                                                                                                                                                                           
                                                                                                                                                                                           
2. Arquitetura do Motor de Preço OTC (Tick Engine)                                                                                                                                         
                                                                                                                                                                                           
Todos os usuários conectados precisam ver rigorosamente a mesma cotação no mesmo milissegundo para garantir a consistência dos gráficos no TradingView e das ordens.                       
                                                                                                                                                                                           
O motor sintético roda em um loop no backend e calcula o preço usando Movimento Browniano com Reversão à Média (Ornstein-Uhlenbeck / Mean Reverting Walk) para evitar que o preço suba ou desça em linha reta indefinidamente:                                                                                                                                                        
                                                                                                                                                                                           
                                                                                                                                                                                           
[ Tick Engine OTC ] (Gera preço a cada 200ms / 500ms / 1s)                                                                                                                                 
        │                                                                                                                                                                                  
        ├── 1. Atualiza vela atual (OHLC) em memória                                                                                                                                       
        ├── 2. Publica o Tick no Redis Pub/Sub (market:ticks:EURUSD_OTC)                                                                                                                   
        └── 3. WebSocket Gateway transmite o Tick para todos os clientes conectados                                                                                                        
                                                                                                                                                                                           
                                                                                                                                                                                           
Código do Motor OTC com Reversão à Média:                                                                                                                                                  
                                                                                                                                                                                           
javascript                                                                                                                                                                                 
// otc-price-engine.js                                                                                                                                                                     
class OTCPriceEngine {                                                                                                                                                                     
  constructor(symbol, basePrice, volatility = 0.0001, meanReversionSpeed = 0.05) {                                                                                                         
    this.symbol = symbol;                                                                                                                                                                  
    this.basePrice = basePrice;                                                                                                                                                            
    this.currentPrice = basePrice;                                                                                                                                                         
    this.volatility = volatility;                                                                                                                                                          
    this.meanReversionSpeed = meanReversionSpeed;                                                                                                                                          
  }                                                                                                                                                                                        
                                                                                                                                                                                           
  // Gera o próximo tick                                                                                                                                                                   
  nextTick() {                                                                                                                                                                             
    // Componente aleatório (-1 a +1)                                                                                                                                                      
    const randomShock = (Math.random() - 0.5) * 2;                                                                                                                                         
                                                                                                                                                                                           
    // Força de retorno ao preço base para evitar explosões irreais                                                                                                                        
    const meanReversion = (this.basePrice - this.currentPrice) * this.meanReversionSpeed;

    // Variação do tick                                                                                                                                                                    
    const delta = (this.currentPrice * this.volatility * randomShock) + meanReversion;                                                                                                     
    this.currentPrice = +(this.currentPrice + delta).toFixed(5);
                                                                                                                                                                                           
    return {                                                                                                                                                                               
      symbol: this.symbol,                                                                                                                                                                 
      price: this.currentPrice,
      timestamp: Date.now()                                                                                                                                                                
    };                                                                                                                                                                                     
  }                                                                                                                                                                                        
}                                                                                                                                                                                          
                                                                                                                                                                                           
                                                                                                                                                                                           
                                                                                                                                                                                           
                                                                                                                                                                                           
3. Execução 100% Interna & Validação com Teto de Depósitos                                                                                                                                 
                                                                                                                                                                                           
Como a execução é interna, a ordem de Opção Binária é simplesmente um registro de contrato entre o usuário e o saldo da plataforma.                                                        

Fluxo de Execução da Ordem (Tempo de resposta < 5ms):                                                                                                                                      
                                                                                                                                                                                           
1. Chegada da Ordem: Usuário clica em CALL R$ 10 para expiração em 14:05:00.                                                                                                               
2. Preço de Entrada: O backend atribui instantaneamente o currentPrice do motor OTC local.
3. Checagem do Teto de Depósito:                                                                                                                                                           
   * O sistema verifica o saldo acumulado de depósitos na chave Redis broker:deposit_float.                                                                                                
   * Calcula o Risco Máximo Permitido para essa vela (ex: 3% do Float de Depósito).                                                                                                        
   * Se a nova aposta ultrapassar esse limite na direção escolhida, o sistema responde com rejeição.                                                                                       
4. Agendamento no Redis:                                                                                                                                                                   
   * A ordem é salva no Redis Sorted Set (contracts:pending) com score igual ao timestamp de expiração (14:05:00).                                                                         
5. Liquidação Automática:                                                                                                                                                                  
   * Quando o relógio atinge 14:05:00, o worker pega o preço exato do OTC naquele segundo, compara com o preço de entrada e faz o acerto de saldo.                                         
                                                                                                                                                                                           
                                                                                                                                                                                           
                                                                                                                                                                                           
4. Diagrama de Estados do Contrato no Backend                                                                                                                                              

                                                                                                                                                                                           
[ Usuário Clica: CALL / PUT ]                                                                                                                                                              
               │                                                                                                                                                                           
               ▼                                                                                                                                                                           
   [ Validador de Risco (Float) ]                                                                                                                                                          
         │               │                                                                                                                                                                 
  (Risco > 3% Float)   (Risco <= 3% Float)                                                                                                                                                 
         │               │                                                                                                                                                                 
         ▼               ▼
   [ REJEITADA ]    [ APROVADA: Status ACTIVE ]                                                                                                                                            
                         │                                                                                                                                                                 
                         ▼                                                                                                                                                                 
             [ Salva no Redis Sorted Set ]                                                                                                                                                 
                         │                                                                                                                                                                 
               (Aguardando Expiração)                                                                                                                                                      
                         │                                                                                                                                                                 
                         ▼                                                                                                                                                                 
        [ Relógio bate o segundo :00 da Vela ]                                                                                                                                             
                         │                                                                                                                                                                 
                         ▼                                                                                                                                                                 
             [ Compara Preço de Entrada vs Saída ]                                                                                                                                         
               ├── CALL e Preço Saída > Entrada ──> WIN (Credita +85%)                                                                                                                     
               ├── PUT e Preço Saída < Entrada  ──> WIN (Credita +85%)                                                                                                                     
               ├── Preço Saída == Entrada       ──> DRAW (Devolve 100%)                                                                                                                    
               └── Caso Contrário               ──> LOSS (Retém 100%)                                                                                                                      
                                                                                                                                                                                           
                                                                                                                                                                                           
                                                                                                                                                                                           
                                                                                                                                                                                           
5. Configurações Práticas Recomendadas para Inicialização                                                                                                                                  
                                                                                                                                                                                           
Para operar com segurança máxima no modelo OTC interno desde o primeiro dia:                                                                                                               
                                                                                                                                                                                           
| Parâmetro                     | Valor Sugerido                  | Objetivo                                                                                          |
|-------------------------------|---------------------------------|---------------------------------------------------------------------------------------------------|                    
| Float de Risco por Vela       | 2.5% a 3.0% do Total Depositado | Garante que mesmo no pior caso possível a plataforma não perca mais que 3% do caixa em um minuto. |
| Aposta Mínima                 | R$ 2,00                         | Estimula volume sem concentrar risco em poucas pessoas.                                           |                    
| Aposta Máxima por Contrato    | R$ 25,00 (inicial)              | Evita que um usuário com sorte dê um desfalque desproporcional no início da plataforma.           |                    
| Intervalo de Geração de Ticks | 250ms a 500ms                   | Dá uma movimentação fluida e natural no gráfico do TradingView sem sobrecarregar o Redis.         |                    
| Trava de Tempo de Compra      | 30 segundos antes do fim        | Impede que o usuário abra uma ordem faltando 2 segundos para o fechamento da vela.                |                    
                                                                                                                                                                                           
Com essa estrutura, seu sistema opera de forma totalmente independente de APIs externas de cotação pagas, mantém a latência de execução virtualmente instantânea (sem rotas externas) e preserva o caixa financeiro do projeto.                                      
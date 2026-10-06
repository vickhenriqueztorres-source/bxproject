import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContracts } from '../api/client';
import { formatMinor } from '../lib/money';

export function History() {
  const [filter, setFilter] = useState('');
  const { data = [], isPending } = useQuery({ queryKey: ['contracts', filter],
    queryFn: () => getContracts(filter), refetchInterval: 5000 });
  return <section className="panel history" aria-label="Histórico de contratos">
    <div className="history-heading"><div><span className="eyebrow">ATIVIDADE</span>
      <h2>Histórico</h2></div>
      <label>Resultado <select value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="">Todos</option><option value="WIN">WIN</option>
        <option value="LOSS">LOSS</option><option value="DRAW">DRAW</option>
      </select></label></div>
    <div className="table-wrap"><table><thead><tr><th>Horário</th><th>Direção</th>
      <th>Valor</th><th>Resultado</th></tr></thead><tbody>
      {data.map((contract) => <tr key={contract.id}>
        <td>{new Date(contract.created_at).toLocaleString('pt-BR')}</td>
        <td><span className={contract.direction === 'UP' ? 'up-text' : 'down-text'}>
          {contract.direction === 'UP' ? '↑ Alta' : '↓ Baixa'}</span></td>
        <td>{formatMinor(contract.stake_minor)}</td>
        <td><span className={`result result-${(contract.result ?? contract.status).toLowerCase()}`}>
          {contract.result ?? contract.status}</span></td>
      </tr>)}
      {!isPending && data.length === 0 && <tr><td colSpan={4} className="empty-row">
        Nenhum contrato neste filtro.</td></tr>}
      </tbody></table></div>
    {isPending && <p className="helper">Carregando histórico…</p>}
  </section>;
}

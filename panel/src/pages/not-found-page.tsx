import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'wouter';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <FileQuestion aria-hidden="true" />
      <h1>Página não encontrada</h1>
      <p>Este endereço não corresponde a uma área do painel.</p>
      <Link className="button button--secondary" href="/"><ArrowLeft aria-hidden="true" />Voltar à visão geral</Link>
    </div>
  );
}

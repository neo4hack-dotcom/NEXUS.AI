import React, { useState } from 'react';
import { X, Sparkles, Loader2, Copy, Check, FileDown } from 'lucide-react';
import { AppState } from '../types';
import { Button } from './ui/Button';
import {
  DEFAULT_PROMPTS,
  buildPortfolioSummaryData,
  fillTemplate,
  runPrompt,
} from '../services/llmService';
import { exportPDF } from '../services/exports';

interface Props {
  open: boolean;
  onClose: () => void;
  state: AppState;
}

export const AiInsightModal: React.FC<Props> = ({ open, onClose, state }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const data = buildPortfolioSummaryData(state);
      const tpl = state.prompts['portfolio_summary'] || DEFAULT_PROMPTS.portfolio_summary;
      const prompt = fillTemplate(tpl, { DATA: data });
      const out = await runPrompt(prompt, state.llmConfig);
      setResult(out);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toPDF = () => {
    exportPDF('Executive Portfolio Insight', [
      { heading: 'AI Executive Summary', body: result },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="surface border w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-ink-600">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">AI Executive Insight</h2>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Portfolio-wide synthesis powered by your local LLM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:text-brand transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result && !loading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 border-2 border-brand/40 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-brand" />
              </div>
              <p className="text-sm text-muted max-w-md mx-auto">
                Generate a board-grade executive summary of your AI portfolio:
                highlights, risks, and recommended actions. Uses{' '}
                <span className="text-brand font-bold">
                  {state.llmConfig.provider}
                </span>{' '}
                · model{' '}
                <span className="text-brand font-mono">{state.llmConfig.model}</span>.
              </p>
              <Button className="mt-6" size="lg" onClick={generate}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insight
              </Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand" />
              <p className="text-xs uppercase tracking-[0.18em] text-muted">
                Analyzing portfolio…
              </p>
            </div>
          )}

          {error && (
            <div className="border border-red-500/40 bg-red-500/5 text-red-500 p-4 text-sm">
              <p className="font-bold uppercase text-xs tracking-[0.14em] mb-1">Error</p>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed surface-flat border p-5">
              {result}
            </pre>
          )}
        </div>

        {result && (
          <div className="border-t border-neutral-200 dark:border-ink-600 p-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="md" onClick={generate}>
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <Button variant="outline" size="md" onClick={copy}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="md" onClick={toPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

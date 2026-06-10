/**
 * projectAnalytics — helpers for project telemetry (#17) and ROI models (#18).
 *
 *  - evalRoi: safely evaluates a parametric arithmetic formula over named inputs.
 *  - fetchTelemetry: pulls a numeric metric from a declared HTTP API endpoint.
 */

import { RoiModel, TelemetryMetric } from '../types';

/**
 * Evaluate a ROI formula. Input keys are substituted by their numeric values,
 * then the expression is validated to contain ONLY arithmetic tokens before
 * evaluation — so no identifiers/calls can survive and run.
 * Returns null if the formula is empty or invalid.
 */
export const evalRoi = (model: RoiModel | undefined): number | null => {
  if (!model || !model.formula?.trim()) return null;
  let expr = model.formula;
  // Substitute longest keys first so "rate" doesn't clobber "hourlyRate".
  const inputs = [...(model.inputs || [])].sort((a, b) => b.key.length - a.key.length);
  for (const inp of inputs) {
    if (!inp.key) continue;
    const safeKey = inp.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expr = expr.replace(new RegExp(`\\b${safeKey}\\b`, 'g'), `(${Number(inp.value) || 0})`);
  }
  // After substitution only numbers + operators may remain.
  if (!/^[0-9+\-*/().%\s]*$/.test(expr)) return null;
  if (!expr.trim()) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

/** Walk a dot/bracket path (e.g. "data.items.0.count") into a parsed JSON value. */
const walkPath = (obj: any, path: string): any => {
  if (!path) return obj;
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
};

/**
 * Fetch a metric value from its declared API endpoint and extract the number
 * at jsonPath. Returns {value} on success or {error} describing the failure.
 * (Subject to the browser CORS policy of the target endpoint.)
 */
export const fetchTelemetry = async (metric: TelemetryMetric): Promise<{ value?: number; error?: string }> => {
  if (metric.source !== 'api' || !metric.apiUrl) return { error: 'No API URL configured.' };
  try {
    let headers: Record<string, string> = {};
    if (metric.apiHeaders?.trim()) {
      try { headers = JSON.parse(metric.apiHeaders); } catch { return { error: 'Headers are not valid JSON.' }; }
    }
    const res = await fetch(metric.apiUrl, {
      method: metric.apiMethod || 'GET',
      headers,
      body: metric.apiMethod === 'POST' ? (metric.apiBody || undefined) : undefined,
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const ct = res.headers.get('content-type') || '';
    const raw = ct.includes('application/json') ? await res.json() : await res.text();
    const picked = metric.jsonPath ? walkPath(typeof raw === 'string' ? JSON.parse(raw) : raw, metric.jsonPath) : raw;
    const num = typeof picked === 'number' ? picked : parseFloat(String(picked));
    if (isNaN(num)) return { error: 'Extracted value is not a number.' };
    return { value: num };
  } catch (e: any) {
    return { error: e?.message || 'Request failed (network/CORS).' };
  }
};

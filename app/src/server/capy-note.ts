// Capy's note: one friendly sentence explaining a Plan B, written by the
// configured OpenAI model (gpt-6-luna by default). The OpenAI instrumentation
// traces every call with the GenAI semantic conventions, so Dash0 shows the
// model, tokens and latency. A template answers when the model is slow or off.
import OpenAI from 'openai';
import { config } from './config';
import { log } from './log';
import { llmNoteDuration } from './metrics';
import type { PlanBCandidate } from '../shared/live-types';
import type { Talk } from '../shared/api-types';

const client = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 4_000, maxRetries: 0 }) : null;
const cache = new Map<string, string>();

export function templateNote(from: Talk, c: PlanBCandidate): string {
  const when = c.startsInMinutes > 0 ? `starts in ${c.startsInMinutes} min` : c.startsInMinutes === 0 ? 'starts now' : `started ${-c.startsInMinutes} min ago`;
  return `${c.roomName} has ${c.seatsOpen} seats for "${c.talk.title}". It ${when} and it's a ${Math.round(c.walkMinutes)}-minute walk.`;
}

export async function capyNote(from: Talk, c: PlanBCandidate): Promise<string> {
  const key = `${from.id}->${c.talk.id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (!client) return templateNote(from, c);
  const started = performance.now();
  try {
    const res = await client.chat.completions.create({
      model: config.openai.model,
      reasoning_effort: 'none',
      max_completion_tokens: 90,
      messages: [
        {
          role: 'system',
          content:
            'You are Capy, a calm, kind capybara who helps people at a tech conference. Explain in ONE sentence under 32 words why the suggested talk is a good Plan B for someone who missed the full one. Mention the shared topic concretely. No emoji, no greeting.',
        },
        {
          role: 'user',
          content: `Full talk: ${from.title}\n${from.abstract}\n\nSuggested: ${c.talk.title} in ${c.roomName}. ${c.talk.abstract}\nIt ${c.startsInMinutes >= 0 ? `starts in ${c.startsInMinutes} minutes` : `started ${-c.startsInMinutes} minutes ago`}, a ${Math.round(c.walkMinutes)}-minute walk, ${c.seatsOpen} seats open.`,
        },
      ],
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    const text = res.choices[0]?.message?.content?.trim();
    llmNoteDuration.record(performance.now() - started, { model: config.openai.model, outcome: 'ok' });
    if (!text) return templateNote(from, c);
    if (cache.size > 300) cache.clear();
    cache.set(key, text);
    return text;
  } catch (err) {
    llmNoteDuration.record(performance.now() - started, { model: config.openai.model, outcome: 'fallback' });
    log.warn({ err: (err as Error).message }, "Capy's note fell back to the template");
    return templateNote(from, c);
  }
}

import { config } from '../config.js';
import { stubExtractor } from './stub.js';

const extractors = { stub: stubExtractor };

export function getExtractor() {
  const extractor = extractors[config.extractor];
  if (!extractor) throw new Error(`Extrator desconhecido: ${config.extractor}`);
  return extractor;
}

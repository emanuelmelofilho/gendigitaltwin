import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';
import { PermanentError } from './errors.js';

// Endereços internos, de loopback e reservados: o backend nunca deve acessá-los a pedido de um usuário.
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
]) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) {
  blocked.addSubnet(addr, prefix, 'ipv6');
}

function isBlocked(address) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  return blocked.check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4');
}

async function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new PermanentError('Apenas links http e https são aceitos');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isBlocked)) {
    throw new PermanentError('Este endereço não é público e não pode ser consultado');
  }
}

async function readLimited(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}

/**
 * GET com verificação de endereço a cada redirecionamento, tempo limite e tamanho máximo.
 * Observação: a resolução de DNS é verificada antes da conexão; para produção, usar um
 * proxy de saída ou fixar o IP resolvido evita ataques de DNS rebinding.
 */
export async function safeFetch(input, { maxBytes = 2_000_000, timeoutMs = 10_000, accept = 'text/html,text/plain;q=0.9,*/*;q=0.5' } = {}) {
  let url = new URL(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': config.userAgent, Accept: accept },
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) throw new PermanentError('Redirecionamento sem destino');
      url = new URL(location, url);
      continue;
    }
    const body = res.body ? await readLimited(res, maxBytes) : '';
    return { url, status: res.status, contentType: res.headers.get('content-type') ?? '', body };
  }
  throw new PermanentError('Redirecionamentos demais');
}

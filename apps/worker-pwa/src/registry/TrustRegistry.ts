// Simple trust registry that can be extended; stores trusted issuer DIDs
const TRUST_KEY = 'trust.registry.issuers';

export class TrustRegistry {
  static list(): string[] {
    try { return JSON.parse(localStorage.getItem(TRUST_KEY) || '[]'); } catch { return []; }
  }

  static add(did: string) {
    const list = this.list();
    if (!list.includes(did)) {
      list.push(did);
      try { localStorage.setItem(TRUST_KEY, JSON.stringify(list)); } catch {}
    }
  }

  static remove(did: string) {
    const list = this.list().filter(x => x !== did);
    try { localStorage.setItem(TRUST_KEY, JSON.stringify(list)); } catch {}
  }

  static isTrusted(did: string): boolean {
    return this.list().includes(did);
  }
}

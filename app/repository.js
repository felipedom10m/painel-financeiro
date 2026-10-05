import { createDefaultState } from './default-state.js';

const LOCAL_KEY = 'painel_financeiro_v2';
const SNAPSHOT_ID = 2760000000000;
const SNAPSHOT_BOX = 'painel_v2';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export class FinanceRepository {
  constructor(client = window.financeSupabase) { this.client = client; this.lastWarning = ''; }

  loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  saveLocal(state) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }

  async load() {
    const local = this.loadLocal();
    if (!navigator.onLine || !this.client) return local || createDefaultState();

    const { data, error } = await this.client.from('movimentacoes').select('descricao').eq('id', SNAPSHOT_ID).maybeSingle();
    if (error) {
      this.lastWarning = 'A nuvem não respondeu. O painel está funcionando e salvando neste aparelho.';
      return local || createDefaultState();
    }

    if (data?.descricao) {
      const remote = JSON.parse(data.descricao);
      if (!remote.settings?.legacyPurged) {
        const migrated = await this.save(remote, { purgeLegacy: true });
        return migrated.state;
      }
      this.saveLocal(remote);
      return remote;
    }

    const initial = local || createDefaultState();
    await this.save(initial, { purgeLegacy: true });
    return initial;
  }

  async save(inputState, options = {}) {
    const state = clone(inputState);
    state.settings.updatedAt = new Date().toISOString();
    this.saveLocal(state);

    if (!navigator.onLine || !this.client) return { state, synced: false };
    const row = {
      id: SNAPSHOT_ID, caixa: SNAPSHOT_BOX, timestamp: Date.now(),
      descricao: JSON.stringify(state), icone: '📊', valor: 0,
      comprovante_url: null, comprovante_nome: null
    };
    const { error } = await this.client.from('movimentacoes').upsert(row, { onConflict: 'id' });
    if (error) {
      this.lastWarning = 'Os dados ficaram salvos no aparelho, mas a nuvem não confirmou a alteração.';
      return { state, synced: false, cloudError: error.message };
    }

    if (options.purgeLegacy && !state.settings.legacyPurged) {
      await this.purgeLegacy();
      state.settings.legacyPurged = true;
      this.saveLocal(state);
      row.descricao = JSON.stringify(state);
      await this.client.from('movimentacoes').upsert(row, { onConflict: 'id' });
    }
    this.lastWarning = '';
    return { state, synced: true };
  }

  async purgeLegacy() {
    const { error } = await this.client.from('movimentacoes').delete().in('caixa', ['pessoal', 'marketing']);
    if (error) throw new Error('A nova versão foi salva, mas os registros antigos ainda não puderam ser removidos.');

    const { data: files, error: listError } = await this.client.storage.from('comprovantes').list('', { limit: 1000 });
    if (!listError && files?.length) {
      const legacyNames = files.map(file => file.name).filter(name => !name.startsWith('v2/'));
      if (legacyNames.length) await this.client.storage.from('comprovantes').remove(legacyNames);
    }
    localStorage.removeItem('painel_financeiro_cache_v1');
  }

  async uploadReceipt(file, recordId) {
    if (!file || !this.client || !navigator.onLine) return '';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `v2/${recordId}_${safeName}`;
    const { error } = await this.client.storage.from('comprovantes').upload(path, file, { upsert: false });
    if (error) throw new Error('Não foi possível enviar o comprovante.');
    return this.client.storage.from('comprovantes').getPublicUrl(path).data.publicUrl;
  }
}

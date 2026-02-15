// Dados do sistema
let dados = {
    pessoal: {
        saldo: 0,
        historico: []
    },
    marketing: {
        saldo: 0,
        historico: []
    }
};

// Variáveis globais para o modal
let caixaAtual = '';
let tipoAtual = '';
let sincronizacaoEmAndamento = false;
let deferredInstallPrompt = null;
let contextoExclusao = null;

const CACHE_KEY_DADOS = 'painel_financeiro_cache_v1';
const PWA_INSTALL_STATE_KEY = 'painel_financeiro_app_instalado_v1';

// Inicialização principal
document.addEventListener('DOMContentLoaded', async function() {
    configurarInstalacaoPWA();
    configurarEventosDeConexao();
    carregarCacheLocal();
    atualizarInterface();
    await sincronizarDadosComServidor();
    atualizarBannerOffline();
});

// Salvar dados no Supabase (não usado mais - agora salvamos direto ao adicionar)
function salvarDados() {
    // Função mantida por compatibilidade, mas não é mais usada
    // Os dados são salvos direto no Supabase quando adicionados
}

// Sincronizar dados com o servidor quando o app volta ao foco/conexão
async function sincronizarDadosComServidor(opcoes = {}) {
    const { silencioso = false } = opcoes;

    if (sincronizacaoEmAndamento || !navigator.onLine) {
        return false;
    }

    sincronizacaoEmAndamento = true;

    try {
        const sucesso = await carregarDados({ silencioso });

        if (sucesso) {
            atualizarInterface();
        }

        return sucesso;
    } finally {
        sincronizacaoEmAndamento = false;
    }
}

// Carregar dados do Supabase
async function carregarDados(opcoes = {}) {
    const { silencioso = false } = opcoes;

    try {
        // Buscar todas as movimentações do banco
        const { data: movimentacoes, error } = await supabase
            .from('movimentacoes')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Erro ao carregar dados:', error);
            if (!silencioso) {
                mostrarNotificacao('Erro ao carregar dados do servidor', 'erro');
            }
            return false;
        }

        // Organizar os dados por caixa
        dados.pessoal.historico = movimentacoes.filter(m => m.caixa === 'pessoal');
        dados.marketing.historico = movimentacoes.filter(m => m.caixa === 'marketing');

        // Recalcular os saldos
        dados.pessoal.saldo = dados.pessoal.historico.reduce((total, item) => total + item.valor, 0);
        dados.marketing.saldo = dados.marketing.historico.reduce((total, item) => total + item.valor, 0);
        salvarCacheLocal();
        return true;

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        if (!silencioso) {
            mostrarNotificacao('Erro ao conectar com o servidor', 'erro');
        }
        return false;
    }
}

function salvarCacheLocal() {
    try {
        const payload = {
            pessoal: dados.pessoal,
            marketing: dados.marketing,
            atualizadoEm: Date.now()
        };

        localStorage.setItem(CACHE_KEY_DADOS, JSON.stringify(payload));
    } catch (error) {
        console.warn('Não foi possível salvar cache local:', error);
    }
}

function carregarCacheLocal() {
    try {
        const rawCache = localStorage.getItem(CACHE_KEY_DADOS);

        if (!rawCache) {
            return false;
        }

        const cache = JSON.parse(rawCache);

        if (!cache || !cache.pessoal || !cache.marketing) {
            return false;
        }

        dados.pessoal = cache.pessoal;
        dados.marketing = cache.marketing;
        return true;
    } catch (error) {
        console.warn('Não foi possível carregar cache local:', error);
        return false;
    }
}

// Atualizar toda a interface
function atualizarInterface() {
    atualizarSaldo('pessoal');
    atualizarSaldo('marketing');
    atualizarHistorico('pessoal');
    atualizarHistorico('marketing');
}

// Atualizar saldo na tela
function atualizarSaldo(caixa) {
    const elemento = document.getElementById(`saldo-${caixa}`);
    const saldo = dados[caixa].saldo;
    elemento.textContent = formatarMoeda(saldo);

    // Adicionar efeito de animação
    elemento.classList.add('atualizado');
    setTimeout(() => elemento.classList.remove('atualizado'), 500);
}

// Formatar valor em moeda brasileira
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Formatar data e hora
function formatarDataHora(timestamp) {
    const data = new Date(timestamp);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${hora}:${minuto}`;
}

function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || document.referrer.startsWith('android-app://');
}

function isIOSDevice() {
    const iOSByUA = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iOSByUA || iPadDesktopMode;
}

function isMobileDevice() {
    const mobileByUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return mobileByUA || iPadDesktopMode;
}

function salvarEstadoAppInstalado() {
    try {
        localStorage.setItem(PWA_INSTALL_STATE_KEY, '1');
    } catch (error) {
        console.warn('Não foi possível salvar estado de instalação do app:', error);
    }
}

function limparEstadoAppInstalado() {
    try {
        localStorage.removeItem(PWA_INSTALL_STATE_KEY);
    } catch (error) {
        console.warn('Não foi possível limpar estado de instalação do app:', error);
    }
}

function appJaFoiMarcadoComoInstalado() {
    try {
        return localStorage.getItem(PWA_INSTALL_STATE_KEY) === '1';
    } catch (error) {
        console.warn('Não foi possível ler estado de instalação do app:', error);
        return false;
    }
}

function atualizarBannerInstalacao() {
    const installBanner = document.getElementById('install-banner');

    if (!installBanner) {
        return;
    }

    if (isStandaloneMode()) {
        salvarEstadoAppInstalado();
        installBanner.classList.add('hidden');
        return;
    }

    if (appJaFoiMarcadoComoInstalado()) {
        installBanner.classList.add('hidden');
        return;
    }

    const possuiPromptInstalacao = Boolean(deferredInstallPrompt);
    const deveMostrarAjudaIOS = isIOSDevice() && isMobileDevice();
    const deveMostrar = possuiPromptInstalacao || deveMostrarAjudaIOS;

    installBanner.classList.toggle('hidden', !deveMostrar);
}

function atualizarBannerOffline() {
    const offlineBanner = document.getElementById('offline-banner');

    if (!offlineBanner) {
        return;
    }

    offlineBanner.classList.toggle('hidden', navigator.onLine);
}

async function instalarAplicativo() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;

        if (outcome === 'accepted') {
            salvarEstadoAppInstalado();
            mostrarNotificacao('Instalação iniciada com sucesso!', 'sucesso');
        }

        deferredInstallPrompt = null;
        atualizarBannerInstalacao();
        return;
    }

    if (isIOSDevice()) {
        mostrarNotificacao('No iPhone: Compartilhar > Adicionar à Tela de Início.', 'info');
        return;
    }

    mostrarNotificacao('Use o menu do navegador e toque em Instalar aplicativo.', 'info');
}

function configurarInstalacaoPWA() {
    const installButton = document.getElementById('install-app-btn');

    if (!installButton) {
        return;
    }

    installButton.addEventListener('click', instalarAplicativo);

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        limparEstadoAppInstalado();
        deferredInstallPrompt = event;
        atualizarBannerInstalacao();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        salvarEstadoAppInstalado();
        atualizarBannerInstalacao();
        mostrarNotificacao('Aplicativo instalado com sucesso!', 'sucesso');
    });

    const displayModeMedia = window.matchMedia('(display-mode: standalone)');

    if (displayModeMedia.addEventListener) {
        displayModeMedia.addEventListener('change', (event) => {
            if (event.matches) {
                salvarEstadoAppInstalado();
            }
            atualizarBannerInstalacao();
        });
    }

    window.addEventListener('pageshow', atualizarBannerInstalacao);

    atualizarBannerInstalacao();
}

function configurarEventosDeConexao() {
    window.addEventListener('online', async () => {
        atualizarBannerOffline();
        await sincronizarDadosComServidor({ silencioso: true });
    });

    window.addEventListener('offline', () => {
        atualizarBannerOffline();
    });

    window.addEventListener('focus', () => {
        sincronizarDadosComServidor({ silencioso: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sincronizarDadosComServidor({ silencioso: true });
        }
    });
}

// Abrir modal
function abrirModal(caixa, tipo) {
    caixaAtual = caixa;
    tipoAtual = tipo;

    const modal = document.getElementById('modal');
    const titulo = document.getElementById('modal-titulo');
    const descricaoInput = document.getElementById('descricao');

    if (tipo === 'adicionar') {
        titulo.textContent = '➕ Adicionar Valor';
        // Remover obrigatoriedade da descrição ao adicionar
        descricaoInput.removeAttribute('required');
        descricaoInput.placeholder = 'Opcional: Ex: Depósito, Salário...';
    } else {
        titulo.textContent = '➖ Retirar Valor';
        // Manter obrigatoriedade da descrição ao retirar
        descricaoInput.setAttribute('required', 'required');
        descricaoInput.placeholder = 'Ex: Mercado, Facebook Ads...';
    }

    // Limpar formulário
    document.getElementById('form-movimentacao').reset();

    modal.style.display = 'block';
}

// Fechar modal
function fecharModal() {
    document.getElementById('modal').style.display = 'none';
}

// Salvar movimentação
async function salvarMovimentacao(event) {
    event.preventDefault();

    const valor = parseFloat(document.getElementById('valor').value);
    let descricao = document.getElementById('descricao').value.trim();
    const icone = document.getElementById('icone').value;
    const comprovanteInput = document.getElementById('comprovante');

    // Se não tiver descrição e for adicionar, usar descrição padrão
    if (!descricao && tipoAtual === 'adicionar') {
        descricao = '10/01/2025';
    }

    // Processar comprovante se houver
    if (comprovanteInput.files.length > 0) {
        const arquivo = comprovanteInput.files[0];
        await finalizarMovimentacao(valor, descricao, icone, arquivo);
    } else {
        await finalizarMovimentacao(valor, descricao, icone, null);
    }
}

// Finalizar movimentação
async function finalizarMovimentacao(valor, descricao, icone, arquivoComprovante) {
    try {
        const id = Date.now();
        const timestamp = Date.now();
        const valorFinal = tipoAtual === 'adicionar' ? valor : -valor;

        let comprovanteUrl = null;
        let comprovanteNome = null;

        // Upload do comprovante se houver
        if (arquivoComprovante) {
            const nomeArquivo = `${id}_${arquivoComprovante.name}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('comprovantes')
                .upload(nomeArquivo, arquivoComprovante);

            if (uploadError) {
                console.error('Erro ao fazer upload:', uploadError);
                mostrarNotificacao('Erro ao fazer upload do comprovante', 'erro');
                return;
            }

            // Obter URL pública do comprovante
            const { data: urlData } = supabase.storage
                .from('comprovantes')
                .getPublicUrl(nomeArquivo);

            comprovanteUrl = urlData.publicUrl;
            comprovanteNome = arquivoComprovante.name;
        }

        // Salvar movimentação no banco
        const { data: novaMovimentacao, error: insertError } = await supabase
            .from('movimentacoes')
            .insert([{
                id: id,
                caixa: caixaAtual,
                timestamp: timestamp,
                descricao: descricao,
                icone: icone,
                valor: valorFinal,
                comprovante_url: comprovanteUrl,
                comprovante_nome: comprovanteNome
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao salvar no banco:', insertError);
            mostrarNotificacao('Erro ao salvar movimentação', 'erro');
            return;
        }

        // Atualizar dados locais
        dados[caixaAtual].saldo += valorFinal;
        dados[caixaAtual].historico.unshift(novaMovimentacao);
        salvarCacheLocal();

        // Atualizar interface
        atualizarInterface();
        fecharModal();

        // Feedback visual
        mostrarNotificacao(
            tipoAtual === 'adicionar' ? 'Valor adicionado com sucesso!' : 'Valor retirado com sucesso!',
            'sucesso'
        );

    } catch (error) {
        console.error('Erro ao finalizar movimentação:', error);
        mostrarNotificacao('Erro ao salvar movimentação', 'erro');
    }
}

// Atualizar histórico
function atualizarHistorico(caixa) {
    const lista = document.getElementById(`historico-${caixa}`);
    const historico = dados[caixa].historico;

    if (historico.length === 0) {
        lista.innerHTML = '<p class="historico-vazio">Nenhuma movimentação ainda</p>';
        return;
    }

    lista.innerHTML = '';

    historico.forEach(item => {
        const div = document.createElement('div');
        div.className = 'historico-item';

        const valorClass = item.valor >= 0 ? 'positivo' : 'negativo';
        const valorFormatado = formatarMoeda(Math.abs(item.valor));
        const sinal = item.valor >= 0 ? '+' : '-';

        div.innerHTML = `
            <div class="historico-item-header">
                <div class="historico-descricao">
                    <span class="historico-icone">${item.icone}</span>
                    ${item.descricao}
                </div>
                <div class="historico-valor ${valorClass}">
                    ${sinal}${valorFormatado}
                </div>
            </div>
            <div class="historico-data">
                ${formatarDataHora(item.timestamp)}
            </div>
            <div class="historico-acoes">
                <button class="btn-comprovante" onclick="verComprovante('${caixa}', ${item.id})" ${!item.comprovante_url ? 'disabled' : ''}>
                    📎 ${item.comprovante_url ? 'Ver Comprovante' : 'Sem Comprovante'}
                </button>
                <button class="btn-deletar" onclick="abrirModalExclusao('${caixa}', ${item.id})" title="Deletar">
                    🗑️
                </button>
            </div>
        `;

        lista.appendChild(div);
    });
}

// Ver comprovante
function verComprovante(caixa, id) {
    const item = dados[caixa].historico.find(m => m.id === id);

    if (!item || !item.comprovante_url) {
        mostrarNotificacao('Comprovante não encontrado', 'erro');
        return;
    }

    const modal = document.getElementById('modal-comprovante');
    const display = document.getElementById('comprovante-display');

    // Limpar conteúdo anterior
    display.innerHTML = '';

    // Verificar tipo de arquivo pela extensão
    const nomeArquivo = item.comprovante_nome || '';
    const extensao = nomeArquivo.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extensao)) {
        const img = document.createElement('img');
        img.src = item.comprovante_url;
        img.alt = item.comprovante_nome;
        display.appendChild(img);
    } else if (extensao === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = item.comprovante_url;
        display.appendChild(iframe);
    } else {
        // Para outros tipos, criar link de download
        display.innerHTML = `
            <p>Visualização não disponível para este tipo de arquivo.</p>
            <a href="${item.comprovante_url}" target="_blank" class="btn btn-adicionar">
                📥 Baixar Comprovante
            </a>
        `;
    }

    modal.style.display = 'block';
}

// Fechar modal de comprovante
function fecharModalComprovante() {
    document.getElementById('modal-comprovante').style.display = 'none';
}

function obterItemMovimentacao(caixa, id) {
    return dados[caixa].historico.find(m => m.id === id);
}

function textoCaixa(caixa) {
    if (caixa === 'pessoal') {
        return 'Gastos Pessoais';
    }

    if (caixa === 'marketing') {
        return 'Marketing';
    }

    return '';
}

function abrirModalExclusao(caixa, id) {
    const item = obterItemMovimentacao(caixa, id);

    if (!item) {
        mostrarNotificacao('Movimentação não encontrada', 'erro');
        return;
    }

    contextoExclusao = { caixa, id };

    const descricao = document.getElementById('exclusao-descricao');
    descricao.textContent = `${item.descricao} • ${item.valor >= 0 ? '+' : '-'}${formatarMoeda(Math.abs(item.valor))}`;
    document.getElementById('modal-exclusao').style.display = 'block';
}

function fecharModalExclusao(limparContexto = true) {
    document.getElementById('modal-exclusao').style.display = 'none';
    if (limparContexto) {
        contextoExclusao = null;
    }
}

async function confirmarExclusaoMovimentacao() {
    if (!contextoExclusao) {
        return;
    }

    const { caixa, id } = contextoExclusao;
    fecharModalExclusao();
    await deletarMovimentacao(caixa, id);
}

function abrirModalConfirmacaoLimpeza() {
    if (!contextoExclusao) {
        return;
    }

    const { caixa } = contextoExclusao;
    const descricao = document.getElementById('limpeza-descricao');
    const input = document.getElementById('input-confirmacao-limpeza');
    const botaoConfirmar = document.getElementById('btn-confirmar-limpeza');

    descricao.textContent = `Você vai apagar todo o histórico da caixa ${textoCaixa(caixa)}.`;
    input.value = '';
    botaoConfirmar.disabled = true;

    fecharModalExclusao(false);
    document.getElementById('modal-confirmacao-limpeza').style.display = 'block';
}

function atualizarEstadoBotaoLimpeza() {
    const input = document.getElementById('input-confirmacao-limpeza');
    const botaoConfirmar = document.getElementById('btn-confirmar-limpeza');
    botaoConfirmar.disabled = input.value.trim().toUpperCase() !== 'LIMPAR';
}

function fecharModalConfirmacaoLimpeza() {
    document.getElementById('modal-confirmacao-limpeza').style.display = 'none';
    document.getElementById('input-confirmacao-limpeza').value = '';
    contextoExclusao = null;
}

async function confirmarLimpezaCaixa() {
    if (!contextoExclusao) {
        return;
    }

    const caixa = contextoExclusao.caixa;
    fecharModalConfirmacaoLimpeza();
    await limparHistorico(caixa);
}

function obterItensParaLimpeza(caixa) {
    if (!['pessoal', 'marketing'].includes(caixa)) {
        return [];
    }

    return [...dados[caixa].historico];
}

async function deletarComprovantesEmLote(itens) {
    const nomesArquivos = [...new Set(
        itens
            .filter(item => item.comprovante_url && item.comprovante_nome)
            .map(item => `${item.id}_${item.comprovante_nome}`)
    )];

    if (nomesArquivos.length === 0) {
        return true;
    }

    const { error } = await supabase.storage
        .from('comprovantes')
        .remove(nomesArquivos);

    if (error) {
        console.error('Erro ao deletar comprovantes em lote:', error);
        return false;
    }

    return true;
}

async function deletarMovimentacoesEmLote(caixa) {
    const { error } = await supabase
        .from('movimentacoes')
        .delete()
        .eq('caixa', caixa);

    if (error) {
        console.error('Erro ao deletar movimentações em lote:', error);
    }

    return !error;
}

function limparDadosLocais(caixa) {
    dados[caixa].saldo = 0;
    dados[caixa].historico = [];
}

async function limparHistorico(caixa) {
    if (!['pessoal', 'marketing'].includes(caixa)) {
        mostrarNotificacao('Ação inválida para limpeza.', 'erro');
        return;
    }

    if (!navigator.onLine) {
        mostrarNotificacao('Sem internet: não é possível limpar histórico agora.', 'erro');
        return;
    }

    const itens = obterItensParaLimpeza(caixa);

    if (itens.length === 0) {
        mostrarNotificacao(`Não há registros em ${textoCaixa(caixa)}.`, 'info');
        return;
    }

    try {
        const comprovantesRemovidos = await deletarComprovantesEmLote(itens);

        const sucessoDelete = await deletarMovimentacoesEmLote(caixa);

        if (!sucessoDelete) {
            mostrarNotificacao('Erro ao limpar histórico no servidor.', 'erro');
            return;
        }

        limparDadosLocais(caixa);
        salvarCacheLocal();
        atualizarInterface();
        if (!comprovantesRemovidos) {
            mostrarNotificacao('Histórico limpo, mas alguns comprovantes não puderam ser removidos.', 'info');
            return;
        }
        mostrarNotificacao(`Histórico de ${textoCaixa(caixa)} limpo com sucesso!`, 'sucesso');
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
        mostrarNotificacao('Erro ao limpar histórico.', 'erro');
    }
}

// Deletar movimentação
async function deletarMovimentacao(caixa, id) {
    if (!navigator.onLine) {
        mostrarNotificacao('Sem internet: não é possível excluir agora.', 'erro');
        return;
    }

    try {
        const item = obterItemMovimentacao(caixa, id);

        if (!item) {
            mostrarNotificacao('Movimentação não encontrada', 'erro');
            return;
        }

        // Deletar comprovante do Storage se existir
        if (item.comprovante_url) {
            const nomeArquivo = `${item.id}_${item.comprovante_nome}`;

            const { error: deleteStorageError } = await supabase.storage
                .from('comprovantes')
                .remove([nomeArquivo]);

            if (deleteStorageError) {
                console.error('Erro ao deletar comprovante:', deleteStorageError);
                // Continua mesmo se der erro no storage
            }
        }

        // Deletar movimentação do banco
        const { error: deleteError } = await supabase
            .from('movimentacoes')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Erro ao deletar movimentação:', deleteError);
            mostrarNotificacao('Erro ao deletar movimentação', 'erro');
            return;
        }

        // Reverter o valor do saldo localmente
        dados[caixa].saldo -= item.valor;

        // Remover do histórico local
        const index = dados[caixa].historico.findIndex(m => m.id === id);
        dados[caixa].historico.splice(index, 1);
        salvarCacheLocal();

        // Atualizar interface
        atualizarInterface();

        mostrarNotificacao('Movimentação deletada com sucesso!', 'sucesso');

    } catch (error) {
        console.error('Erro ao deletar movimentação:', error);
        mostrarNotificacao('Erro ao deletar movimentação', 'erro');
    }
}

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo) {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao notificacao-${tipo}`;
    notificacao.textContent = mensagem;
    const corNotificacao = tipo === 'sucesso' ? '#4CAF50' : tipo === 'info' ? '#1E88E5' : '#f44336';

    // Adicionar estilos inline
    notificacao.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${corNotificacao};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notificacao);

    // Remover após 3 segundos
    setTimeout(() => {
        notificacao.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notificacao.remove(), 300);
    }, 3000);
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    const modalComprovante = document.getElementById('modal-comprovante');
    const modalExclusao = document.getElementById('modal-exclusao');
    const modalConfirmacaoLimpeza = document.getElementById('modal-confirmacao-limpeza');

    if (event.target === modal) {
        fecharModal();
    }
    if (event.target === modalComprovante) {
        fecharModalComprovante();
    }
    if (event.target === modalExclusao) {
        fecharModalExclusao();
    }
    if (event.target === modalConfirmacaoLimpeza) {
        fecharModalConfirmacaoLimpeza();
    }
}

// Adicionar animações CSS via JavaScript
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .saldo-valor.atualizado {
        animation: pulse 0.5s ease;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);

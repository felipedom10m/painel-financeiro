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

// Carregar dados do Supabase ao iniciar
document.addEventListener('DOMContentLoaded', async function() {
    await carregarDados();
    atualizarInterface();
});

// Salvar dados no Supabase (não usado mais - agora salvamos direto ao adicionar)
function salvarDados() {
    // Função mantida por compatibilidade, mas não é mais usada
    // Os dados são salvos direto no Supabase quando adicionados
}

// Carregar dados do Supabase
async function carregarDados() {
    try {
        // Buscar todas as movimentações do banco
        const { data: movimentacoes, error } = await supabase
            .from('movimentacoes')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Erro ao carregar dados:', error);
            mostrarNotificacao('Erro ao carregar dados do servidor', 'erro');
            return;
        }

        // Organizar os dados por caixa
        dados.pessoal.historico = movimentacoes.filter(m => m.caixa === 'pessoal');
        dados.marketing.historico = movimentacoes.filter(m => m.caixa === 'marketing');

        // Recalcular os saldos
        dados.pessoal.saldo = dados.pessoal.historico.reduce((total, item) => total + item.valor, 0);
        dados.marketing.saldo = dados.marketing.historico.reduce((total, item) => total + item.valor, 0);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao conectar com o servidor', 'erro');
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
                <button class="btn-deletar" onclick="deletarMovimentacao('${caixa}', ${item.id})" title="Deletar">
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

// Deletar movimentação
async function deletarMovimentacao(caixa, id) {
    if (!confirm('Tem certeza que deseja deletar esta movimentação?')) {
        return;
    }

    try {
        const item = dados[caixa].historico.find(m => m.id === id);

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

    // Adicionar estilos inline
    notificacao.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${tipo === 'sucesso' ? '#4CAF50' : '#f44336'};
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

    if (event.target === modal) {
        fecharModal();
    }
    if (event.target === modalComprovante) {
        fecharModalComprovante();
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

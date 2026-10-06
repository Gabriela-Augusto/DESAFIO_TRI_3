class Produto {
    #preco;
    #quantidade;

    constructor(nome, preco, quantidade, id = null) {
        if (!nome || preco <= 0 || quantidade <= 0) {
            throw new Error('Dados inválidos para o produto.');
        }

        this.id = id;
        this.nome = nome;
        this.#preco = parseFloat(preco);
        this.#quantidade = parseInt(quantidade, 10);
    }

    get preco() { return this.#preco; }
    get quantidade() { return this.#quantidade; }

    valorTotal() {
        return this.#preco * this.#quantidade;
    }

    toJSON() {
        return {
            id: this.id,
            nome: this.nome,
            preco: this.#preco,
            quantidade: this.#quantidade
        };
    }
}

const API_URL = '/produtos';
const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'usuario';

let usuarioAtual = null;

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getHeaders(extra = {}) {
    const headers = {
        ...extra
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function salvarSessao(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    usuarioAtual = usuario;
}

function limparSessao() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    usuarioAtual = null;
}

function carregarUsuarioSalvo() {
    const salvo = localStorage.getItem(USER_KEY);

    if (!salvo) return;

    try {
        usuarioAtual = JSON.parse(salvo);
    } catch {
        limparSessao();
    }
}

function mostrarApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');

    document.getElementById('usuario-logado').textContent =
        `${usuarioAtual.nome} (${usuarioAtual.perfil})`;

    const elementosAdmin = document.querySelectorAll('.admin-only');

    elementosAdmin.forEach((elemento) => {
        elemento.classList.toggle(
            'hidden',
            usuarioAtual.perfil !== 'admin'
        );
    });

    renderizarTabela();
}

function mostrarLogin() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
}

function mostrarMensagem(texto, erro = false) {
    const elemento = document.getElementById('auth-message');
    elemento.textContent = texto;
    elemento.className = erro ? 'message error' : 'message success';
}

async function lerErro(resposta, mensagemPadrao) {
    try {
        const dados = await resposta.json();
        return dados.erro || mensagemPadrao;
    } catch {
        return mensagemPadrao;
    }
}

// =========================
// LOGIN / CADASTRO
// =========================

document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('registro-form').classList.add('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-registro').classList.remove('active');
    mostrarMensagem('');
});

document.getElementById('tab-registro').addEventListener('click', () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('registro-form').classList.remove('hidden');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-registro').classList.add('active');
    mostrarMensagem('');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    try {
        const resposta = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });

        if (!resposta.ok) {
            throw new Error(await lerErro(resposta, 'Não foi possível fazer login.'));
        }

        const dados = await resposta.json();

        salvarSessao(dados.token, dados.usuario);
        mostrarMensagem('Login realizado com sucesso.');
        e.target.reset();
        mostrarApp();
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById('registro-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('registro-nome').value;
    const email = document.getElementById('registro-email').value;
    const senha = document.getElementById('registro-senha').value;

    try {
        const resposta = await fetch('/auth/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, email, senha })
        });

        if (!resposta.ok) {
            throw new Error(await lerErro(resposta, 'Não foi possível cadastrar.'));
        }

        e.target.reset();
        document.getElementById('tab-login').click();
        document.getElementById('login-email').value = email;

        mostrarMensagem(
            'Cadastro realizado! Agora faça login para continuar.'
        );
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

document.getElementById('logout').addEventListener('click', () => {
    limparSessao();
    mostrarLogin();
});

// =========================
// PRODUTOS
// =========================

async function renderizarTabela() {
    try {
        const resposta = await fetch(API_URL);

        if (!resposta.ok) {
            throw new Error(await lerErro(resposta, 'Erro ao buscar produtos.'));
        }

        const dados = await resposta.json();
        const tabela = document.querySelector('#tabela-produtos tbody');
        tabela.innerHTML = '';

        let totalAcumulado = 0;

        dados.forEach((item) => {
            const produto = new Produto(
                item.nome,
                item.preco,
                item.quantidade,
                item.id
            );

            totalAcumulado += produto.valorTotal();

            const row = document.createElement('tr');

            const nome = document.createElement('td');
            nome.textContent = produto.nome;

            const preco = document.createElement('td');
            preco.textContent = `R$ ${produto.preco.toFixed(2)}`;

            const quantidade = document.createElement('td');
            quantidade.textContent = produto.quantidade;

            const total = document.createElement('td');
            total.textContent = `R$ ${produto.valorTotal().toFixed(2)}`;

            const acoes = document.createElement('td');

            if (usuarioAtual) {
                const editar = document.createElement('button');
                editar.textContent = 'Editar';
                editar.className = 'editar-produto';
                editar.addEventListener('click', () => editarProduto(produto));

                acoes.appendChild(editar);
            }

            if (usuarioAtual?.perfil === 'admin') {
                const remover = document.createElement('button');
                remover.textContent = 'Remover';
                remover.className = 'remover-produto';
                remover.addEventListener('click', () => excluirProduto(produto.id));

                acoes.appendChild(remover);
            }

            row.append(nome, preco, quantidade, total, acoes);
            tabela.appendChild(row);
        });

        document.getElementById('total-estoque').textContent =
            `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;
    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
}

document.getElementById('produto-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!getToken()) {
        alert('Faça login para cadastrar produtos.');
        return;
    }

    try {
        const produto = new Produto(
            document.getElementById('nome').value,
            document.getElementById('preco').value,
            document.getElementById('quantidade').value
        );

        const resposta = await fetch(API_URL, {
            method: 'POST',
            headers: getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(produto.toJSON())
        });

        if (!resposta.ok) {
            throw new Error(
                await lerErro(resposta, 'Erro ao salvar produto.')
            );
        }

        e.target.reset();
        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
});

async function editarProduto(produto) {
    const nome = prompt('Novo nome:', produto.nome);
    if (nome === null) return;

    const preco = prompt('Novo preço:', produto.preco);
    if (preco === null) return;

    const quantidade = prompt('Nova quantidade:', produto.quantidade);
    if (quantidade === null) return;

    try {
        const atualizado = new Produto(nome, preco, quantidade, produto.id);

        const resposta = await fetch(`${API_URL}/${produto.id}`, {
            method: 'PUT',
            headers: getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(atualizado.toJSON())
        });

        if (!resposta.ok) {
            throw new Error(
                await lerErro(resposta, 'Erro ao atualizar produto.')
            );
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

async function excluirProduto(id) {
    if (usuarioAtual?.perfil !== 'admin') {
        alert('Apenas administradores podem remover produtos.');
        return;
    }

    if (!confirm('Deseja remover esse produto?')) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!resposta.ok) {
            throw new Error(
                await lerErro(resposta, 'Erro ao remover o produto.')
            );
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

document.getElementById('limpar-tabela').addEventListener('click', async () => {
    if (usuarioAtual?.perfil !== 'admin') {
        alert('Apenas administradores podem limpar a tabela.');
        return;
    }

    if (!confirm('Deseja mesmo limpar toda a tabela?')) return;

    try {
        const resposta = await fetch(API_URL, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!resposta.ok) {
            throw new Error(
                await lerErro(resposta, 'Erro ao limpar a tabela.')
            );
        }

        await renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
});

// GET /produtos continua público.
// A interface, porém, só libera operações de escrita após login.
carregarUsuarioSalvo();

if (getToken() && usuarioAtual) {
    mostrarApp();
} else {
    mostrarLogin();
}

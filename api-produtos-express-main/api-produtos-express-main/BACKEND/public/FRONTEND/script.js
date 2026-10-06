class Produto {
    #id;
    #preco;
    #quantidade;

    constructor(nome, preco, quantidade, id = null) {
        if (!nome || preco <= 0 || quantidade < 0) {
            throw new Error("Dados inválidos para o produto");
        }

        this.#id = id;
        this.nome = nome;
        this.#preco = parseFloat(preco);
        this.#quantidade = parseInt(quantidade, 10);
    }

    get id() { return this.#id; }
    get preco() { return this.#preco; }
    get quantidade() { return this.#quantidade; }

    valorTotal() {
        return this.#preco * this.#quantidade;
    }

    toJSON() {
        return {
            nome: this.nome,
            preco: this.#preco,
            quantidade: this.#quantidade
        };
    }
}

const API_URL = "/api/produtos";
const AUTH_URL = "/api/auth";

// --- GERENCIAMENTO DE SESSÃO / LOCALSTORAGE ---

function obterToken() {
    return localStorage.getItem("token");
}

function obterUsuario() {
    const user = localStorage.getItem("usuario");
    return user ? JSON.parse(user) : null;
}

function atualizarInterfaceAuth() {
    const usuario = obterUsuario();
    const secaoAuth = document.getElementById("secao-auth");
    const secaoUsuario = document.getElementById("secao-usuario");
    const formProduto = document.getElementById("produto-form");
    const btnLimpar = document.getElementById("limpar-tabela");

    if (usuario) {
        secaoAuth.style.display = "none";
        secaoUsuario.style.display = "flex";
        document.getElementById("user-nome").textContent = usuario.nome;
        document.getElementById("user-perfil").textContent = usuario.perfil.toUpperCase();

        if (usuario.perfil === "admin") {
            formProduto.style.opacity = "1";
            formProduto.querySelectorAll("input, button").forEach(i => i.disabled = false);
            btnLimpar.style.display = "inline-block";
        } else {
            formProduto.style.opacity = "0.5";
            formProduto.querySelectorAll("input, button").forEach(i => i.disabled = true);
            btnLimpar.style.display = "none";
        }
    } else {
        secaoAuth.style.display = "block";
        secaoUsuario.style.display = "none";
        formProduto.style.opacity = "0.5";
        formProduto.querySelectorAll("input, button").forEach(i => i.disabled = true);
        btnLimpar.style.display = "none";
    }
}

// --- EVENTOS DE AUTENTICAÇÃO ---

document.getElementById("link-ir-cadastro").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("painel-login").style.display = "none";
    document.getElementById("painel-registro").style.display = "block";
});

document.getElementById("link-ir-login").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("painel-registro").style.display = "none";
    document.getElementById("painel-login").style.display = "block";
});

// Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    try {
        const resposta = await fetch(`${AUTH_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha })
        });

        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || "Falha no login");

        localStorage.setItem("token", dados.token);
        localStorage.setItem("usuario", JSON.stringify(dados.usuario));

        atualizarInterfaceAuth();
        renderizarTabela();
        e.target.reset();
    } catch (erro) {
        alert(erro.message);
    }
});

// Registro
document.getElementById("registro-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("reg-nome").value;
    const email = document.getElementById("reg-email").value;
    const senha = document.getElementById("reg-senha").value;
    const perfil = document.getElementById("reg-perfil").value;

    try {
        const resposta = await fetch(`${AUTH_URL}/registro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, senha, perfil })
        });

        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || "Falha ao registrar");

        alert("Conta criada com sucesso! Faça login para continuar.");
        document.getElementById("link-ir-login").click();
        e.target.reset();
    } catch (erro) {
        alert(erro.message);
    }
});

// Logout
document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    atualizarInterfaceAuth();
    renderizarTabela();
});

// --- OPERAÇÕES DE PRODUTO ---

document.addEventListener("DOMContentLoaded", () => {
    atualizarInterfaceAuth();
    renderizarTabela();
});

// Adicionar Produto (Envio com Bearer Token)
document.getElementById("produto-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const token = obterToken();

    if (!token) {
        alert("Você precisa estar logado como Admin.");
        return;
    }

    const nome = document.getElementById("nome").value;
    const preco = document.getElementById("preco").value;
    const quantidade = document.getElementById("quantidade").value;

    try {
        const novoProduto = new Produto(nome, preco, quantidade);

        const resposta = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(novoProduto)
        });

        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || "Erro ao salvar produto.");

        renderizarTabela();
        e.target.reset();
    } catch (erro) {
        alert(erro.message);
    }
});

// Buscar e Renderizar Tabela (Público)
async function renderizarTabela() {
    try {
        const resposta = await fetch(API_URL);
        if (!resposta.ok) throw new Error("Erro ao carregar lista de produtos.");

        const dadosBrutosDoServidor = await resposta.json();
        const tabela = document.querySelector("#tabela-produtos tbody");
        tabela.innerHTML = "";

        let totalAcumulado = 0;
        const usuario = obterUsuario();

        dadosBrutosDoServidor.forEach((dados) => {
            const produto = new Produto(
                dados.nome,
                dados.preco,
                dados.quantidade,
                dados.id
            );

            totalAcumulado += produto.valorTotal();

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${produto.nome}</td>
                <td>R$ ${produto.preco.toFixed(2)}</td>
                <td>${produto.quantidade}</td>
                <td>R$ ${produto.valorTotal().toFixed(2)}</td>
                <td></td>
            `;

            if (usuario && usuario.perfil === "admin") {
                const btnExcluir = document.createElement("button");
                btnExcluir.className = "btn-excluir";
                btnExcluir.textContent = "Excluir";
                btnExcluir.addEventListener("click", () => excluirProduto(produto.id, produto.nome));
                row.querySelector("td:last-child").appendChild(btnExcluir);
            } else {
                row.querySelector("td:last-child").textContent = "-";
            }

            tabela.appendChild(row);
        });

        document.getElementById("total-estoque").textContent =
            `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;

    } catch (erro) {
        console.error("Erro ao buscar dados:", erro);
    }
}

// Excluir Produto por ID (Restrito a Admin)
async function excluirProduto(id, nome) {
    const token = obterToken();
    if (!token) {
        alert("Sessão expirada ou não autorizada.");
        return;
    }

    if (!confirm(`Deseja excluir o produto "${nome}"?`)) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!resposta.ok) {
            const dados = await resposta.json();
            throw new Error(dados.erro || "Erro ao excluir produto.");
        }

        renderizarTabela();
    } catch (erro) {
        alert(erro.message);
    }
}

// Limpar Toda a Tabela (Restrito a Admin)
document.getElementById("limpar-tabela").addEventListener("click", async function () {
    const token = obterToken();
    if (!token) {
        alert("Sessão expirada ou não autorizada.");
        return;
    }

    if (confirm("Deseja mesmo limpar toda a tabela?")) {
        try {
            const resposta = await fetch(API_URL, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!resposta.ok) {
                const dados = await resposta.json();
                throw new Error(dados.erro || "Erro ao limpar a tabela.");
            }

            renderizarTabela();
        } catch (erro) {
            alert(erro.message);
        }
    }
});

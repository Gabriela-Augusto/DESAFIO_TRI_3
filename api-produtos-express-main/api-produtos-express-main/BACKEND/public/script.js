/**
 * POO NO FRONTEND (ABSTRAÇÃO COM ID INTEGRADO DO BANCO)
 */

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

    get id() {
        return this.#id;
    }

    get preco() {
        return this.#preco;
    }

    get quantidade() {
        return this.#quantidade;
    }

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

// CARREGAR DADOS QUANDO O DOM ESTIVER PRONTO
document.addEventListener("DOMContentLoaded", () => {
    renderizarTabela();
});

// ADICIONAR PRODUTO
document.getElementById("produto-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const nome = document.getElementById("nome").value;
    const preco = document.getElementById("preco").value;
    const quantidade = document.getElementById("quantidade").value;

    try {
        const novoProduto = new Produto(nome, preco, quantidade);

        const resposta = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(novoProduto)
        });

        if (!resposta.ok) {
            throw new Error("Erro ao salvar o produto no servidor.");
        }

        renderizarTabela();
        e.target.reset();

    } catch (erro) {
        alert(erro.message);
    }
});


// BUSCAR E EXIBIR PRODUTOS
async function renderizarTabela() {
    try {
        const resposta = await fetch(API_URL);
        
        if (!resposta.ok) {
            throw new Error("Erro ao carregar lista de produtos.");
        }

        const dadosBrutosDoServidor = await resposta.json();

        const tabela = document.querySelector("#tabela-produtos tbody");
        tabela.innerHTML = "";

        let totalAcumulado = 0;

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

            const btnExcluir = document.createElement("button");
            btnExcluir.className = "btn-excluir";
            btnExcluir.textContent = "Excluir";
            btnExcluir.addEventListener("click", () => excluirProduto(produto.id, produto.nome));

            row.querySelector("td:last-child").appendChild(btnExcluir);
            tabela.appendChild(row);
        });

        document.getElementById("total-estoque").textContent =
            `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;

    } catch (erro) {
        console.error("Erro ao buscar dados no servidor:", erro);
    }
}


// EXCLUIR PRODUTO POR ID
async function excluirProduto(id, nome) {
    if (!id) {
        alert("Erro: ID do produto inválido.");
        return;
    }

    if (!confirm(`Deseja excluir o produto "${nome}"?`)) {
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao excluir produto no servidor.");
        }

        renderizarTabela();

    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        alert(erro.message);
    }
}


// LIMPAR TODA A TABELA
document.getElementById("limpar-tabela").addEventListener("click", async function () {
    if (confirm("Deseja mesmo limpar toda a tabela?")) {
        try {
            const resposta = await fetch(API_URL, {
                method: "DELETE"
            });

            if (!resposta.ok) {
                throw new Error("Erro ao limpar a tabela.");
            }

            renderizarTabela();

        } catch (erro) {
            console.error("Erro ao limpar dados:", erro);
            alert(erro.message);
        }
    }
});

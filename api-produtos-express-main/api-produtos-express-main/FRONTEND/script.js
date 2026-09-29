/**
==========================================================
MANTENDO A POO NO FRONTEND (ABSTRAÇÃO)
==========================================================
A classe Produto continua existindo no frontend, ela ainda serve
para validar os dados na tela antes de enviar para o servidor e
para organizar o objeto
*/
    class Produto {
    #preco;
    #quantidade;
    
    constructor(nome, preco, quantidade, id = null) {
    if (!nome || preco <= 0 || quantidade <= 0) {
    throw new Error("Dados inválidos para o produto.");
    }
    this.id = id;
    this.nome = nome;
    this.#preco = parseFloat(preco);
    this.#quantidade = parseInt(quantidade, 10);
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
    
    // MÉTODO DIDÁTICO: toJSON()
    // Como os atributos #preco e #quantidade são PRIVADOS, o JS
    // não deixa o comando JSON.stringify() acessá-los diretamente.
    // Criamos este método para exportar os dados no formato esperado pela API.
    toJSON() {
    return {
    id: this.id,
    nome: this.nome,
    preco: this.#preco,
    quantidade: this.#quantidade
    };
    }
    }
    
    // MUDANÇA PARA A ARQUITETURA CLIENT-SERVER (BACKEND)
    // Endereço da API rodando no servidor Express
    const API_URL = "https://api-produtos-express-theta.vercel.app/produtos";
    
    // REQUISIÇÃO POST - Enviar dados ao servidor
    document.getElementById("produto-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const preco = document.getElementById("preco").value;
    const quantidade = document.getElementById("quantidade").value;
    
    try {
    // INSTANCIAÇÃO: criando o objeto temporário e validando os inputs do usuário
    const novoProduto = new Produto(nome, preco, quantidade);
    
    // DISPARO DE REDE: envia o produto convertido em texto JSON para o Express
    const resposta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(novoProduto.toJSON())
    });
    
    if (!resposta.ok) {
    throw new Error("Erro ao salvar o produto no servidor backend.");
    }
    
    // Redesenha a interface com base no novo estado do servidor
    renderizarTabela();
    
    e.target.reset();
    } catch (erro) {
    // Captura erros disparados pelo construtor da classe Produto ou falhas de rede
    alert(erro.message);
    }
    });
    
    // REQUISIÇÃO GET (Buscar do servidor e desenhar a tela)
    async function renderizarTabela() {
    try {
    // 1. Busca os dados brutos (JSON) armazenados no Express
    const resposta = await fetch(API_URL);
    const dadosBrutosDoServidor = await resposta.json();
    
    const tabela = document.querySelector("#tabela-produtos tbody");
    tabela.innerHTML = ""; // Reseta a tabela para desenhar o novo estado
    
    let totalAcumulado = 0;
    
    // 2. Passa por cada item retornado pelo backend
    dadosBrutosDoServidor.forEach((dados) => {
    // Reconstituição do objeto: os dados vindos do servidor são literais JSON.
    // Instanciamos a classe Produto novamente para recuperar métodos como valorTotal().
    const produto = new Produto(dados.nome, dados.preco, dados.quantidade, dados.id);
    
    totalAcumulado += produto.valorTotal();
    
    // Desenha a linha na tabela utilizando os dados do objeto reconstituído
    const row = document.createElement("tr");
    
    row.innerHTML = `
    <td>${produto.nome}</td>
    <td>R$ ${produto.preco.toFixed(2)}</td>
    <td>${produto.quantidade}</td>
    <td>R$ ${produto.valorTotal().toFixed(2)}</td>
    <td><button class="remover-produto" onclick="excluirPoduto(${produto.id})">Remover produto</button></td>
    `;
    tabela.appendChild(row);
    });
    
    // 3. Atualiza o elemento de texto com o acumulado total
    document.getElementById("total-estoque").textContent = `Total em estoque: R$ ${totalAcumulado.toFixed(2)}`;
    } catch (erro) {
    console.error("Erro ao buscar dados no servidor:", erro);
    }
    }

    async function excluirPoduto(id) {
        if (confirm(`Deseja remover esse produto?`)) {
            try {
                const resposta = await fetch(`${API_URL}/${id}`, {
                    method: "DELETE"
                });
                if (!resposta.ok) {
                    throw new Error("Erro ao remover o produto.");
                }
                renderizarTabela();
            } catch (erro) {
                console.error("Erro ao limpar dados no servidor:", erro);
            }
        }
    };
    
    // REQUISIÇÃO DELETE (Apagar os dados em lote)
    document.getElementById("limpar-tabela").addEventListener("click", async function () {
    if (confirm("Deseja mesmo limpar toda a tabela no servidor?")) {
    try {
    // Envia uma ordem de remoção total para a API
    await fetch(API_URL, { method: "DELETE" });
    
    // Atualiza a tela
    renderizarTabela();
    } catch (erro) {
    console.error("Erro ao limpar dados no servidor:", erro);
    }
    }
    });
    
    // INICIALIZAÇÃO AUTOMÁTICA
    // Carrega os dados do backend assim que o script roda
    renderizarTabela();

   

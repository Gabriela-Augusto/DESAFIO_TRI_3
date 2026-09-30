require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

/*
==========================================================
CONEXÃO COM O SUPABASE / POSTGRESQL
==========================================================
A Vercel fornece a DATABASE_URL através das
Environment Variables.

NÃO coloque a senha diretamente neste arquivo.
*/

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL não foi configurada.");
}

const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        },
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000
    })
    : null;


/*
==========================================================
ROTA PRINCIPAL
==========================================================
*/

app.get("/", (req, res) => {
    res.status(200).json({
        projeto: "API Produtos",
        status: "online",
        banco: pool ? "DATABASE_URL configurada" : "DATABASE_URL ausente"
    });
});


/*
==========================================================
ROTA DE TESTE DO BANCO
==========================================================
*/

app.get("/health", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            status: "erro",
            mensagem: "DATABASE_URL não está configurada na Vercel."
        });
    }

    try {

        const result = await pool.query(`
            SELECT
                current_database() AS database,
                current_schema() AS schema
        `);

        res.status(200).json({
            status: "ok",
            banco: result.rows[0]
        });

    } catch (erro) {

        console.error("ERRO DE CONEXÃO:", erro);

        res.status(500).json({
            status: "erro",
            mensagem: "Não foi possível conectar ao banco.",
            detalhe: erro.message
        });
    }
});


/*
==========================================================
GET /produtos
BUSCAR PRODUTOS
==========================================================
*/

app.get("/produtos", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            erro: "DATABASE_URL não está configurada na Vercel."
        });
    }

    try {

        const result = await pool.query(`
            SELECT
                id,
                nome,
                preco,
                quantidade
            FROM produtos
            ORDER BY id ASC
        `);

        res.status(200).json(result.rows);

    } catch (erro) {

        console.error("ERRO AO BUSCAR PRODUTOS:", erro);

        res.status(500).json({
            erro: "Erro ao buscar produtos.",
            detalhe: erro.message
        });
    }
});


/*
==========================================================
POST /produtos
ADICIONAR PRODUTO
==========================================================
*/

app.post("/produtos", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            erro: "DATABASE_URL não está configurada na Vercel."
        });
    }

    const { nome, preco, quantidade } = req.body;

    const nomeProduto = String(nome || "").trim();
    const precoProduto = Number(preco);
    const quantidadeProduto = Number(quantidade);

    if (
        nomeProduto === "" ||
        !Number.isFinite(precoProduto) ||
        !Number.isInteger(quantidadeProduto) ||
        precoProduto <= 0 ||
        quantidadeProduto <= 0
    ) {
        return res.status(400).json({
            erro: "Dados inválidos."
        });
    }

    try {

        const result = await pool.query(
            `
            INSERT INTO produtos
            (nome, preco, quantidade)
            VALUES ($1, $2, $3)
            RETURNING id, nome, preco, quantidade
            `,
            [
                nomeProduto,
                precoProduto,
                quantidadeProduto
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (erro) {

        console.error("ERRO AO INSERIR PRODUTO:", erro);

        res.status(500).json({
            erro: "Erro ao inserir produto.",
            detalhe: erro.message
        });
    }
});


/*
==========================================================
DELETE /produtos/:id
EXCLUIR UM PRODUTO
==========================================================
*/

app.delete("/produtos/:id", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            erro: "DATABASE_URL não está configurada na Vercel."
        });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            erro: "ID inválido."
        });
    }

    try {

        const result = await pool.query(
            "DELETE FROM produtos WHERE id = $1",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        res.status(204).send();

    } catch (erro) {

        console.error("ERRO AO EXCLUIR PRODUTO:", erro);

        res.status(500).json({
            erro: "Erro ao excluir produto.",
            detalhe: erro.message
        });
    }
});


/*
==========================================================
DELETE /produtos
LIMPAR TODOS OS PRODUTOS
==========================================================
*/

app.delete("/produtos", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            erro: "DATABASE_URL não está configurada na Vercel."
        });
    }

    try {

        await pool.query("DELETE FROM produtos");

        res.status(204).send();

    } catch (erro) {

        console.error("ERRO AO LIMPAR PRODUTOS:", erro);

        res.status(500).json({
            erro: "Erro ao limpar produtos.",
            detalhe: erro.message
        });
    }
});


/*
==========================================================
ROTA 404
==========================================================
*/

app.use((req, res) => {

    res.status(404).json({
        erro: "Rota não encontrada.",
        rota: req.originalUrl
    });

});


/*
==========================================================
VERCEL
==========================================================
*/

module.exports = app;


/*
==========================================================
EXECUÇÃO LOCAL
==========================================================
*/

if (require.main === module) {

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });

}

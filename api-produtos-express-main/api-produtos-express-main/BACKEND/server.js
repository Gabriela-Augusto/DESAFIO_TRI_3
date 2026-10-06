require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const databaseUrl = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    })
    : null;

app.use(express.static(path.join(__dirname, 'public')));

function verificarConfiguracao(res) {
    if (!pool) {
        res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
        return false;
    }

    if (!JWT_SECRET) {
        res.status(500).json({
            erro: 'JWT_SECRET não está configurada na Vercel.'
        });
        return false;
    }

    return true;
}

// Middleware: autenticação JWT
function autenticarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({
            erro: 'Token não informado.'
        });
    }

    try {
        const usuario = jwt.verify(token, JWT_SECRET);
        req.usuario = usuario;
        next();
    } catch (erro) {
        return res.status(401).json({
            erro: 'Token inválido ou expirado.'
        });
    }
}

// Middleware: autorização de administrador
function exigirAdmin(req, res, next) {
    if (req.usuario?.perfil !== 'admin') {
        return res.status(403).json({
            erro: 'Acesso negado. Apenas administradores podem realizar esta ação.'
        });
    }

    next();
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// AUTENTICAÇÃO
// =========================

app.post('/auth/registro', async (req, res) => {
    if (!verificarConfiguracao(res)) return;

    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({
            erro: 'Nome, email e senha são obrigatórios.'
        });
    }

    const emailNormalizado = String(email).trim().toLowerCase();

    if (senha.length < 6) {
        return res.status(400).json({
            erro: 'A senha deve ter pelo menos 6 caracteres.'
        });
    }

    try {
        const existente = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1',
            [emailNormalizado]
        );

        if (existente.rowCount > 0) {
            return res.status(409).json({
                erro: 'Este email já está cadastrado.'
            });
        }

        // Nunca salvamos a senha em texto puro.
        const senhaHash = await bcrypt.hash(senha, 12);

        // Novos cadastros entram como cliente.
        // O perfil admin deve ser concedido diretamente no banco.
        const result = await pool.query(
            `INSERT INTO usuarios (nome, email, senha, perfil)
             VALUES ($1, $2, $3, 'cliente')
             RETURNING id, nome, email, perfil`,
            [nome.trim(), emailNormalizado, senhaHash]
        );

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso.',
            usuario: result.rows[0]
        });
    } catch (erro) {
        console.error('ERRO REGISTRO:', erro);
        return res.status(500).json({
            erro: 'Erro ao cadastrar usuário.',
            detalhe: erro.message
        });
    }
});

app.post('/auth/login', async (req, res) => {
    if (!verificarConfiguracao(res)) return;

    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({
            erro: 'Email e senha são obrigatórios.'
        });
    }

    const emailNormalizado = String(email).trim().toLowerCase();

    try {
        const result = await pool.query(
            'SELECT id, nome, email, senha, perfil FROM usuarios WHERE email = $1',
            [emailNormalizado]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                erro: 'Email ou senha inválidos.'
            });
        }

        const usuario = result.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({
                erro: 'Email ou senha inválidos.'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                perfil: usuario.perfil
            },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        return res.status(200).json({
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });
    } catch (erro) {
        console.error('ERRO LOGIN:', erro);
        return res.status(500).json({
            erro: 'Erro ao realizar login.',
            detalhe: erro.message
        });
    }
});

app.get('/auth/me', autenticarToken, async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        const result = await pool.query(
            'SELECT id, nome, email, perfil FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado.'
            });
        }

        res.json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO AUTH/ME:', erro);
        res.status(500).json({
            erro: 'Erro ao consultar usuário.'
        });
    }
});

// =========================
// PRODUTOS
// =========================

// Pública
app.get('/produtos', async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM produtos ORDER BY id ASC'
        );

        res.status(200).json(result.rows);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao buscar produtos',
            detalhe: erro.message
        });
    }
});

// Autenticada
app.post('/produtos', autenticarToken, async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    const { nome, preco, quantidade } = req.body;
    const p = Number(preco);
    const q = Number(quantidade);

    if (!nome || !Number.isFinite(p) || !Number.isInteger(q) || p <= 0 || q <= 0) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO produtos(nome, preco, quantidade)
             VALUES($1, $2, $3)
             RETURNING *`,
            [String(nome).trim(), p, q]
        );

        res.status(201).json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao inserir produto',
            detalhe: erro.message
        });
    }
});

// Autenticada
app.put('/produtos/:id', autenticarToken, async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    const { nome, preco, quantidade } = req.body;
    const p = Number(preco);
    const q = Number(quantidade);

    if (!nome || !Number.isFinite(p) || !Number.isInteger(q) || p <= 0 || q <= 0) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    try {
        const result = await pool.query(
            `UPDATE produtos
             SET nome = $1, preco = $2, quantidade = $3
             WHERE id = $4
             RETURNING *`,
            [String(nome).trim(), p, q, req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao atualizar produto',
            detalhe: erro.message
        });
    }
});

// Autenticada + admin
app.delete('/produtos/:id', autenticarToken, exigirAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        const result = await pool.query(
            'DELETE FROM produtos WHERE id = $1',
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao deletar produto',
            detalhe: erro.message
        });
    }
});

// Autenticada + admin
app.delete('/produtos', autenticarToken, exigirAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).json({
            erro: 'DATABASE_URL não está configurada na Vercel.'
        });
    }

    try {
        await pool.query('DELETE FROM produtos');
        res.status(204).send();
    } catch (erro) {
        console.error('ERRO POSTGRES:', erro);
        res.status(500).json({
            erro: 'Erro ao limpar produtos',
            detalhe: erro.message
        });
    }
});

module.exports = app;

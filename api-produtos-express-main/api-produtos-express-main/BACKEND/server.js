require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_para_desvolvimento';

// Middlewares Globais
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Gerenciamento do Pool Serverless
let pool;
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 1
        });
    }
    return pool;
}

// -------------------------------------------------------------
// MIDDLEWARES DE AUTENTICAÇÃO E AUTORIZAÇÃO
// -------------------------------------------------------------

function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
    }

    jwt.verify(token, JWT_SECRET, (err, usuario) => {
        if (err) {
            return res.status(403).json({ erro: "Token inválido ou expirado." });
        }
        req.usuario = usuario;
        next();
    });
}

function autorizarAdmin(req, res, next) {
    if (req.usuario && req.usuario.perfil === 'admin') {
        next();
    } else {
        res.status(403).json({ erro: "Acesso negado. Permissão de Admin necessária." });
    }
}

// -------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (AUTH)
// -------------------------------------------------------------

// Registro de Usuário
app.post('/api/auth/registro', async (req, res) => {
    const { nome, email, senha, perfil } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
    }

    const perfilUsuario = (perfil === 'admin') ? 'admin' : 'cliente';

    try {
        const client = getPool();

        // Verificar se e-mail já existe
        const usuarioExistente = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (usuarioExistente.rows.length > 0) {
            return res.status(400).json({ erro: "E-mail já cadastrado." });
        }

        // Criptografar a senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        // Salvar no banco
        const query = `
            INSERT INTO usuarios (nome, email, senha, perfil)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nome, email, perfil
        `;
        const result = await client.query(query, [nome, email, senhaHash, perfilUsuario]);

        res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso!",
            usuario: result.rows[0]
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ erro: "Erro ao registrar usuário." });
    }
});

// Login de Usuário
app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    try {
        const client = getPool();
        const result = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        const usuario = result.rows[0];

        // Validar senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        // Gerar Token JWT (Válido por 8 horas)
        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensagem: "Login realizado com sucesso!",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ erro: "Erro ao realizar login." });
    }
});

// -------------------------------------------------------------
// ROTAS DE PRODUTOS (PROTEGIDAS)
// -------------------------------------------------------------

// ROTA PÚBLICA: Listar produtos (Qualquer um pode ver)
app.get('/api/produtos', async (req, res) => {
    try {
        const client = getPool();
        const result = await client.query('SELECT * FROM produtos ORDER BY id ASC');
        res.json(result.rows);
    } catch (erro) {
        console.error('Erro ao buscar produtos:', erro);
        res.status(500).json({ erro: "Erro ao buscar produtos no banco de dados." });
    }
});

// ROTA PROTEGIDA: Criar produto (Exige Login + Perfil Admin)
app.post('/api/produtos', autenticarToken, autorizarAdmin, async (req, res) => {
    const { nome, preco, quantidade } = req.body;
    const p = parseFloat(preco);
    const q = parseInt(quantidade, 10);

    if (!nome || isNaN(p) || isNaN(q) || p <= 0 || q < 0) {
        return res.status(400).json({ erro: "Dados inválidos enviados para o servidor" });
    }

    try {
        const client = getPool();
        const query = `
            INSERT INTO produtos(nome, preco, quantidade)
            VALUES($1, $2, $3)
            RETURNING *
        `;
        const result = await client.query(query, [nome, p, q]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        res.status(500).json({ erro: 'Erro interno ao salvar produto' });
    }
});

// ROTA PROTEGIDA: Deletar produto específico (Exige Login + Perfil Admin)
app.delete('/api/produtos/:id', autenticarToken, autorizarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const client = getPool();
        const result = await client.query('DELETE FROM produtos WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({ erro: "Erro ao deletar produto." });
    }
});

// ROTA PROTEGIDA: Limpar todos os produtos (Exige Login + Perfil Admin)
app.delete('/api/produtos', autenticarToken, autorizarAdmin, async (req, res) => {
    try {
        const client = getPool();
        await client.query('DELETE FROM produtos');
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao limpar produtos:', error);
        res.status(500).json({ erro: "Erro ao limpar banco de dados." });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor rodando localmente na porta ${PORT}`);
    });
}

module.exports = app;

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database/db');
const { calcularSalarioLiquido } = require('./utils/calculoCLT');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Rotas principais
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Login e Registro
app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    
    if (usuario && usuario.senha === senha) {
        req.session.userId = usuario.id;
        req.session.userName = usuario.nome;
        res.redirect('/dashboard');
    } else {
        res.render('login', { erro: 'Email ou senha incorretos' });
    }
});

app.get('/registro', (req, res) => {
    res.render('registro', { erro: null });
});

app.post('/registro', (req, res) => {
    const { nome, email, senha } = req.body;
    
    try {
        const result = db.prepare('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)').run(nome, email, senha);
        
        // Criar configuração padrão
        db.prepare('INSERT INTO configuracoes (usuario_id) VALUES (?)').run(result.lastInsertRowid);
        
        req.session.userId = result.lastInsertRowid;
        req.session.userName = nome;
        res.redirect('/configuracao/inicial');
    } catch (erro) {
        res.render('registro', { erro: 'Email já cadastrado' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    // Buscar rendas ativas
    const rendas = db.prepare('SELECT * FROM rendas WHERE usuario_id = ? AND ativo = 1').all(userId);
    const totalRendas = rendas.reduce((sum, r) => sum + r.valor, 0);
    
    // Buscar configurações
    const config = db.prepare('SELECT * FROM configuracoes WHERE usuario_id = ?').get(userId);
    
    // Calcular distribuição
    const necessidades = totalRendas * (config.percentual_necessidades / 100);
    const desejos = totalRendas * (config.percentual_desejos / 100);
    const poupanca = totalRendas * (config.percentual_poupanca / 100);
    
    // Buscar despesas do mês atual
    const mesAtual = new Date().toISOString().slice(0, 7);
    const despesas = db.prepare(`
        SELECT categoria, SUM(valor) as total 
        FROM despesas 
        WHERE usuario_id = ? AND strftime('%Y-%m', data) = ?
        GROUP BY categoria
    `).all(userId, mesAtual);
    
    const despesasObj = {
        necessidades: despesas.find(d => d.categoria === 'necessidades')?.total || 0,
        desejos: despesas.find(d => d.categoria === 'desejos')?.total || 0,
        poupanca: despesas.find(d => d.categoria === 'poupanca')?.total || 0
    };
    
    // Buscar meta de reserva de emergência
    const metaReserva = db.prepare('SELECT * FROM metas WHERE usuario_id = ? AND tipo = ? AND ativo = 1').get(userId, 'reserva_emergencia');
    
    res.render('dashboard', {
        userName: req.session.userName,
        rendas,
        totalRendas,
        necessidades,
        desejos,
        poupanca,
        despesas: despesasObj,
        config,
        metaReserva
    });
});

// Configuração inicial
app.get('/configuracao/inicial', requireAuth, (req, res) => {
    res.render('configuracao-inicial', { userName: req.session.userName });
});

app.post('/configuracao/inicial', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const { rendas } = req.body;
    
    // Salvar rendas
    if (rendas && Array.isArray(rendas)) {
        const stmt = db.prepare('INSERT INTO rendas (usuario_id, descricao, valor, tipo) VALUES (?, ?, ?, ?)');
        rendas.forEach(renda => {
            if (renda.descricao && renda.valor) {
                stmt.run(userId, renda.descricao, parseFloat(renda.valor), renda.tipo || 'salario');
            }
        });
    }
    
    // Criar meta de reserva de emergência
    const totalRendas = db.prepare('SELECT SUM(valor) as total FROM rendas WHERE usuario_id = ? AND ativo = 1').get(userId).total || 0;
    const metaReserva = totalRendas * 3; // 3 meses de renda
    
    db.prepare('INSERT INTO metas (usuario_id, descricao, valor_meta, tipo, prazo_meses) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        'Reserva de Emergência',
        metaReserva,
        'reserva_emergencia',
        12
    );
    
    res.redirect('/dashboard');
});

// Rendas
app.get('/rendas', requireAuth, (req, res) => {
    const rendas = db.prepare('SELECT * FROM rendas WHERE usuario_id = ? ORDER BY criado_em DESC').all(req.session.userId);
    res.render('rendas', { userName: req.session.userName, rendas });
});

app.post('/rendas/adicionar', requireAuth, (req, res) => {
    const { descricao, valor, tipo, tipoValor, dependentes } = req.body;
    
    let valorFinal = parseFloat(valor);
    let valorBruto = null;
    let tipoValorFinal = 'liquido';
    
    // Se for salário e tipo bruto, calcular o líquido
    if (tipo === 'salario' && tipoValor === 'bruto') {
        const numDependentes = parseInt(dependentes) || 0;
        const calculo = calcularSalarioLiquido(valorFinal, numDependentes, 0);
        
        valorBruto = valorFinal;
        valorFinal = calculo.salarioLiquido;
        tipoValorFinal = 'bruto';
    }
    
    db.prepare('INSERT INTO rendas (usuario_id, descricao, valor, tipo, tipo_valor, valor_bruto) VALUES (?, ?, ?, ?, ?, ?)').run(
        req.session.userId,
        descricao,
        valorFinal,
        tipo,
        tipoValorFinal,
        valorBruto
    );
    res.redirect('/rendas');
});

app.post('/rendas/deletar/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM rendas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.session.userId);
    res.redirect('/rendas');
});

app.post('/rendas/editar/:id', requireAuth, (req, res) => {
    const { descricao, valor, tipo, tipoValor, dependentes } = req.body;
    
    let valorFinal = parseFloat(valor);
    let valorBruto = null;
    let tipoValorFinal = 'liquido';
    
    // Se for salário e tipo bruto, calcular o líquido
    if (tipo === 'salario' && tipoValor === 'bruto') {
        const numDependentes = parseInt(dependentes) || 0;
        const calculo = calcularSalarioLiquido(valorFinal, numDependentes, 0);
        
        valorBruto = valorFinal;
        valorFinal = calculo.salarioLiquido;
        tipoValorFinal = 'bruto';
    }
    
    db.prepare('UPDATE rendas SET descricao = ?, valor = ?, tipo = ?, tipo_valor = ?, valor_bruto = ? WHERE id = ? AND usuario_id = ?').run(
        descricao,
        valorFinal,
        tipo,
        tipoValorFinal,
        valorBruto,
        req.params.id,
        req.session.userId
    );
    res.redirect('/rendas');
});

// Despesas
app.get('/despesas', requireAuth, (req, res) => {
    const mesAtual = new Date().toISOString().slice(0, 7);
    const despesas = db.prepare("SELECT * FROM despesas WHERE usuario_id = ? AND strftime('%Y-%m', data) = ? ORDER BY data DESC").all(req.session.userId, mesAtual);
    res.render('despesas', { userName: req.session.userName, despesas, mesAtual });
});

app.post('/despesas/adicionar', requireAuth, (req, res) => {
    const { descricao, valor, categoria, subcategoria, data, recorrente } = req.body;
    db.prepare('INSERT INTO despesas (usuario_id, descricao, valor, categoria, subcategoria, data, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        req.session.userId,
        descricao,
        parseFloat(valor),
        categoria,
        subcategoria || null,
        data,
        recorrente ? 1 : 0
    );
    res.redirect('/despesas');
});

app.post('/despesas/deletar/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.session.userId);
    res.redirect('/despesas');
});

// Metas
app.get('/metas', requireAuth, (req, res) => {
    const metas = db.prepare('SELECT * FROM metas WHERE usuario_id = ? ORDER BY criado_em DESC').all(req.session.userId);
    res.render('metas', { userName: req.session.userName, metas });
});

app.post('/metas/atualizar-valor/:id', requireAuth, (req, res) => {
    const { valor_atual } = req.body;
    db.prepare('UPDATE metas SET valor_atual = ? WHERE id = ? AND usuario_id = ?').run(
        parseFloat(valor_atual),
        req.params.id,
        req.session.userId
    );
    res.json({ success: true });
});

// Configurações
app.get('/configuracoes', requireAuth, (req, res) => {
    const config = db.prepare('SELECT * FROM configuracoes WHERE usuario_id = ?').get(req.session.userId);
    res.render('configuracoes', { userName: req.session.userName, config });
});

app.post('/configuracoes/atualizar', requireAuth, (req, res) => {
    const { percentual_necessidades, percentual_desejos, percentual_poupanca } = req.body;
    db.prepare('UPDATE configuracoes SET percentual_necessidades = ?, percentual_desejos = ?, percentual_poupanca = ?, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?').run(
        parseInt(percentual_necessidades),
        parseInt(percentual_desejos),
        parseInt(percentual_poupanca),
        req.session.userId
    );
    res.redirect('/configuracoes');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Sistema de Planejamento Financeiro`);
});

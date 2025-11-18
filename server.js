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
    
    // Total de TODAS as rendas (incluindo benefícios)
    const totalRendas = parseFloat(rendas.reduce((sum, r) => sum + r.valor, 0).toFixed(2));
    
    // Total das rendas que entram na distribuição 50/30/20 (excluindo benefícios)
    const rendasParaDistribuicao = rendas.filter(r => r.tipo !== 'beneficio');
    const totalRendasDistribuicao = parseFloat(rendasParaDistribuicao.reduce((sum, r) => sum + r.valor, 0).toFixed(2));
    
    // Buscar configurações
    const config = db.prepare('SELECT * FROM configuracoes WHERE usuario_id = ?').get(userId);
    
    // Calcular distribuição baseada APENAS em salários e rendas extras (sem benefícios)
    const necessidades = parseFloat((totalRendasDistribuicao * (config.percentual_necessidades / 100)).toFixed(2));
    const desejos = parseFloat((totalRendasDistribuicao * (config.percentual_desejos / 100)).toFixed(2));
    const poupanca = parseFloat((totalRendasDistribuicao * (config.percentual_poupanca / 100)).toFixed(2));
    
    // Debug: console.log para verificar
    console.log('💰 Cálculo de Rendas:');
    console.log('Total de rendas (com benefícios):', totalRendas);
    console.log('Total para distribuição (sem benefícios):', totalRendasDistribuicao);
    console.log('Necessidades:', necessidades);
    console.log('Desejos:', desejos);
    console.log('Poupança:', poupanca);
    
    // Buscar despesas do mês atual
    const mesAtual = new Date().toISOString().slice(0, 7);
    const despesas = db.prepare(`
        SELECT categoria, SUM(valor) as total 
        FROM despesas 
        WHERE usuario_id = ? AND strftime('%Y-%m', data) = ?
        GROUP BY categoria
    `).all(userId, mesAtual);
    
    // Debug: console.log para verificar
    console.log('📊 Dashboard Debug:');
    console.log('Mês atual:', mesAtual);
    console.log('Despesas do mês:', despesas);
    
    const despesasObj = {
        necessidades: parseFloat((despesas.find(d => d.categoria === 'necessidades')?.total || 0).toFixed(2)),
        desejos: parseFloat((despesas.find(d => d.categoria === 'desejos')?.total || 0).toFixed(2)),
        poupanca: parseFloat((despesas.find(d => d.categoria === 'poupanca')?.total || 0).toFixed(2))
    };
    
    console.log('Despesas processadas:', despesasObj);
    
    // Calcular média de despesas mensais (últimos 6 meses ou todos os meses disponíveis)
    const mediaDespesas = db.prepare(`
        SELECT AVG(total_mes) as media
        FROM (
            SELECT strftime('%Y-%m', data) as mes, SUM(valor) as total_mes
            FROM despesas 
            WHERE usuario_id = ? AND categoria IN ('necessidades', 'desejos')
            GROUP BY strftime('%Y-%m', data)
            ORDER BY strftime('%Y-%m', data) DESC
            LIMIT 6
        )
    `).get(userId);
    
    const despesaMediaMensal = parseFloat((mediaDespesas?.media || 0).toFixed(2));
    
    // Pegar a configuração de meses para reserva de emergência
    const mesesReserva = config.meses_reserva_emergencia || 6;
    
    // Calcular despesas mensais totais (necessidades + desejos) baseado nas despesas reais
    const despesasMensaisReais = db.prepare(`
        SELECT SUM(valor) as total
        FROM despesas 
        WHERE usuario_id = ? 
        AND categoria IN ('necessidades', 'desejos')
        AND strftime('%Y-%m', data) = strftime('%Y-%m', 'now')
    `).get(userId);
    
    const despesaMensalTotal = parseFloat((despesasMensaisReais?.total || 0).toFixed(2));
    
    // Se não houver despesas no mês atual, usa a média dos últimos 6 meses
    const baseDespesa = despesaMensalTotal > 0 ? despesaMensalTotal : despesaMediaMensal;
    
    // Calcular reserva de emergência dinâmica (X meses de despesas configurável)
    const reservaEmergenciaIdeal = parseFloat((baseDespesa * mesesReserva).toFixed(2));
    
    // Buscar quanto já foi guardado em poupança (todas as despesas de poupança)
    const totalPoupanca = db.prepare(`
        SELECT SUM(valor) as total
        FROM despesas 
        WHERE usuario_id = ? AND categoria = 'poupanca'
    `).get(userId);
    
    const valorAtualReserva = parseFloat((totalPoupanca?.total || 0).toFixed(2));
    
    // Criar objeto de reserva de emergência dinâmica
    const reservaEmergencia = {
        valor_meta: reservaEmergenciaIdeal,
        valor_atual: valorAtualReserva,
        descricao: `Reserva de Emergência (${mesesReserva} meses de despesas)`,
        tipo: 'reserva_emergencia',
        ativo: 1,
        meses: mesesReserva
    };
    
    console.log('📈 Reserva de Emergência:');
    console.log('Despesas mensais (necessidades + desejos):', baseDespesa.toFixed(2));
    console.log(`Meta (${mesesReserva} meses):`, reservaEmergenciaIdeal.toFixed(2));
    console.log('Guardado na poupança:', valorAtualReserva.toFixed(2));
    console.log('Falta guardar:', (reservaEmergenciaIdeal - valorAtualReserva).toFixed(2));
    
    // Criar ou atualizar a meta de Reserva de Emergência no banco de dados
    const metaReservaExistente = db.prepare(`
        SELECT * FROM metas 
        WHERE usuario_id = ? AND tipo = 'reserva_emergencia'
    `).get(userId);
    
    if (metaReservaExistente) {
        // Atualizar meta existente
        db.prepare(`
            UPDATE metas 
            SET valor_meta = ?, valor_atual = ?, descricao = ?, prazo_meses = ?
            WHERE id = ? AND usuario_id = ?
        `).run(
            reservaEmergenciaIdeal,
            valorAtualReserva,
            `Reserva de Emergência (${mesesReserva} meses)`,
            mesesReserva,
            metaReservaExistente.id,
            userId
        );
    } else {
        // Criar nova meta
        db.prepare(`
            INSERT INTO metas (usuario_id, descricao, valor_meta, valor_atual, tipo, prazo_meses, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            `Reserva de Emergência (${mesesReserva} meses)`,
            reservaEmergenciaIdeal,
            valorAtualReserva,
            'reserva_emergencia',
            mesesReserva,
            1
        );
    }
    
    res.render('dashboard', {
        userName: req.session.userName,
        rendas,
        totalRendas,
        necessidades,
        desejos,
        poupanca,
        despesas: despesasObj,
        config,
        metaReserva: reservaEmergencia,
        despesaMediaMensal
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
    
    console.log('💰 Adicionando despesa:');
    console.log('  Usuário:', req.session.userId);
    console.log('  Descrição:', descricao);
    console.log('  Valor:', valor);
    console.log('  Categoria:', categoria);
    console.log('  Data:', data);
    
    try {
        const result = db.prepare('INSERT INTO despesas (usuario_id, descricao, valor, categoria, subcategoria, data, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            req.session.userId,
            descricao,
            parseFloat(valor),
            categoria,
            subcategoria || null,
            data,
            recorrente ? 1 : 0
        );
        console.log('✅ Despesa adicionada com ID:', result.lastInsertRowid);
    } catch (error) {
        console.error('❌ Erro ao adicionar despesa:', error);
    }
    
    res.redirect('/despesas');
});

app.post('/despesas/deletar/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.session.userId);
    res.redirect('/despesas');
});

// Metas
app.get('/metas', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    // Buscar configurações
    let config = db.prepare('SELECT * FROM configuracoes WHERE usuario_id = ?').get(userId);
    
    // Se não existir configuração, criar uma padrão
    if (!config) {
        db.prepare('INSERT INTO configuracoes (usuario_id) VALUES (?)').run(userId);
        config = db.prepare('SELECT * FROM configuracoes WHERE usuario_id = ?').get(userId);
    }
    
    const mesesReserva = config.meses_reserva_emergencia || 6;
    
    // Calcular média de despesas mensais (últimos 6 meses)
    const mediaDespesas = db.prepare(`
        SELECT AVG(total_mes) as media
        FROM (
            SELECT strftime('%Y-%m', data) as mes, SUM(valor) as total_mes
            FROM despesas 
            WHERE usuario_id = ? AND categoria IN ('necessidades', 'desejos')
            GROUP BY strftime('%Y-%m', data)
            ORDER BY strftime('%Y-%m', data) DESC
            LIMIT 6
        )
    `).get(userId);
    
    const despesaMediaMensal = parseFloat((mediaDespesas?.media || 0).toFixed(2));
    const reservaEmergenciaIdeal = parseFloat((despesaMediaMensal * mesesReserva).toFixed(2));
    
    // Buscar quanto já foi guardado em poupança
    const totalPoupanca = db.prepare(`
        SELECT SUM(valor) as total
        FROM despesas 
        WHERE usuario_id = ? AND categoria = 'poupanca'
    `).get(userId);
    
    const valorAtualReserva = parseFloat((totalPoupanca?.total || 0).toFixed(2));
    
    // Atualizar ou criar meta de Reserva de Emergência
    const metaReservaExistente = db.prepare(`
        SELECT * FROM metas 
        WHERE usuario_id = ? AND tipo = 'reserva_emergencia'
    `).get(userId);
    
    if (metaReservaExistente) {
        // Atualizar meta existente
        db.prepare(`
            UPDATE metas 
            SET valor_meta = ?, valor_atual = ?, descricao = ?, prazo_meses = ?
            WHERE id = ? AND usuario_id = ?
        `).run(
            reservaEmergenciaIdeal,
            valorAtualReserva,
            `Reserva de Emergência (${mesesReserva} meses)`,
            mesesReserva,
            metaReservaExistente.id,
            userId
        );
    } else if (despesaMediaMensal > 0) {
        // Criar nova meta apenas se houver despesas registradas
        db.prepare(`
            INSERT INTO metas (usuario_id, descricao, valor_meta, valor_atual, tipo, prazo_meses, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            `Reserva de Emergência (${mesesReserva} meses)`,
            reservaEmergenciaIdeal,
            valorAtualReserva,
            'reserva_emergencia',
            mesesReserva,
            1
        );
    }
    
    const metas = db.prepare('SELECT * FROM metas WHERE usuario_id = ? ORDER BY criado_em DESC').all(userId);
    res.render('metas', { userName: req.session.userName, metas, config });
});

app.post('/metas/configurar-meses', requireAuth, (req, res) => {
    const { meses_reserva_emergencia } = req.body;
    db.prepare('UPDATE configuracoes SET meses_reserva_emergencia = ?, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?').run(
        parseInt(meses_reserva_emergencia) || 6,
        req.session.userId
    );
    res.redirect('/metas');
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

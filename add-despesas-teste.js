const db = require('./database/db');

console.log('\n=== ADICIONANDO DESPESAS DE TESTE ===\n');

// Buscar o primeiro usuário
const usuario = db.prepare('SELECT * FROM usuarios LIMIT 1').get();

if (!usuario) {
    console.log('❌ Nenhum usuário encontrado. Faça login primeiro.');
    process.exit(1);
}

console.log('👤 Usuário:', usuario.nome);

// Criar despesas de exemplo para 3 meses diferentes
const despesasExemplo = [
    // Mês 1 - Setembro 2025
    { descricao: 'Aluguel', valor: 1200, categoria: 'necessidades', data: '2025-09-05' },
    { descricao: 'Supermercado', valor: 600, categoria: 'necessidades', data: '2025-09-10' },
    { descricao: 'Conta de Luz', valor: 150, categoria: 'necessidades', data: '2025-09-15' },
    { descricao: 'Internet', valor: 100, categoria: 'necessidades', data: '2025-09-20' },
    { descricao: 'Cinema', valor: 80, categoria: 'desejos', data: '2025-09-12' },
    { descricao: 'Restaurante', valor: 200, categoria: 'desejos', data: '2025-09-18' },
    
    // Mês 2 - Outubro 2025
    { descricao: 'Aluguel', valor: 1200, categoria: 'necessidades', data: '2025-10-05' },
    { descricao: 'Supermercado', valor: 650, categoria: 'necessidades', data: '2025-10-10' },
    { descricao: 'Conta de Luz', valor: 140, categoria: 'necessidades', data: '2025-10-15' },
    { descricao: 'Internet', valor: 100, categoria: 'necessidades', data: '2025-10-20' },
    { descricao: 'Shopping', valor: 150, categoria: 'desejos', data: '2025-10-12' },
    { descricao: 'Assinatura Streaming', valor: 50, categoria: 'desejos', data: '2025-10-01' },
    
    // Mês 3 - Novembro 2025
    { descricao: 'Aluguel', valor: 1200, categoria: 'necessidades', data: '2025-11-05' },
    { descricao: 'Supermercado', valor: 580, categoria: 'necessidades', data: '2025-11-10' },
    { descricao: 'Conta de Luz', valor: 160, categoria: 'necessidades', data: '2025-11-15' },
    { descricao: 'Internet', valor: 100, categoria: 'necessidades', data: '2025-11-20' },
    { descricao: 'Viagem', valor: 400, categoria: 'desejos', data: '2025-11-08' },
    
    // Poupança
    { descricao: 'Investimento Tesouro', valor: 300, categoria: 'poupanca', data: '2025-09-25' },
    { descricao: 'Investimento Tesouro', valor: 300, categoria: 'poupanca', data: '2025-10-25' },
    { descricao: 'Investimento Tesouro', valor: 300, categoria: 'poupanca', data: '2025-11-17' }
];

console.log(`📝 Adicionando ${despesasExemplo.length} despesas...\n`);

const stmt = db.prepare('INSERT INTO despesas (usuario_id, descricao, valor, categoria, data, recorrente) VALUES (?, ?, ?, ?, ?, 0)');

let contador = 0;
for (const despesa of despesasExemplo) {
    try {
        stmt.run(usuario.id, despesa.descricao, despesa.valor, despesa.categoria, despesa.data);
        contador++;
        console.log(`✅ ${despesa.data} - ${despesa.categoria.padEnd(15)} - R$ ${despesa.valor.toFixed(2).padStart(8)} - ${despesa.descricao}`);
    } catch (error) {
        console.error(`❌ Erro ao adicionar ${despesa.descricao}:`, error.message);
    }
}

console.log(`\n✅ ${contador} despesas adicionadas com sucesso!`);

// Calcular resumo
const resumo = db.prepare(`
    SELECT 
        strftime('%Y-%m', data) as mes,
        categoria,
        SUM(valor) as total
    FROM despesas 
    WHERE usuario_id = ?
    GROUP BY strftime('%Y-%m', data), categoria
    ORDER BY mes, categoria
`).all(usuario.id);

console.log('\n📊 RESUMO POR MÊS:\n');
console.table(resumo);

// Calcular média mensal
const media = db.prepare(`
    SELECT AVG(total_mes) as media
    FROM (
        SELECT strftime('%Y-%m', data) as mes, SUM(valor) as total_mes
        FROM despesas 
        WHERE usuario_id = ? AND categoria IN ('necessidades', 'desejos')
        GROUP BY strftime('%Y-%m', data)
    )
`).get(usuario.id);

console.log(`\n💰 Despesa média mensal: R$ ${(media.media || 0).toFixed(2)}`);
console.log(`🎯 Reserva de emergência ideal (6 meses): R$ ${((media.media || 0) * 6).toFixed(2)}`);

// Total em poupança
const totalPoupanca = db.prepare(`
    SELECT SUM(valor) as total
    FROM despesas 
    WHERE usuario_id = ? AND categoria = 'poupanca'
`).get(usuario.id);

console.log(`💎 Total guardado em poupança: R$ ${(totalPoupanca.total || 0).toFixed(2)}`);

console.log('\n✨ Acesse http://localhost:3001/dashboard para ver o resultado!\n');

db.close();

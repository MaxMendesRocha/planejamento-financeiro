const db = require('./database/db');

console.log('\n=== VERIFICAÇÃO DE DESPESAS ===\n');

// Buscar todas as despesas de poupança
const despesasPoupanca = db.prepare(`
    SELECT d.*, u.nome, u.email 
    FROM despesas d
    JOIN usuarios u ON d.usuario_id = u.id
    WHERE d.categoria = 'poupanca'
    ORDER BY d.data DESC
`).all();

console.log('📊 Total de despesas de poupança:', despesasPoupanca.length);
console.table(despesasPoupanca);

// Buscar despesas do mês atual agrupadas
const mesAtual = new Date().toISOString().slice(0, 7);
console.log('\n📅 Mês atual:', mesAtual);

const despesasMes = db.prepare(`
    SELECT categoria, SUM(valor) as total, COUNT(*) as quantidade
    FROM despesas 
    WHERE strftime('%Y-%m', data) = ?
    GROUP BY categoria
`).all(mesAtual);

console.log('\n📈 Despesas do mês atual agrupadas:');
console.table(despesasMes);

// Verificar configurações dos usuários
const usuarios = db.prepare('SELECT id, nome, email FROM usuarios').all();
console.log('\n👥 Usuários cadastrados:');
console.table(usuarios);

db.close();

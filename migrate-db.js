const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database', 'financeiro.db'));

console.log('\n=== MIGRAÇÃO DO BANCO DE DADOS ===\n');

try {
    // Verificar se as colunas já existem
    const tableInfo = db.prepare("PRAGMA table_info(rendas)").all();
    const hastipoValor = tableInfo.some(col => col.name === 'tipo_valor');
    const hasValorBruto = tableInfo.some(col => col.name === 'valor_bruto');
    
    console.log('📋 Verificando estrutura da tabela rendas...');
    console.log('Colunas existentes:', tableInfo.map(c => c.name).join(', '));
    
    if (!hastipoValor) {
        console.log('\n➕ Adicionando coluna tipo_valor...');
        db.exec(`ALTER TABLE rendas ADD COLUMN tipo_valor TEXT DEFAULT 'liquido'`);
        console.log('✅ Coluna tipo_valor adicionada com sucesso!');
    } else {
        console.log('\n✓ Coluna tipo_valor já existe');
    }
    
    if (!hasValorBruto) {
        console.log('\n➕ Adicionando coluna valor_bruto...');
        db.exec(`ALTER TABLE rendas ADD COLUMN valor_bruto DECIMAL(10,2)`);
        console.log('✅ Coluna valor_bruto adicionada com sucesso!');
    } else {
        console.log('\n✓ Coluna valor_bruto já existe');
    }
    
    // Verificar resultado final
    const finalTableInfo = db.prepare("PRAGMA table_info(rendas)").all();
    console.log('\n📊 Estrutura final da tabela rendas:');
    console.table(finalTableInfo);
    
    console.log('\n✅ Migração concluída com sucesso!');
    console.log('🚀 Você pode reiniciar o servidor agora.\n');
    
} catch (error) {
    console.error('\n❌ Erro durante a migração:', error);
} finally {
    db.close();
}

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'financeiro.db'));
db.pragma('journal_mode = WAL');

// Criar tabelas
function initDatabase() {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de rendas
    db.exec(`
        CREATE TABLE IF NOT EXISTS rendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            valor DECIMAL(10,2) NOT NULL,
            tipo TEXT NOT NULL, -- 'salario', 'beneficio', 'extra'
            ativo BOOLEAN DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // Tabela de despesas
    db.exec(`
        CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            valor DECIMAL(10,2) NOT NULL,
            categoria TEXT NOT NULL, -- 'necessidades', 'desejos', 'poupanca'
            subcategoria TEXT,
            data DATE NOT NULL,
            recorrente BOOLEAN DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // Tabela de metas
    db.exec(`
        CREATE TABLE IF NOT EXISTS metas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            valor_meta DECIMAL(10,2) NOT NULL,
            valor_atual DECIMAL(10,2) DEFAULT 0,
            tipo TEXT NOT NULL, -- 'reserva_emergencia', 'objetivo', 'aposentadoria'
            prazo_meses INTEGER,
            ativo BOOLEAN DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // Tabela de configurações do usuário
    db.exec(`
        CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER UNIQUE NOT NULL,
            percentual_necessidades INTEGER DEFAULT 50,
            percentual_desejos INTEGER DEFAULT 30,
            percentual_poupanca INTEGER DEFAULT 20,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    console.log('✅ Banco de dados inicializado com sucesso!');
}

initDatabase();

module.exports = db;

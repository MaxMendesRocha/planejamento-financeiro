# 💰 Sistema de Planejamento Financeiro

Sistema completo de planejamento financeiro pessoal baseado no método 50/30/20, desenvolvido com Node.js, Express, SQLite e EJS.

## 🚀 Funcionalidades

- ✅ **Autenticação de usuários** (login e registro)
- ✅ **Dashboard interativo** com visão geral financeira
- ✅ **Gerenciamento de rendas** (múltiplas fontes de renda)
- ✅ **Controle de despesas** por categoria (Necessidades, Desejos, Poupança)
- ✅ **Metas financeiras** com acompanhamento de progresso
- ✅ **Configuração personalizada** dos percentuais (50/30/20 customizável)
- ✅ **Relatórios visuais** de orçamento vs realizado
- ✅ **Banco de dados SQLite** para armazenamento seguro
- ✅ **Interface moderna e responsiva**

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (gerenciador de pacotes do Node.js)

## 🔧 Instalação

1. **Instale as dependências:**

```bash
npm install
```

2. **Configure as variáveis de ambiente:**

O arquivo `.env` já está criado com configurações padrão. Você pode alterá-lo se necessário.

3. **Inicie o servidor:**

```bash
npm start
```

Para desenvolvimento com auto-reload:

```bash
npm run dev
```

4. **Acesse a aplicação:**

Abra seu navegador e acesse: `http://localhost:3000`

## 📖 Como Usar

### 1️⃣ Primeiro Acesso

1. Acesse a aplicação e clique em "Criar conta"
2. Preencha seus dados (nome, email, senha)
3. Na tela de configuração inicial, adicione suas fontes de renda
4. Pronto! Você será direcionado ao Dashboard

### 2️⃣ Gerenciar Rendas

- Acesse o menu "Rendas"
- Adicione todas as suas fontes de renda (salário, freelance, benefícios)
- Você pode desativar rendas temporárias quando necessário

### 3️⃣ Registrar Despesas

- Acesse o menu "Despesas"
- Adicione cada gasto classificando em:
  - 🏠 **Necessidades** (50%): Contas fixas, alimentação, saúde
  - 🎨 **Desejos** (30%): Lazer, restaurantes, compras
  - 💎 **Poupança** (20%): Investimentos, reserva
- Marque como "recorrente" se é uma despesa mensal

### 4️⃣ Acompanhar Metas

- Acesse o menu "Metas"
- Veja o progresso da sua Reserva de Emergência
- Atualize o valor guardado regularmente

### 5️⃣ Personalizar Configurações

- Acesse o menu "Configurações"
- Ajuste os percentuais conforme sua necessidade
- O padrão é 50/30/20, mas você pode customizar

## 💡 Método 50/30/20

### 🏠 50% - Necessidades
Gastos essenciais para sobrevivência:
- Moradia (aluguel, condomínio)
- Alimentação básica
- Transporte
- Saúde
- Contas (água, luz, internet)

### 🎨 30% - Desejos
Gastos que melhoram qualidade de vida:
- Restaurantes e delivery
- Lazer e entretenimento
- Assinaturas (streaming, academia)
- Viagens
- Hobbies

### 💎 20% - Poupança
Garantir seu futuro:
- Reserva de emergência (prioridade)
- Investimentos
- Previdência privada
- Objetivos específicos

## 🗂️ Estrutura do Projeto

```
planejamento-financeiro/
├── database/
│   └── db.js                 # Configuração do banco SQLite
├── public/
│   └── css/
│       └── style.css         # Estilos da aplicação
├── views/
│   ├── partials/
│   │   └── navbar.ejs        # Menu de navegação
│   ├── login.ejs             # Página de login
│   ├── registro.ejs          # Página de registro
│   ├── configuracao-inicial.ejs
│   ├── dashboard.ejs         # Dashboard principal
│   ├── rendas.ejs            # Gerenciar rendas
│   ├── despesas.ejs          # Gerenciar despesas
│   ├── metas.ejs             # Acompanhar metas
│   └── configuracoes.ejs     # Configurações
├── .env                      # Variáveis de ambiente
├── .gitignore
├── package.json
├── server.js                 # Servidor Express
└── README.md
```

## 🔒 Segurança

- Senhas são criptografadas com bcrypt
- Sessões protegidas com express-session
- Autenticação obrigatória para todas as páginas (exceto login/registro)

## 🎯 Próximas Melhorias

- [ ] Gráficos interativos com Chart.js
- [ ] Exportação de relatórios em PDF
- [ ] Categorias personalizadas de despesas
- [ ] Múltiplas metas financeiras
- [ ] Notificações e lembretes
- [ ] App mobile (React Native)

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique se todas as dependências foram instaladas
2. Certifique-se que a porta 3000 está disponível
3. Verifique os logs do servidor no console

## 📄 Licença

MIT License - Sinta-se livre para usar e modificar!

---

**Desenvolvido com ❤️ para ajudar você a conquistar sua liberdade financeira!**

🚀 **Comece hoje mesmo e transforme sua vida financeira!**

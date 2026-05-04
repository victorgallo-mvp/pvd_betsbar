# Prompt para Claude Code — Sistema PDV (v2 final)

## Contexto

Vou construir um PDV (Ponto de Venda) para bar/restaurante inspirado em um sistema de referência (Mafra PDV). Material anexado :

- **10 imagens** numeradas mostrando as principais telas
- **4 transcrições de narração** dos vídeos de demonstração (`.txt` na pasta `transcricoes/`)

**Importante:** as referências são apenas pra entender UX e fluxos. O código será 100% original — sem logos, marca ou paleta de cores do sistema de referência.

---

## Stack definida

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Zustand (estado) + React Router
- **PWA:** configurar como Progressive Web App pra instalar no tablet como ícone na home
- **Backend:** Node.js + Fastify + TypeScript
- **ORM/DB:** Prisma + SQLite (com schema preparado pra migrar pra Postgres depois)
- **Real-time:** WebSocket via `@fastify/websocket` pra sincronizar status de mesa entre tablet/maquininha
- **Impressão térmica:** `node-thermal-printer` (ESC/POS) com fallback HTML imprimível
- **Validação:** Zod (schemas compartilhados front/back)
- **Estrutura:** monorepo simples com pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`)

---

## Visão geral do sistema

PDV pra estabelecimentos com atendimento de mesa (bar/restaurante/petiscaria). Roda em:

- **Tablet Android** (1024x600 horizontal) — caixa principal e gerência
- **POS portátil estilo Stone** (480x854 vertical) — atendimento na mesa pelo garçom

Com 3 modos de venda **com fluxos diferentes**:

| Modo | Quando usar | Pagamento | Impressão |
|------|-------------|-----------|-----------|
| **Mesa** | Cliente senta, pede ao longo do tempo | Depois (pede a conta) | No fim |
| **Balcão/Ficha** | Venda direta no balcão | Imediato | **Só após confirmar pagamento** |
| **Delivery** | Pedido pra entrega | Antes (pix/online) ou na entrega | Conforme regra |

---

## Os 4 fluxos transcritos das demos

### 🟦 FLUXO 1 — Venda em Mesa (completo)

> Transcrição: *"Veja como é fácil operar o módulo Mesa do PDV Mafra."*

**Abertura:**
1. Tela principal → toque em **"Venda"**
2. Digita senha do operador (PIN numérico)
3. Toca em **"Mesa"**
4. Digita número da mesa → **OK**

**Lançamento de itens:**
5. Seleciona categoria (grid de 8: Favoritos, Fichas, Espetos, Porções, Bebidas, Pastelaria, Cervejas/Chopps, Burguer)
6. Toca nos produtos conforme escolha do cliente
7. Itens entram na lista lateral com qty/preço/subtotal e marca de "enviado pra produção" (✓)
8. Toca em **"Concluir"** → envia pra cozinha/produção

**Visão geral das mesas — UX crucial:**
> *"Você pode notar que tem uma mesa com o status em amarelo. É uma mesa que já pediu conta. Isso facilita na hora de escolher qual mesa eu vou fechar. Te dá uma nuance de como tá a movimentação da casa."*

**Cores de status de mesa:**
- ⚪ **Cinza/branco** — mesa livre
- 🟢 **Verde** — mesa aberta, atendendo
- 🟡 **Amarelo** — mesa pediu conta, aguardando pagamento

Implementar como **prioridade alta** — é a "visão de calor" do salão pro gerente.

**Pedido de conta:**
9. Toca na mesa → toca em **"Conta"**
10. Digita **quantidade de pessoas**
11. Sistema **divide o total automaticamente** pelo número de pessoas (mostra `perPersonAmount`)
12. Mesa fica **AMARELA** ("encerrada, aguardando pagamento")

**Recebimento:**
13. Toca de novo na mesa amarela → vai **direto pra tela de pagamento** (não passa pela comanda)
14. Seleciona forma (Dinheiro, Débito, Crédito, Pix)
15. **OK** → mesa finalizada, volta a ficar livre

### 🟦 FLUXO 2 — Mesa (versão resumida)

> Transcrição curta (35s): mesma abertura → lançamento → "Concluir"

Confirma o fluxo curto sem a parte de pagamento. Útil pra entender que **o operador pode adicionar itens em vários momentos** ao longo da estadia do cliente sem precisar fechar.

### 🟦 FLUXO 3 — Recebimento de pagamento

> Transcrição: *"Veja como é simples receber um pagamento no módulo de mesa do PDV Mafra."*

Versão focada do fechamento:
1. Selecionar mesa → ver **resumo** dos itens
2. Tocar em **"Conta"** → informar nº de pessoas → divisão automática
3. Voltar ao módulo de mesa → mesa já tá amarela
4. Tocar na mesa → tela de pagamento abre direto
5. Selecionar método → **OK** → finalizado

### 🟧 FLUXO 4 — Venda de Ficha / Balcão

> Transcrição: *"Veja como é fácil a venda de ficha no PDV Mafra."*

Fluxo **mais curto** (sem comanda longa, sem mesa):

1. Tela principal → **"Venda"** → senha do operador
2. Seleciona produtos diretamente → **"Pagar"**
3. Tela de pagamento → seleciona forma → **conclui**
4. Volta pra tela → toca **"Pagar"** novamente (confirmação)
5. **Diálogo aparece:** "Imprimir / Não Imprimir" + **Confirmar**
6. **REGRA DE NEGÓCIO CRÍTICA:** *"Ele só vai imprimir as fichas APÓS o recebimento dos valores do cliente"*
   - A impressão é o **comprovante/ficha** que o cliente leva pra retirar produto
   - Não imprime nada antes do dinheiro entrar (controle anti-fraude)

---

## Regras de negócio importantes (extraídas das demos)

1. **Divisão de conta** — quando operador pede "Conta", sistema divide `total / peopleCount` e armazena `perPersonAmount`
2. **Mesa amarela = aguardando pagamento** — uma vez nesse estado, tocar nela vai direto pra pagamento
3. **Modo Ficha (balcão) só imprime APÓS recebimento** — fila de impressão tem trigger específico
4. **Diálogo Imprimir/Não Imprimir é opcional** — operador escolhe se gera cupom (cliente nem sempre quer)
5. **Itens enviados pra produção** ganham marca ✓ — cancelar item já enviado precisa de ação especial
6. **Operador autentica com PIN a cada início de venda** — segurança em ambiente compartilhado entre garçons
7. **Atalhos de cédula** ($50, $20, $10, $5) na tela de pagamento agilizam quando cliente paga em dinheiro

---

## Telas e referências visuais

| # | Imagem | Tela |
|---|--------|------|
| 01 | `01_modos_venda_balcao_delivery.jpg` | Seleção de modo (+Funções, Balcão, Delivery, Mesas) |
| 02 | `02_informe_mesa_keypad.jpg` | Informe Mesa: cards de mesas abertas + keypad |
| 03 | `03_comanda_itens_categorias.jpg` | Comanda com itens + grid de 8 categorias |
| 04 | `04_pagamento_cedulas_metodos.jpg` | Pagamento tablet: keypad, cédulas, métodos |
| 05 | `05_menu_principal_dashboard.jpg` | Menu principal (9 cards) |
| 06 | `06_login_pin.jpg` | Login com PIN |
| 07 | `07_comanda_3itens_categorias_completo.jpg` | Comanda com 3 itens + ações inferiores |
| 08 | `08_pos_stone_pagamento_mais_metodos.jpg` | POS Stone: pagamento (formas extras: VOUCHER, CONTA RECEITA) |
| 09 | `09_pos_stone_dialog_imprimir.jpg` | POS Stone: diálogo Imprimir/Não Imprimir |
| 10 | `10_pos_stone_cupom_impresso.jpg` | POS Stone: cupom térmico + QR code |

**Categorias de produto observadas:** Favoritos, Fichas, Espetos, Porções, Bebidas, Pastelaria, Cervejas/Chopps, Burguer

**Cards de mesa abertas mostram:** número grande + tempo decorrido (ex: "Mesa 8 — 6d 23h 25m")

**Ações da comanda (barra inferior):** Conta, Cancelar Venda, Fechar/Pagar, Quantidade, Transferir, Concluir

**Menu principal (9 cards):** Venda, Fundo de Caixa, Encerrar, Sangria, Cadastro, Relatório, Configurar, Consulta, Sair

---

## Modelo de dados (Prisma schema inicial)

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  pin       String   // hash bcrypt
  role      String   // 'admin' | 'operator' | 'waiter'
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  sales     Sale[]
  cashSessions CashSession[]
}

model Category {
  id           String    @id @default(cuid())
  name         String
  color        String    // hex
  icon         String    // nome do ícone (lucide)
  displayOrder Int
  active       Boolean   @default(true)
  products     Product[]
}

model Product {
  id         String   @id @default(cuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  name       String
  price      Decimal
  isFavorite Boolean  @default(false)
  active     Boolean  @default(true)
  saleItems  SaleItem[]
}

model Table {
  id          String   @id @default(cuid())
  number      Int      @unique
  status      String   // 'free' | 'open' | 'awaiting_payment'
  openedAt    DateTime?
  peopleCount Int?
  sales       Sale[]
}

model Sale {
  id              String    @id @default(cuid())
  type            String    // 'table' | 'counter' | 'delivery'
  tableId         String?
  table           Table?    @relation(fields: [tableId], references: [id])
  peopleCount     Int?
  openedAt        DateTime  @default(now())
  closedAt        DateTime?
  operatorId      String
  operator        User      @relation(fields: [operatorId], references: [id])
  status          String    // 'open' | 'awaiting_payment' | 'paid' | 'cancelled'
  subtotal        Decimal   @default(0)
  discount        Decimal   @default(0)
  surcharge       Decimal   @default(0)
  total           Decimal   @default(0)
  perPersonAmount Decimal?
  customerName    String?   // delivery
  customerAddress String?   // delivery
  items           SaleItem[]
  payments        Payment[]
  printJobs       PrintJob[]
}

model SaleItem {
  id               String   @id @default(cuid())
  saleId           String
  sale             Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId        String
  product          Product  @relation(fields: [productId], references: [id])
  qty              Int
  unitPrice        Decimal  // snapshot no momento da venda
  sentToProduction Boolean  @default(false)
  cancelled        Boolean  @default(false)
  createdAt        DateTime @default(now())
}

model Payment {
  id     String   @id @default(cuid())
  saleId String
  sale   Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  method String   // 'cash' | 'debit' | 'credit' | 'pix' | 'voucher' | 'conta_receita'
  amount Decimal
  paidAt DateTime @default(now())
}

model CashSession {
  id           String    @id @default(cuid())
  operatorId   String
  operator     User      @relation(fields: [operatorId], references: [id])
  openedAt     DateTime  @default(now())
  closedAt     DateTime?
  openingFund  Decimal
  total        Decimal?
  withdrawals  Withdrawal[]
}

model Withdrawal {
  id            String      @id @default(cuid())
  cashSessionId String
  cashSession   CashSession @relation(fields: [cashSessionId], references: [id])
  amount        Decimal
  reason        String      // sangria
  createdAt     DateTime    @default(now())
}

model PrintJob {
  id            String   @id @default(cuid())
  saleId        String
  sale          Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  type          String   // 'kitchen' | 'receipt' | 'fiche'
  status        String   // 'pending' | 'printed' | 'skipped'
  triggerEvent  String   // 'item_added' | 'payment_confirmed'
  payload       String   // JSON com dados pra impressão
  printedAt     DateTime?
  createdAt     DateTime @default(now())
}
```

---

## Estrutura de pastas (monorepo)

```
pdv/
├── apps/
│   ├── web/                  # React + Vite (PWA)
│   │   ├── src/
│   │   │   ├── pages/        # Login, MenuPrincipal, MesaSelector, Comanda, Pagamento, Caixa, Cadastro
│   │   │   ├── components/   # CategoryGrid, ItemList, NumericKeypad, MesaCard, PaymentMethods
│   │   │   ├── stores/       # Zustand: useAuth, useSale, useTables
│   │   │   ├── hooks/        # useWebSocket, useApi
│   │   │   └── lib/
│   │   └── vite.config.ts
│   └── api/                  # Fastify + Prisma
│       ├── src/
│       │   ├── routes/       # /auth, /tables, /sales, /products, /cash, /print
│       │   ├── services/     # SaleService, PrintService, CashService
│       │   ├── ws/           # WebSocket handlers (broadcast de status de mesa)
│       │   └── prisma/
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
├── packages/
│   └── shared/               # tipos TypeScript + schemas Zod compartilhados
│       └── src/
│           ├── types.ts
│           └── schemas.ts
├── pnpm-workspace.yaml
└── package.json
```

---

## Ordem de implementação (passo a passo)

Vai com calma, **um passo de cada vez**, me mostrando o que tá criando antes de seguir pro próximo:

### Fase 1 — Fundação
1. Setup do monorepo (pnpm workspaces, tsconfig base, eslint, prettier)
2. Schema Prisma + migration inicial + seed com:
   - 1 admin (PIN: 1234) e 2 operadores
   - 8 categorias com cores/ícones
   - 20-30 produtos de exemplo (cervejas, espetos, porções, bebidas, fichas)
   - 20 mesas
3. API base com Fastify (health check + auth com PIN)
4. Frontend base com PWA + roteamento + tela de Login PIN

### Fase 2 — Núcleo (Fluxo Mesa)
5. API: CRUD de mesas + listar com status
6. Frontend: tela "Informe Mesa" com keypad e cards de mesas abertas
7. WebSocket: broadcast de mudança de status de mesa (multi-dispositivo)
8. API: abrir comanda, adicionar item, listar produtos por categoria
9. Frontend: tela Comanda (split layout, grid de categorias, lista de itens)
10. API: pedir conta (calcula `perPersonAmount`, muda status pra `awaiting_payment`)
11. API: registrar pagamento (suporta múltiplos métodos numa mesma venda)
12. Frontend: tela de Pagamento (keypad, cédulas, métodos, confirmação)

### Fase 3 — Outros modos
13. Fluxo Balcão/Ficha (sem mesa, com diálogo imprimir/não imprimir)
14. **PrintService** com regra: ficha só dispara após `payment_confirmed`
15. Fluxo Delivery (com cliente/endereço)

### Fase 4 — Caixa e gestão
16. Fundo de Caixa (abertura de sessão)
17. Sangria (retirada)
18. Encerrar caixa (fechamento + relatório do dia)

### Fase 5 — Cadastros e relatórios
19. CRUD de produtos, categorias, mesas, usuários (tela Cadastro)
20. Relatórios: vendas por período, por produto, por forma de pagamento, por operador

### Fase 6 — Polish
21. Layout responsivo pro POS portátil (vertical 480x854)
22. Configurações de impressora
23. Empacotamento PWA final + ícones + manifest

---

## Antes de começar a codar

Por favor:

1. Confirma a estrutura proposta (ou sugere ajustes)
2. Mostra o `package.json` do root + `pnpm-workspace.yaml` que vai criar
3. Cria a Fase 1 inteira e me mostra o resultado pra eu validar antes de seguir pra Fase 2
4. Em cada arquivo novo, **explica brevemente** o que faz e por quê (estou aprendendo a stack)
5. Quando tiver decisões com mais de uma forma boa de fazer, **me apresenta as opções** em vez de escolher sozinho

Vamos começar pela **Fase 1**. Boa, manda ver! 🚀

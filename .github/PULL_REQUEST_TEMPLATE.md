# Descrição do PR

## 🎯 Contexto e Valor
<!-- Descreva sucintamente a jornada de usuário resolvida e o valor de negócio/impacto entregue -->

**Issue Relacionado:** Closes #<issue_number> / Beads ID: <beads_id>

---

## 🛠️ Mudanças Realizadas

<!-- Descreva as alterações técnicas agrupadas de forma lógica e hierárquica por componente -->

### 💾 1. Banco de Dados (DDL & Migrações)
* [Ex: Adicionada tabela `workspace_members` em `apps/api/migrations/...sql`]

### ⚙️ 2. Backend (Rust & Axum)
* [Ex: Adicionado endpoint `POST /api/workspaces` em `apps/api/src/handlers/auth.rs`]

### 🖥️ 3. Frontend (SolidJS & DESIGN.md)
* [Ex: Atualizados tokens de design e implementado modal de criação em `apps/web/src/components/...tsx`]

---

## 📸 Provas Visuais (UI/UX)
<!-- Inclua screenshots ou GIFs demonstrando a mudança visual (especialmente fluxos interativos de loading, erro, vazio e sucesso) -->

| Antes | Depois |
| :---: | :---: |
| [Screenshot antigo] | [Screenshot/GIF demonstrando o novo fluxo interativo] |

---

## 🧪 Suíte de Testes Executada (Logs de Saída)

### Testes Backend (Rust Cargo)
```bash
# Cole aqui os logs de sucesso da execução de testes em Rust (cargo test)
```

### Testes Frontend & E2E (Vitest / Playwright)
```bash
# Cole aqui os logs de sucesso dos testes do SolidJS (Vitest) e testes E2E (Playwright)
```

---

## 🔒 Relatórios de Auditoria de IA (Quality Gates)
* **Segurança (`@security`):** [PASS / PENDING] (Sanitização de entradas, validação de cookies de sessão, controle de tenants)
* **Confiabilidade (`@sre`):** [PASS / PENDING] (Análise de concorrência, row locks pessimistas, índices de banco de dados, observabilidade)
* **Conformidade (`@legal-counsel`):** [PASS / PENDING] (Auditoria de licenças de terceiros via `license-audit`)

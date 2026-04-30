# 💳 Controle de Pagamentos

Sistema web para gerenciamento de clientes, vendas e controle de parcelas.

---

## 🚀 Funcionalidades

* ✅ Cadastro de clientes
* 💰 Controle de valor total e desconto
* 📆 Criação de parcelas personalizadas
* 🔍 Busca por nome (com normalização de acentos)
* 📊 Filtro por status:

  * Em atraso
  * Em aberto
  * Quitados
* 📱 Layout responsivo (mobile + desktop)
* 🔒 Bloqueio de scroll ao abrir modal
* 🔄 Atualização automática da lista após cadastro

---

## 🛠️ Tecnologias utilizadas

### Frontend

* React
* TypeScript
* Axios

### Backend

* Node.js
* Express
* MongoDB (Mongoose)

---

## 📂 Estrutura do projeto

```
src/
 ├── components/
 │    └── ClientsTable/
 ├── utils/
 │    └── FormatCurrency.ts
 ├── services/
 │    └── api.ts
```

---

## ⚙️ Como rodar o projeto

### 1️⃣ Clone o repositório

```bash
git clone https://github.com/seu-usuario/seu-repo.git
```

---

### 2️⃣ Instale as dependências

```bash
yarn
# ou
npm install
```

---

### 3️⃣ Inicie o projeto

```bash
yarn dev
# ou
npm run dev
```

---

## 🌐 API

O frontend consome a API em:

```
http://10.0.0.110:3000
```

### Rotas utilizadas:

| Método | Rota     | Descrição          |
| ------ | -------- | ------------------ |
| GET    | /clients | Listar clientes    |
| POST   | /client  | Criar novo cliente |

---

## 🧠 Regras de negócio

* A soma das parcelas deve ser igual ao valor total
* Parcelas sem data de pagamento são consideradas "em aberto"
* Parcelas vencidas sem pagamento são consideradas "em atraso"

---

## 📸 Preview

*(adicione aqui prints do seu projeto)*

---

## ✨ Melhorias futuras

* [ ] Edição de cliente
* [ ] Exclusão de cliente
* [ ] Paginação
* [ ] Dashboard com gráficos
* [ ] Autenticação (JWT)

---

## 👨‍💻 Autor

Desenvolvido por **Everton Lino**

---

## 📄 Licença

Este projeto está sob a licença MIT.

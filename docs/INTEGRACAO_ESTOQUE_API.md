# 📡 Documentação Técnica: API de Integração de Estoque (Zeiq)

Esta documentação destina-se à equipe técnica responsável pelo **ERP / Sistema de Gestão de Estoque**.

A API permite que o seu sistema envie atualizações de estoque (em lote ou item a item) diretamente para o catálogo, identificando os produtos por **SKU** ou **EAN** e suportando tanto **grade de vestuário (tamanhos)** quanto **produtos simples/acessórios**.

---

## 1. Informações Gerais do Endpoint

* **URL Base (Produção):** `https://seu-dominio.com.br/api/integrations/stock` *(ou `http://localhost:3000/api/integrations/stock` em ambiente local)*
* **Método HTTP:** `PUT` *(também aceita `POST`)*
* **Formato dos Dados:** `JSON` (UTF-8)

### Autenticação (Headers Obrigatórios)
Todas as chamadas devem incluir o header `x-api-key` ou `Authorization: Bearer <token>`.

```http
Content-Type: application/json
x-api-key: SUA_CHAVE_DE_INTEGRACAO
```

*(A chave secreta padrão configurada é: `zeiq_stock_sec_8f9a2b4c6e1d3f5a7b9c0e2d4f6a8b1c`)*.

---

## 2. Teste Rápido com SKU Real Cadastrado

Para validar a integração de imediato no ambiente de vocês, utilizem o método **`PUT`** nos exemplos abaixo:

### Exemplo A: Produto com Grade de Vestuário
* **SKU Real:** `0214.013` *(Camiseta Masculina AC Zeiq Branca Mármore)*
* **Tamanhos suportados:** `PP`, `P`, `M`, `G`, `GG`, `XG`

```bash
curl -X PUT "https://seu-dominio.com.br/api/integrations/stock" \
  -H "Content-Type: application/json" \
  -H "x-api-key: zeiq_stock_sec_8f9a2b4c6e1d3f5a7b9c0e2d4f6a8b1c" \
  -d '{
    "sku": "0214.013",
    "stock_by_size": {
      "PP": 2,
      "P": 10,
      "M": 15,
      "G": 8,
      "GG": 4,
      "XG": 1
    }
  }'
```

**Retorno de Sucesso (`HTTP 200 OK`):**
```json
{
  "success": true,
  "summary": {
    "total_received": 1,
    "updated": 1,
    "errors_count": 0
  },
  "results": [
    {
      "identifier": "0214.013",
      "product_name": "0214.013 - Camiseta Masculina AC Zeiq Branca Mármore",
      "status": "updated",
      "total_stock": 40,
      "stock_by_size": {
        "PP": 2,
        "P": 10,
        "M": 15,
        "G": 8,
        "GG": 4,
        "XG": 1
      }
    }
  ]
}
```

---

### Exemplo B: Produto Simples / Sem Grade (Acessórios, Redes, Bolas)
* **SKU Real:** `5001.003` *(Rede para Beach Tennis)*

```bash
curl -X PUT "https://seu-dominio.com.br/api/integrations/stock" \
  -H "Content-Type: application/json" \
  -H "x-api-key: zeiq_stock_sec_8f9a2b4c6e1d3f5a7b9c0e2d4f6a8b1c" \
  -d '{
    "sku": "5001.003",
    "quantity": 25
  }'
```

**Retorno de Sucesso (`HTTP 200 OK`):**
```json
{
  "success": true,
  "summary": {
    "total_received": 1,
    "updated": 1,
    "errors_count": 0
  },
  "results": [
    {
      "identifier": "5001.003",
      "product_name": "5001.003 - Rede para Beach Tennis",
      "status": "updated",
      "total_stock": 25,
      "stock_by_size": {
        "_padrao": 25
      }
    }
  ]
}
```

---

## 3. Teste de Conexão (Health Check)

Para verificar se a API está online e se a sua chave de autenticação é válida, você pode realizar uma requisição `GET`:

```bash
curl -X GET "https://seu-dominio.com.br/api/integrations/stock" \
  -H "x-api-key: SUA_CHAVE_DE_INTEGRACAO"
```

**Resposta esperada (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "API de Integração de Estoque Zeiq ativa e operacional.",
  "supported_methods": ["PUT", "POST", "GET"],
  "supported_identifiers": ["sku", "code_sku", "ean"],
  "timestamp": "2026-03-30T15:00:00.000Z"
}
```

---

## 4. Estrutura do Payload (`PUT`)

A API aceita os dados em lote através de um objeto com a chave `items`, um array direto ou um único objeto. O limite recomendado por requisição é de até **500 itens**.

```json
{
  "items": [
    ...
  ]
}
```

### Chaves de Identificação do Produto:
* `sku` ou `code_sku`: Código de referência do produto cadastrado no catálogo (ex.: `"0214.013"`).
* `ean`: Código de barras EAN-13/GTIN do produto (ex.: `"7891234567890"`).

---

## 5. Os 3 Formatos Suportados por Item

### Formato A: Grade Completa (Vestuário / Calçados) - Recomendado
Atualiza todos os tamanhos de uma vez. O total do produto será recalculado automaticamente com a soma de todos os tamanhos.

```json
{
  "sku": "0214.013",
  "stock_by_size": {
    "PP": 0,
    "P": 10,
    "M": 15,
    "G": 8,
    "GG": 4,
    "XG": 2
  }
}
```

---

### Formato B: Variação Pontual (Apenas 1 tamanho)
Atualiza apenas o tamanho informado, mantendo as quantidades dos outros tamanhos inalteradas no catálogo.

```json
{
  "sku": "0214.013",
  "size": "M",
  "quantity": 20
}
```

*Também aceita o formato com hífen no SKU:*
```json
{
  "sku": "0214.013-M",
  "quantity": 20
}
```

---

### Formato C: Produto Simples / Acessórios (Sem Tamanho)
Para raquetes, bolas, óculos, garrafas e acessórios. Pode ser identificado por `sku` ou `ean`.

```json
{
  "sku": "MG5003.001",
  "quantity": 120
}
```
*ou via código de barras (EAN):*
```json
{
  "ean": "7898912345678",
  "quantity": 120
}
```

---

## 6. Exemplo Completo de Requisição (Lote Misto)

```bash
curl -X PUT "https://seu-dominio.com.br/api/integrations/stock" \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE_DE_INTEGRACAO" \
  -d '{
    "items": [
      {
        "sku": "0214.013",
        "stock_by_size": {
          "PP": 2,
          "P": 8,
          "M": 14,
          "G": 10,
          "GG": 3
        }
      },
      {
        "sku": "0214.010",
        "size": "G",
        "quantity": 15
      },
      {
        "ean": "7891234567890",
        "quantity": 80
      }
    ]
  }'
```

---

## 7. Estrutura de Retorno (Respostas da API)

### Sucesso Total (`HTTP 200 OK`)
```json
{
  "success": true,
  "summary": {
    "total_received": 3,
    "updated": 3,
    "errors_count": 0
  },
  "results": [
    {
      "identifier": "0214.013",
      "product_name": "0214.013 - Camiseta Masculina AC Zeiq Branca Mármore",
      "status": "updated",
      "total_stock": 37,
      "stock_by_size": {
        "PP": 2,
        "P": 8,
        "M": 14,
        "G": 10,
        "GG": 3
      }
    },
    {
      "identifier": "0214.010",
      "product_name": "0214.010 - Camiseta Masculina Advanced Zeiq Sky Blue",
      "status": "updated",
      "total_stock": 42,
      "stock_by_size": {
        "PP": 5,
        "P": 12,
        "M": 10,
        "G": 15
      }
    },
    {
      "identifier": "7891234567890",
      "product_name": "MG5003.001 - Bola para Beach Tennis Zeiq",
      "status": "updated",
      "total_stock": 80,
      "stock_by_size": {
        "_padrao": 80
      }
    }
  ]
}
```

### Sucesso Parcial (com itens não encontrados) (`HTTP 200 OK`)
Caso algum produto não seja localizado no catálogo, a API não interrompe a operação dos demais itens e retorna o detalhe individual:

```json
{
  "success": true,
  "summary": {
    "total_received": 2,
    "updated": 1,
    "errors_count": 1
  },
  "results": [
    {
      "identifier": "0214.013",
      "product_name": "0214.013 - Camiseta Masculina AC Zeiq",
      "status": "updated",
      "total_stock": 37
    },
    {
      "identifier": "SKU-INEXISTENTE",
      "status": "not_found",
      "message": "Produto com identificador \"SKU-INEXISTENTE\" não foi localizado no catálogo."
    }
  ]
}
```

### Erro de Autenticação (`HTTP 401 Unauthorized`)
```json
{
  "success": false,
  "error": "Não autorizado. Envie a chave de API correta no header \"x-api-key\" ou \"Authorization: Bearer <key>\"."
}
```

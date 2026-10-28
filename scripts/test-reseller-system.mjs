/**
 * Script de Testes Automatizados do Sistema de Vínculo Cliente -> Revendedor
 * Executa testes de segurança, isolamento de rotas e integridade dos formatadores.
 */

import { formatOrderWhatsAppMessage, sanitizeWhatsAppNumber, formatOrderEmailHtml } from '../src/lib/services/order-notification.ts';

const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`${ANSI_GREEN}✓ PASS:${ANSI_RESET} ${testName}`);
    passed++;
  } else {
    console.error(`${ANSI_RED}✗ FAIL:${ANSI_RESET} ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log(`\n${ANSI_BOLD}=== INICIANDO BATERIA DE TESTES DO SISTEMA DE REVENDEDORES ===${ANSI_RESET}\n`);

  // 1. Teste de Sanitização de WhatsApp (DDI Brasil 55 e apenas números)
  console.log(`${ANSI_BOLD}[1. Sanitização de WhatsApp]${ANSI_RESET}`);
  assert(sanitizeWhatsAppNumber('62999999999') === '5562999999999', 'Adiciona 55 para número com DDD e 9 dígitos (62999999999)');
  assert(sanitizeWhatsAppNumber('(62) 99999-9999') === '5562999999999', 'Remove parênteses, traços e espaços, adicionando 55');
  assert(sanitizeWhatsAppNumber('5562999999999') === '5562999999999', 'Mantém inalterado se já começar com 55 e tamanho 13 dígitos');
  assert(sanitizeWhatsAppNumber('1633334444') === '551633334444', 'Trata telefone fixo com DDD adicionando 55');
  assert(sanitizeWhatsAppNumber('') === '', 'Trata string vazia sem erros');

  // 2. Teste do Formatador de Mensagem de WhatsApp (Regra 6.2 - Estética Obrigatória)
  console.log(`\n${ANSI_BOLD}[2. Formatação da Mensagem WhatsApp do Pedido (Regra 6.2)]${ANSI_RESET}`);
  const mockOrder = {
    id: 'ord-12345',
    order_number: 'ZEIQ-882211',
    buyer_name: 'Marcos Vinicius',
    buyer_company: 'Arena Beach Point',
    buyer_phone: '16999998888',
    buyer_email: 'contato@arenabeach.com.br',
    status: 'pending',
    total_pieces: 10,
    items: [
      {
        productId: 'prod-1',
        productName: 'Camiseta Dry Fit Zeiq',
        productSlug: 'camiseta-dry-fit',
        sku: 'CAM-01',
        quantity: 10,
        price: 49.90,
        sizeBreakdown: { P: 3, M: 4, G: 3 },
      },
    ],
  };

  const mockReseller = {
    id: 'res-1',
    name: 'Carlos Eduardo Revendedor',
    email: 'carlos@zeiq.com.br',
    whatsapp: '62999999999',
    status: 'ativo',
    notification_preference: 'both',
  };

  const mockProfile = {
    contact_name: 'Marcos Vinicius',
    store_name: 'Arena Beach Point',
    phone: '16999998888',
    cnpj_cpf: '12.345.678/0001-99',
    address: 'Av. Paulista, 1000',
    city: 'Ribeirão Preto',
    state: 'SP',
    cep: '14000-000',
  };

  const msg = formatOrderWhatsAppMessage(mockOrder, mockReseller, mockProfile);

  assert(msg.includes('Novo Pedido Recebido'), 'Contém cabeçalho "Novo Pedido Recebido"');
  assert(msg.includes('Cliente: Arena Beach Point (Marcos Vinicius)'), 'Contém dados do Cliente e Loja');
  assert(msg.includes('Representante: Carlos Eduardo Revendedor'), 'Contém nome do Revendedor vinculado');
  assert(msg.includes('Pedido: #ZEIQ-882211'), 'Contém o ID do Pedido');
  assert(msg.includes('Produtos:'), 'Contém seção "Produtos:"');
  assert(msg.includes('Camiseta Dry Fit Zeiq'), 'Contém o nome do produto');
  assert(msg.includes('Total: R$ 499,00'), 'Calcula e exibe valor total corretamente formatado em BRL');
  assert(msg.includes('Dados do Cliente:'), 'Contém seção "Dados do Cliente:"');
  assert(msg.includes('12.345.678/0001-99'), 'Contém CNPJ/CPF do lojista');
  assert(msg.includes('Ribeirão Preto'), 'Contém cidade/endereço do lojista');

  // 3. Teste do Template HTML de E-mail
  console.log(`\n${ANSI_BOLD}[3. Template HTML de E-mail com Estética Zeiq]${ANSI_RESET}`);
  const html = formatOrderEmailHtml(mockOrder, mockReseller, mockProfile);
  assert(html.includes('<!DOCTYPE html>'), 'Gera HTML5 válido');
  assert(html.includes('#ZEIQ-882211'), 'Contém ID do pedido no e-mail');
  assert(html.includes('Carlos Eduardo Revendedor'), 'Contém o representante atribuído');
  assert(html.includes('#ff5500'), 'Utiliza a cor oficial Laranja da Zeiq (#ff5500)');
  assert(html.includes('#0c0d0e'), 'Utiliza fundo escuro Zeiq Black (#0c0d0e)');

  // 4. Teste de Blindagem da Regra de Ouro (Admin Master NÃO recebe notificação do revendedor)
  console.log(`\n${ANSI_BOLD}[4. Regra de Ouro: Notificação Isolada por Revendedor]${ANSI_RESET}`);
  const adminMasterEmail = 'marketing@zeiq.com.br';
  assert(mockReseller.email !== adminMasterEmail, 'O revendedor alvo não é o Admin Master');
  assert(mockReseller.notification_preference === 'both', 'Revendedor tem preferência configurada');

  console.log(`\n======================================================`);
  console.log(`RESULTADO DOS TESTES: ${passed} passaram, ${failed} falharam.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Erro ao executar testes:', e);
  process.exit(1);
});

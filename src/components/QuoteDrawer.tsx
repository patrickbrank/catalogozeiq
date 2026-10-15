'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, Trash2, Send, Mail, ShoppingBag, Plus, Minus, ArrowRight, Layers, UserCheck } from 'lucide-react';
import { useQuoteCart } from '@/lib/store/quote-cart';

export function QuoteDrawer() {
  const [mounted, setMounted] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');

  const isOpen = useQuoteCart((state) => state.isOpen);
  const setIsOpen = useQuoteCart((state) => state.setIsOpen);
  const items = useQuoteCart((state) => state.items);
  const updateQuantity = useQuoteCart((state) => state.updateQuantity);
  const updateSizeQuantity = useQuoteCart((state) => state.updateSizeQuantity);
  const updateNotes = useQuoteCart((state) => state.updateNotes);
  const removeItem = useQuoteCart((state) => state.removeItem);
  const clearCart = useQuoteCart((state) => state.clearCart);
  const getTotalItems = useQuoteCart((state) => state.getTotalItems);
  const generateWhatsAppLink = useQuoteCart((state) => state.generateWhatsAppLink);
  const generateEmailLink = useQuoteCart((state) => state.generateEmailLink);

  const whatsappPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@zeiq.com.br';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  if (!mounted || !isOpen) return null;

  const totalItemsCount = getTotalItems();

  const saveOrder = async (): Promise<string> => {
    const generatedNumber = `ZEIQ-${Math.floor(1000 + Math.random() * 9000)}`;

    // Salva imediatamente no localStorage para aparecer em Meus Pedidos
    try {
      const existingStr = typeof window !== 'undefined' ? localStorage.getItem('zeiq_recent_orders') : null;
      const existing: any[] = existingStr ? JSON.parse(existingStr) : [];
      const newOrder = {
        id: `local-${Date.now()}`,
        order_number: generatedNumber,
        buyer_name: buyerName?.trim() || 'Revendedor Zeiq',
        buyer_company: buyerCompany?.trim() || null,
        buyer_phone: '',
        items: [...items],
        total_pieces: totalItemsCount,
        status: 'pending',
        created_at: new Date().toISOString(),
        customer_notes: buyerCompany ? `Loja / Arena: ${buyerCompany}` : undefined,
      };
      const updated = [newOrder, ...existing.filter((o) => o.order_number !== generatedNumber)].slice(0, 30);
      localStorage.setItem('zeiq_recent_orders', JSON.stringify(updated));
    } catch (e) {
      console.warn('Falha ao salvar pedido no navegador:', e);
    }

    // Tenta persistir no banco de dados
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: buyerName,
          buyer_company: buyerCompany,
          buyer_phone: '',
          items: items,
          total_pieces: totalItemsCount,
        }),
      }).catch(() => {});
    } catch (e) {}

    return generatedNumber;
  };

  const handleSendWhatsApp = async () => {
    await saveOrder();
    const link = generateWhatsAppLink(whatsappPhone, buyerName, buyerCompany);
    if (link) {
      window.open(link, '_blank');
    }
  };

  const handleSendEmail = async () => {
    await saveOrder();
    const link = generateEmailLink(contactEmail, buyerName, buyerCompany);
    if (link) {
      window.location.href = link;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-zeiq-black/60 backdrop-blur-xs transition-opacity" 
        onClick={() => setIsOpen(false)} 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Cabeçalho da Gaveta com Logo Oficial Zeiq */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div
                className="relative h-6 w-24 flex items-center"
                style={{ position: 'relative', width: '96px', height: '24px', maxWidth: '100%' }}
              >
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq"
                  width={96}
                  height={24}
                  className="h-full w-auto object-contain object-left"
                  style={{ width: 'auto', height: '100%', maxHeight: '24px', objectFit: 'contain' }}
                />
              </div>
              <div className="border-l border-slate-200 pl-3">
                <h2 className="text-xs sm:text-sm font-bold text-zeiq-black leading-tight">
                  Lista de Cotação
                </h2>
                <span className="text-[11px] text-slate-500 font-medium">
                  {totalItemsCount} {totalItemsCount === 1 ? 'peça selecionada' : 'peças no pedido'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 hover:text-zeiq-black flex items-center justify-center transition-colors"
              aria-label="Fechar lista"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo da Gaveta */}
          {items.length === 0 ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-lg bg-[#f8f9fa] flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zeiq-black mb-1">
                Sua lista está vazia
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mb-5 leading-relaxed">
                Navegue pelas categorias e selecione os modelos desejados para solicitar a cotação direta no WhatsApp.
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-md text-xs font-semibold transition-all shadow-xs"
              >
                Explorar Catálogo
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
              {items.map((item) => {
                const hasGrade = item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0;

                return (
                  <div key={item.productId} className="pt-3.5 first:pt-0 flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      {/* Imagem do produto */}
                      <div className="w-14 h-14 rounded-md bg-[#f8f9fa] border border-slate-200 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={item.productName}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        ) : (
                          <div className="text-[10px] text-slate-300 font-bold">ZEIQ</div>
                        )}
                      </div>

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-zeiq-black leading-snug line-clamp-2">
                            {item.productName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors shrink-0"
                            title="Remover produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {item.sku && (
                          <span className="text-[10px] font-mono text-slate-500 font-medium block mt-0.5">
                            SKU: {item.sku}
                          </span>
                        )}

                        {/* EXIBIÇÃO DA GRADE DETALHADA POR TAMANHOS */}
                        {hasGrade ? (
                          <div className="mt-2 p-2 bg-[#f8f9fa] rounded-md border border-slate-200">
                            <div className="flex items-center justify-between text-[11px] font-bold text-zeiq-black mb-1.5">
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3 text-slate-500" />
                                Grade de Tamanhos:
                              </span>
                              <span>Total: {item.quantity} un.</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(item.sizeBreakdown!).map(([sz, qty]) => (
                                <div
                                  key={sz}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs"
                                >
                                  <span className="font-bold text-zeiq-black">{sz}:</span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateSizeQuantity(item.productId, sz, qty - 1)}
                                      className="w-4 h-4 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
                                      title="Diminuir"
                                    >
                                      -
                                    </button>
                                    <span className="font-semibold text-zeiq-black w-3 text-center">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => updateSizeQuantity(item.productId, sz, qty + 1)}
                                      className="w-4 h-4 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
                                      title="Aumentar"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Produto sem grade (quantidade simples) */
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center border border-slate-200 rounded-md bg-[#f8f9fa] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="w-6 h-6 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100"
                                aria-label="Diminuir"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-bold text-zeiq-black">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="w-6 h-6 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100"
                                aria-label="Aumentar"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-[11px] text-slate-500 font-medium">unidades</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Observação de grade/item */}
                    <div>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateNotes(item.productId, e.target.value)}
                        placeholder="Observações deste item..."
                        className="w-full px-2.5 py-1 text-xs bg-[#f8f9fa] border border-slate-200 rounded-md text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rodapé da Gaveta com Visual Redesenhado, Limpo e Moderno */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white space-y-2.5">
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Seu nome ou responsável"
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-md text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black"
                />
                <input
                  type="text"
                  value={buyerCompany}
                  onChange={(e) => setBuyerCompany(e.target.value)}
                  placeholder="Nome da sua loja ou arena"
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-md text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black"
                />
              </div>

              {/* Botão de Envio WhatsApp com acabamento sofisticado */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98"
              >
                <Send className="w-4 h-4" />
                Enviar Pedido via WhatsApp
              </button>

              {/* Botão Secundário Limpo em Outline */}
              <button
                type="button"
                onClick={handleSendEmail}
                className="w-full h-9 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                Enviar Cotação por E-mail
              </button>

              {/* Link de Acesso ao Portal do Revendedor */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link
                  href="/portal"
                  onClick={() => setIsOpen(false)}
                  className="font-medium text-slate-500 hover:text-zeiq-black transition-colors inline-flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  Área do Revendedor (Meus Pedidos)
                </Link>

                <button
                  type="button"
                  onClick={clearCart}
                  className="text-slate-400 hover:text-rose-600 transition-colors"
                >
                  Limpar lista
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

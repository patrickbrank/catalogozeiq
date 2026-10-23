'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, Trash2, Send, Mail, ShoppingBag, Plus, Minus, ArrowRight, ArrowLeft, Layers, UserCheck } from 'lucide-react';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { createClient } from '@/lib/supabase/client';

export function QuoteDrawer() {
  const [mounted, setMounted] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [isEditingBuyer, setIsEditingBuyer] = useState(false);
  const [openNotesIds, setOpenNotesIds] = useState<Record<string, boolean>>({});

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

  const [whatsappPhone, setWhatsappPhone] = useState(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020');
  const [contactEmail, setContactEmail] = useState(process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@zeiq.com.br');

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const meta = user.user_metadata || {};
        if (meta.contact_name) setBuyerName(meta.contact_name);
        else if (user.email) setBuyerName(user.email.split('@')[0]);
        if (meta.store_name) setBuyerCompany(meta.store_name);
        if (meta.phone) setBuyerPhone(meta.phone);
      }
    });

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          if (data.settings.whatsappNumber) setWhatsappPhone(data.settings.whatsappNumber);
          if (data.settings.contactEmail) setContactEmail(data.settings.contactEmail);
        }
      })
      .catch(() => {});
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
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedNumber = `ZEIQ-${randomSuffix}`;

    // Salva imediatamente no localStorage para aparecer em Meus Pedidos
    try {
      const existingStr = typeof window !== 'undefined' ? localStorage.getItem('zeiq_recent_orders') : null;
      const existing: any[] = existingStr ? JSON.parse(existingStr) : [];
      const newOrder = {
        id: `local-${Date.now()}`,
        order_number: generatedNumber,
        buyer_name: buyerName?.trim() || 'Revendedor Zeiq',
        buyer_company: buyerCompany?.trim() || null,
        buyer_phone: buyerPhone?.trim() || '',
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
          order_number: generatedNumber,
          buyer_name: buyerName,
          buyer_company: buyerCompany,
          buyer_phone: buyerPhone,
          items: items,
          total_pieces: totalItemsCount,
        }),
      }).catch(() => {});
    } catch (e) {}

    return generatedNumber;
  };

  const handleSendWhatsApp = async () => {
    const orderNumber = await saveOrder();
    const link = generateWhatsAppLink(whatsappPhone, buyerName, buyerCompany, orderNumber, buyerPhone);
    if (link) {
      // Usa window.location.href para evitar bloqueador de popups em navegadores móveis (Safari iOS / Android)
      window.location.href = link;
    }
  };

  const handleSendEmail = async () => {
    const orderNumber = await saveOrder();
    const link = generateEmailLink(contactEmail, buyerName, buyerCompany, orderNumber, buyerPhone);
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

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 w-full sm:w-auto">
        <div className="w-full sm:w-screen sm:max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
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
                <span className="text-xs text-slate-500 font-medium">
                  {totalItemsCount} {totalItemsCount === 1 ? 'peça selecionada' : 'peças no pedido'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-zeiq-black text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Voltar para o catálogo"
            >
              <ArrowLeft className="w-4 h-4 text-zeiq-orange" />
              <span>Voltar</span>
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
                const cleanProductName = item.productName.replace(/^([A-Z0-9\.\-\_]+)\s*[-–—]\s*/i, '');

                return (
                  <div key={item.productId} className="pt-3.5 first:pt-0 flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      {/* Imagem do produto */}
                      <div className="w-14 h-14 rounded-xl bg-[#f8f9fa] border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={cleanProductName}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="text-xs text-slate-300 font-bold">ZEIQ</div>
                        )}
                      </div>

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-semibold text-zeiq-black leading-snug line-clamp-2">
                            {cleanProductName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                            title="Remover produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {item.sku && (
                          <span className="text-xs font-mono text-slate-500 font-medium block mt-0.5">
                            SKU: {item.sku}
                          </span>
                        )}

                        {item.price != null && item.price > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs">
                            <span className="font-extrabold text-zeiq-black font-mono">
                              R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              (Subtotal: R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          </div>
                        )}

                        {/* EXIBIÇÃO DA GRADE DETALHADA POR TAMANHOS (CONTROLES AUMENTADOS) */}
                        {hasGrade ? (
                          <div className="mt-2 p-2.5 bg-[#f8f9fa] rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between text-xs font-bold text-zeiq-black mb-1.5">
                              <span className="flex items-center gap-1">
                                <Layers className="w-3.5 h-3.5 text-slate-500" />
                                Grade de Tamanhos:
                              </span>
                              <span>Total: {item.quantity} un.</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(item.sizeBreakdown!).map(([sz, qty]) => (
                                <div
                                  key={sz}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs"
                                >
                                  <span className="font-extrabold text-zeiq-black text-xs">{sz}:</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => updateSizeQuantity(item.productId, sz, qty - 1)}
                                      className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black active:scale-90 transition-all cursor-pointer"
                                      title="Diminuir"
                                    >
                                      -
                                    </button>
                                    <span className="font-bold text-zeiq-black w-4 text-center text-xs">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => updateSizeQuantity(item.productId, sz, qty + 1)}
                                      className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black active:scale-90 transition-all cursor-pointer"
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
                          /* Produto sem grade (quantidade simples com botões confortáveis de 32px) */
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center border border-slate-200 rounded-xl bg-[#f8f9fa] p-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-90 transition-all"
                                aria-label="Diminuir"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-zeiq-black">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-90 transition-all"
                                aria-label="Aumentar"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                              <span className="text-xs text-slate-500 font-medium">unidades</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Observação de grade/item (Colapsável para economizar espaço visual no celular) */}
                      <div>
                        {item.notes || openNotesIds[item.productId] ? (
                          <div className="mt-1">
                            <input
                              type="text"
                              autoFocus={!item.notes}
                              value={item.notes || ''}
                              onChange={(e) => updateNotes(item.productId, e.target.value)}
                              placeholder="Observações deste item (ex: cor, prazo)..."
                              className="w-full px-3 py-1.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpenNotesIds((prev) => ({ ...prev, [item.productId]: true }))}
                            className="text-xs text-slate-400 hover:text-zeiq-black inline-flex items-center gap-1 font-medium transition-colors pt-0.5 cursor-pointer"
                          >
                            <span>+ Adicionar observação deste item</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rodapé da Gaveta com Visual Redesenhado, Limpo e Moderno */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 pb-safe border-t border-slate-200 bg-white space-y-2.5">
                {/* Resumo de Peças e Total Estimado */}
                <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Quantidade Total:</span>
                    <span className="font-extrabold text-zeiq-black font-mono">{totalItemsCount} peças</span>
                  </div>
                  {items.some((it) => it.price != null && it.price > 0) && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                      <span className="font-bold text-zeiq-black">Total Estimado Atacado:</span>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">
                        R$ {items.reduce((sum, it) => sum + ((it.price || 0) * it.quantity), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dados do Comprador Cadastrado (Compacto para liberar espaço para ver os produtos) */}
                <div className="p-2.5 bg-[#f8f9fa] rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
                      <span className="font-bold text-zeiq-black truncate">
                        {buyerName || 'Lojista Zeiq'}
                      </span>
                      {buyerCompany && (
                        <span className="text-slate-400 text-xs truncate hidden xs:inline">
                          • {buyerCompany}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingBuyer(!isEditingBuyer)}
                      className="text-xs font-bold text-slate-500 hover:text-zeiq-black ml-2 shrink-0 underline cursor-pointer"
                    >
                      {isEditingBuyer ? 'Recolher' : 'Alterar dados'}
                    </button>
                  </div>

                  {isEditingBuyer && (
                    <div className="space-y-1.5 pt-2 mt-2 border-t border-slate-200 animate-in fade-in">
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Seu nome ou responsável"
                        className="w-full px-3 h-11 text-xs bg-white border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                      />
                      <input
                        type="text"
                        value={buyerCompany}
                        onChange={(e) => setBuyerCompany(e.target.value)}
                        placeholder="Nome da sua loja ou arena"
                        className="w-full px-3 h-11 text-xs bg-white border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                      />
                      <input
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="Seu WhatsApp com DDD (para confirmação)"
                        className="w-full px-3 h-11 text-xs bg-white border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                      />
                    </div>
                  )}
                </div>

                {/* Botão de Envio WhatsApp (Ação Principal com Altura 48px e Raio Padronizado) */}
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full h-12 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Pedido via WhatsApp</span>
                </button>

                {/* Botões Secundários em Linha com Alturas e Bordas 100% Harmônicas */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full h-11 px-3 bg-slate-100 hover:bg-slate-200 text-zeiq-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer border border-slate-200"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
                    <span className="truncate">Voltar ao Catálogo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmail}
                    className="w-full h-11 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Enviar por E-mail</span>
                  </button>
                </div>

                {/* Link de Acesso ao Portal do Revendedor */}
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs pb-1 sm:pb-0">
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
                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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

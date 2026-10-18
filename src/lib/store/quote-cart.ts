import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { QuoteItem, Product } from '@/types';

export interface CartLastAdded {
  id: string;
  productName: string;
  sku?: string | null;
  coverImage?: string;
  quantity: number;
  selectedSize?: string;
  sizeBreakdown?: Record<string, number>;
}

interface QuoteCartState {
  items: QuoteItem[];
  isOpen: boolean;
  lastAdded: CartLastAdded | null;
  clearLastAdded: () => void;
  setIsOpen: (isOpen: boolean) => void;
  addItem: (product: Product, quantity?: number, selectedSize?: string, notes?: string) => void;
  addBundle: (product: Product, sizeBreakdown: Record<string, number>, notes?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateSizeQuantity: (productId: string, size: string, quantity: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  loadOrderItems: (items: QuoteItem[]) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  generateWhatsAppLink: (sellerPhone?: string, buyerName?: string, buyerCompany?: string, orderNumber?: string, buyerPhone?: string) => string;
  generateEmailLink: (contactEmail?: string, buyerName?: string, buyerCompany?: string, orderNumber?: string, buyerPhone?: string) => string;
}

export const useQuoteCart = create<QuoteCartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      lastAdded: null,

      setIsOpen: (isOpen: boolean) => set({ isOpen }),
      clearLastAdded: () => set({ lastAdded: null }),

      // Adiciona produto simples ou com tamanho único
      addItem: (product: Product, quantity = 1, selectedSize = '', notes = '') => {
        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.productId === product.id);
          const coverImage = product.images && product.images.length > 0 
            ? (product.images.find(img => img.is_cover)?.public_url || product.images[0].public_url)
            : undefined;

          const lastAdded: CartLastAdded = {
            id: `${product.id}-${Date.now()}`,
            productName: product.name,
            sku: product.code_sku,
            coverImage,
            quantity,
            selectedSize: selectedSize || undefined,
          };

          if (existingIndex > -1) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex].quantity += quantity;
            if (product.price != null) {
              updatedItems[existingIndex].price = product.price;
            }
            if (notes) {
              updatedItems[existingIndex].notes = notes;
            }
            if (selectedSize) {
              updatedItems[existingIndex].selectedSize = selectedSize;
            }
            return { items: updatedItems, lastAdded };
          }

          const newItem: QuoteItem = {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            sku: product.code_sku,
            coverImage: coverImage,
            price: product.price ?? null,
            quantity: Math.max(1, quantity),
            selectedSize: selectedSize || undefined,
            notes: notes || undefined,
          };

          return { items: [...state.items, newItem], lastAdded };
        });
      },

      // Adiciona uma grade completa de atacado (ex: { PP: 1, P: 3, M: 5, G: 4, GG: 2 })
      addBundle: (product: Product, sizeBreakdown: Record<string, number>, notes = '') => {
        set((state) => {
          const validBreakdown: Record<string, number> = {};
          let totalQty = 0;

          Object.entries(sizeBreakdown).forEach(([sz, qty]) => {
            if (qty > 0) {
              validBreakdown[sz] = qty;
              totalQty += qty;
            }
          });

          if (totalQty === 0) return state;

          const coverImage = product.images && product.images.length > 0 
            ? (product.images.find(img => img.is_cover)?.public_url || product.images[0].public_url)
            : undefined;

          const lastAdded: CartLastAdded = {
            id: `${product.id}-${Date.now()}`,
            productName: product.name,
            sku: product.code_sku,
            coverImage,
            quantity: totalQty,
            sizeBreakdown: validBreakdown,
          };

          const existingIndex = state.items.findIndex((item) => item.productId === product.id);

          if (existingIndex > -1) {
            const updatedItems = [...state.items];
            const currentItem = updatedItems[existingIndex];
            const mergedBreakdown: Record<string, number> = { ...(currentItem.sizeBreakdown || {}) };

            Object.entries(validBreakdown).forEach(([sz, qty]) => {
              mergedBreakdown[sz] = (mergedBreakdown[sz] || 0) + qty;
            });

            const newTotal = Object.values(mergedBreakdown).reduce((a, b) => a + b, 0);

            updatedItems[existingIndex] = {
              ...currentItem,
              quantity: newTotal,
              sizeBreakdown: mergedBreakdown,
              price: product.price ?? currentItem.price ?? null,
              notes: notes || currentItem.notes,
            };

            return { items: updatedItems, lastAdded };
          }

          const newItem: QuoteItem = {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            sku: product.code_sku,
            coverImage: coverImage,
            price: product.price ?? null,
            quantity: totalQty,
            sizeBreakdown: validBreakdown,
            notes: notes || undefined,
          };

          return { items: [...state.items, newItem], lastAdded };
        });
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      updateQuantity: (productId: string, quantity: number) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.productId !== productId),
            };
          }
          return {
            items: state.items.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          };
        });
      },

      updateSizeQuantity: (productId: string, size: string, quantity: number) => {
        set((state) => {
          return {
            items: state.items
              .map((item) => {
                if (item.productId !== productId || !item.sizeBreakdown) return item;
                const newBreakdown = { ...item.sizeBreakdown };
                if (quantity <= 0) {
                  delete newBreakdown[size];
                } else {
                  newBreakdown[size] = quantity;
                }
                const newTotal = Object.values(newBreakdown).reduce((a, b) => a + b, 0);
                if (newTotal <= 0) return null;
                return {
                  ...item,
                  quantity: newTotal,
                  sizeBreakdown: newBreakdown,
                };
              })
              .filter(Boolean) as QuoteItem[],
          };
        });
      },

      updateNotes: (productId: string, notes: string) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId ? { ...item, notes } : item
          ),
        }));
      },

      loadOrderItems: (itemsToLoad: QuoteItem[]) => {
        const totalPieces = itemsToLoad.reduce((sum, it) => sum + it.quantity, 0);
        set({
          items: [...itemsToLoad],
          lastAdded: itemsToLoad[0]
            ? {
                id: `reorder-${Date.now()}`,
                productName: `${itemsToLoad.length} modelos de pedido anterior`,
                coverImage: itemsToLoad[0].coverImage,
                quantity: totalPieces,
              }
            : null,
        });
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      generateWhatsAppLink: (sellerPhone = '5516991667020', buyerName = '', buyerCompany = '', orderNumber = '', buyerPhone = '') => {
        const { items } = get();
        if (items.length === 0) return '';

        const cleanPhone = sellerPhone.replace(/\D/g, '');
        let message = `Olá! Gostaria de solicitar uma cotação para revenda de produtos Zeiq.\n\n`;

        if (orderNumber) {
          message += `🔖 *PEDIDO / COTAÇÃO:* #${orderNumber}\n`;
        }
        if (buyerName.trim()) {
          message += `👤 *Responsável:* ${buyerName.trim()}\n`;
        }
        if (buyerCompany.trim()) {
          message += `🏢 *Loja/Arena:* ${buyerCompany.trim()}\n`;
        }
        if (buyerPhone.trim()) {
          message += `📱 *WhatsApp do Comprador:* ${buyerPhone.trim()}\n`;
        }
        if (orderNumber || buyerName.trim() || buyerCompany.trim() || buyerPhone.trim()) {
          message += `\n`;
        }

        message += `📋 *LISTA DE PRODUTOS (${get().getTotalItems()} peças selecionadas):*\n`;

        items.forEach((item, index) => {
          const skuText = item.sku ? ` [SKU: ${item.sku}]` : '';
          const priceText = item.price != null && item.price > 0 
            ? ` | R$ ${item.price.toFixed(2).replace('.', ',')} un.`
            : '';
          message += `\n${index + 1}. *${item.productName}*${skuText}${priceText}\n`;

          if (item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0) {
            const breakdownStr = Object.entries(item.sizeBreakdown)
              .map(([sz, qty]) => `${qty} ${sz}`)
              .join(', ');
            message += `   • Grade: *${breakdownStr}* (Total: ${item.quantity} un.)\n`;
          } else if (item.selectedSize) {
            message += `   • Tamanho: *${item.selectedSize}* (Qtd: ${item.quantity} un.)\n`;
          } else {
            message += `   • Quantidade: *${item.quantity} un.*\n`;
          }

          if (item.notes && item.notes.trim()) {
            message += `   • Obs: ${item.notes.trim()}\n`;
          }
        });

        // Calcula total se houver preços
        const pricedItems = items.filter(it => it.price != null && it.price > 0);
        if (pricedItems.length > 0) {
          const totalEstimated = pricedItems.reduce((acc, it) => acc + (it.price! * it.quantity), 0);
          message += `\n💰 *Total Estimado dos Produtos:* R$ ${totalEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }

        message += `\nPor favor, enviem as condições de atacado e faturamento. Obrigado!`;

        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      },

      generateEmailLink: (contactEmail = 'contato@zeiq.com.br', buyerName = '', buyerCompany = '', orderNumber = '', buyerPhone = '') => {
        const { items } = get();
        if (items.length === 0) return '';

        const subject = `Solicitação de Cotação de Revenda - Zeiq${orderNumber ? ` [#${orderNumber}]` : ''}${buyerCompany ? ` (${buyerCompany})` : ''}`;
        let body = `Olá equipe comercial Zeiq,\n\nGostaria de solicitar cotação para revenda dos seguintes produtos:\n\n`;

        if (orderNumber) body += `Pedido / Cotação: #${orderNumber}\n`;
        if (buyerName.trim()) body += `Responsável: ${buyerName.trim()}\n`;
        if (buyerCompany.trim()) body += `Loja/Arena: ${buyerCompany.trim()}\n`;
        if (buyerPhone.trim()) body += `Telefone/WhatsApp: ${buyerPhone.trim()}\n`;
        body += `\nLISTA DE ITENS SOLICITADOS (${get().getTotalItems()} peças):\n`;

        items.forEach((item, index) => {
          const skuText = item.sku ? ` (Código: ${item.sku})` : '';
          body += `\n${index + 1}. ${item.productName}${skuText}\n`;

          if (item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0) {
            const breakdownStr = Object.entries(item.sizeBreakdown)
              .map(([sz, qty]) => `${qty} un. ${sz}`)
              .join(', ');
            body += `   - Grade selecionada: ${breakdownStr} (Total: ${item.quantity} peças)\n`;
          } else if (item.selectedSize) {
            body += `   - Tamanho: ${item.selectedSize} (${item.quantity} peças)\n`;
          } else {
            body += `   - Quantidade: ${item.quantity} peças\n`;
          }

          if (item.notes && item.notes.trim()) {
            body += `   - Observações: ${item.notes.trim()}\n`;
          }
        });

        body += `\nAguardo retorno com a grade de valores e prazo de entrega.\n\nAtenciosamente.`;

        return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      },
    }),
    {
      name: 'zeiq_quote_cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

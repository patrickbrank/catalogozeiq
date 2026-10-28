import React from 'react';
import { Send, CheckCircle2, ShieldCheck } from 'lucide-react';

export function HeroBanner() {
  return (
    <section className="bg-zeiq-black text-white py-10 sm:py-12 border-t border-zeiq-charcoal relative overflow-hidden">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest block mb-2">
              Direto da Fábrica • Venda B2B
            </span>
            
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white mb-2">
              Como funciona o pedido de revenda Zeiq
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
              Monte sua lista no catálogo adicionando os produtos e quantidades. No campo de observações, você pode anotar as grades e cores desejadas. Em seguida, envie diretamente para o WhatsApp comercial para receber a tabela de atacado e condições de pagamento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3.5 shrink-0 pt-4 lg:pt-0 border-t border-white/10 lg:border-t-0">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Condições especiais para lojistas e revendedores autorizados</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Grade completa de vestuário e equipamentos</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <Send className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Cotação e faturamento rápido pelo WhatsApp</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Home, Package } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zeiq-black text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-zeiq-dark border border-zeiq-charcoal rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="relative h-8 w-28 mx-auto brightness-0 invert flex items-center justify-center">
          <Image
            src="/images/logo-zeiq.png"
            alt="Zeiq Sports"
            width={112}
            height={32}
            className="h-full w-auto object-contain"
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-zeiq-orange bg-zeiq-orange/10 border border-zeiq-orange/20 px-3 py-1 rounded-full inline-block">
            Erro 404
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Página não encontrada
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            O endereço acessado não existe, foi movido ou o catálogo foi atualizado recentemente.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs font-black transition-all shadow-md"
          >
            <Home className="w-4 h-4" />
            <span>Voltar ao Catálogo Principal</span>
          </Link>

          <Link
            href="/admin"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
          >
            <Package className="w-4 h-4 text-zeiq-orange" />
            <span>Acessar Painel B2B</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

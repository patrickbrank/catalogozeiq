'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  User,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function B2BLoginPage() {
  const router = useRouter();

  // Modo: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Estado de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado de Cadastro
  const [regContactName, setRegContactName] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regCnpjCpf, setRegCnpjCpf] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regState, setRegState] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('pending_approval') === '1') {
        setErrorMsg('Seu cadastro está aguardando aprovação pelo administrador. Nossa equipe comercial analisará os dados antes de liberar seu acesso.');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const user = data.user;
      const isMaster = user.email === 'marketing@zeiq.com.br' || user.email === 'patrickbrank@outlook.com';
      const isStaff = ['admin', 'marketing', 'stock'].includes(user.app_metadata?.role);

      if (!isMaster && !isStaff) {
        let isApproved = user.app_metadata?.is_approved ?? user.user_metadata?.is_approved;

        // Consulta profile para checagem atualizada
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved, role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.is_approved !== undefined) {
          isApproved = profile.is_approved;
        }

        // Se o lojista ainda não foi aprovado pelo administrador
        if (isApproved === false) {
          await supabase.auth.signOut();
          setErrorMsg(
            'Seu cadastro está aguardando aprovação pelo administrador. Assim que sua conta for liberada pela equipe comercial da Zeiq, você poderá acessar o catálogo.'
          );
          setLoading(false);
          return;
        }
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
          : err.message || 'Falha ao autenticar. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setRegLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: regContactName,
          store_name: regStoreName,
          cnpj_cpf: regCnpjCpf,
          phone: regPhone,
          city: regCity,
          state: regState,
          email: regEmail,
          password: regPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao enviar cadastro.');
      }

      setRegSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao enviar sua solicitação de cadastro.');
    } finally {
      setRegLoading(false);
    }
  };

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Olá equipe Zeiq! Gostaria de informações sobre a aprovação do meu cadastro de lojista no catálogo B2B.'
  )}`;

  return (
    <div className="min-h-screen bg-zeiq-black text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zeiq-orange selection:text-zeiq-black">
      <div className={`sm:mx-auto sm:w-full transition-all duration-300 ${mode === 'register' && !regSuccess ? 'sm:max-w-xl' : 'sm:max-w-md'}`}>
        
        {/* Marca Zeiq com Logo Oficial */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="relative h-10 w-36 brightness-0 invert flex items-center justify-center mb-3">
            <Image
              src="/images/logo-zeiq.png"
              alt="Zeiq Sports"
              width={144}
              height={40}
              priority
              className="h-full w-auto object-contain"
            />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-zeiq-orange bg-zeiq-orange/10 border border-zeiq-orange/30 px-3 py-1 rounded-full">
            Catálogo Exclusivo B2B
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-3 tracking-tight">
            Acesso para Lojistas
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
            Área de atacado restrita a parceiros credenciados. Informe suas credenciais cadastradas pelo administrador.
          </p>
        </div>

        {/* Card Principal */}
        <div className="bg-zeiq-dark py-7 px-6 sm:px-8 rounded-3xl border border-zeiq-charcoal shadow-2xl">
          
          {/* Seletor de Abas (Entrar / Solicitar Cadastro) */}
          {!regSuccess && (
            <div className="flex rounded-xl bg-zeiq-charcoal p-1 mb-6 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-zeiq-orange text-zeiq-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Entrar no Catálogo
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-zeiq-orange text-zeiq-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Solicitar Cadastro
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TELA DE SUCESSO DO CADASTRO (Aguardando Aprovação) */}
          {regSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                <Clock className="w-7 h-7" />
              </div>

              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                  Aguardando Aprovação
                </span>
                <h2 className="text-lg font-black text-white mt-2.5">
                  Cadastro Enviado para Análise
                </h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Recebemos seus dados cadastrais. Para proteger as condições exclusivas de revenda e atacado, <strong>nossa equipe analisa e aprova cada parceiro no painel administrativo</strong> antes de liberar o acesso.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-left text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Loja / Empresa: <strong>{regStoreName}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>E-mail cadastrado: <strong>{regEmail}</strong></span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Assim que sua conta for aprovada pelo administrador, você poderá fazer login normalmente com a senha cadastrada.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegSuccess(false);
                    setMode('login');
                    setEmail(regEmail);
                  }}
                  className="w-full h-11 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  Ir para a Tela de Login
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Falar com Atendimento no WhatsApp</span>
                </a>
              </div>
            </div>
          ) : mode === 'login' ? (
            /* FORMULÁRIO DE LOGIN */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@loja.com.br"
                    className="w-full pl-10 pr-4 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-zeiq-orange focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-zeiq-orange focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Catálogo</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Box Informativo com Botão para Solicitar Cadastro */}
              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-zeiq-orange" />
                    <span>Ainda não possui credencial de lojista?</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Preencha seus dados para solicitar acesso. Nosso time analisará suas informações e aprovará seu cadastro no painel.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                    }}
                    className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Solicitar Cadastro de Lojista</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zeiq-orange" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* FORMULÁRIO DE CADASTRO COM APROVAÇÃO */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Responsável *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={regContactName}
                      onChange={(e) => setRegContactName(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Loja / Razão Social *
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                      placeholder="Ex: Point Sports BT"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CNPJ ou CPF *
                  </label>
                  <input
                    type="text"
                    required
                    value={regCnpjCpf}
                    onChange={(e) => setRegCnpjCpf(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp / Telefone *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="(16) 99999-9999"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cidade
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="Ex: Ribeirão Preto"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={regState}
                    onChange={(e) => setRegState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full px-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs uppercase text-center focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail Comercial (Login de Acesso) *
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="contato@minhaloja.com.br"
                    className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Senha de Acesso *
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 6 dígitos"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirmar Senha *
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                    />
                  </div>
                </div>
              </div>

              {/* Aviso sobre aprovação */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 leading-snug flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  O cadastro será enviado para <strong>aprovação administrativa</strong> da Zeiq Sports para liberação da tabela de revenda.
                </span>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full h-11 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 mt-1 cursor-pointer"
              >
                {regLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando solicitação...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Cadastro para Aprovação</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}

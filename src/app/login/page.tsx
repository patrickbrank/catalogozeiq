'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  UserCheck,
  ChevronDown,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Check,
  Search,
} from 'lucide-react';

function formatPhoneBR(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

function getResellerInitials(name?: string | null): string {
  if (!name) return 'RZ';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [regResellerId, setRegResellerId] = useState('');
  const [resellers, setResellers] = useState<any[]>([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [resellerDropdownOpen, setResellerDropdownOpen] = useState(false);
  const [resellerSearch, setResellerSearch] = useState('');
  const resellerDropdownRef = useRef<HTMLDivElement>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resellerDropdownRef.current && !resellerDropdownRef.current.contains(e.target as Node)) {
        setResellerDropdownOpen(false);
      }
    };
    if (resellerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [resellerDropdownOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('pending_approval') === '1') {
        setErrorMsg('Seu cadastro está aguardando aprovação pelo seu revendedor comercial. Nossa equipe analisará os dados antes de liberar seu acesso.');
      }

      // Captura indicação de revendedor pela URL (?rep=, ?reseller=, ?r=)
      const repParam = params.get('rep') || params.get('reseller') || params.get('r');
      if (repParam) {
        localStorage.setItem('zeiq_referral_reseller', repParam.trim());
      }
    }

    // Carrega revendedores ativos para a vinculação obrigatória
    setLoadingResellers(true);
    fetch('/api/resellers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.resellers)) {
          setResellers(data.resellers);

          const storedRep = typeof window !== 'undefined' ? localStorage.getItem('zeiq_referral_reseller') : null;
          if (storedRep) {
            const matched = data.resellers.find(
              (r: any) =>
                r.id?.toLowerCase() === storedRep.toLowerCase() ||
                r.email?.toLowerCase() === storedRep.toLowerCase()
            );
            if (matched) {
              setRegResellerId(matched.id);
              return;
            }
          }

          if (data.resellers.length === 1) {
            setRegResellerId(data.resellers[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResellers(false));
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
      const isStaff = isMaster || ['master', 'admin', 'representative', 'stock'].includes(user.app_metadata?.role);

      if (!isMaster && !isStaff) {
        // Consulta profile no banco de dados com prioridade máxima
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved, role')
          .eq('id', user.id)
          .maybeSingle();

        const isApproved =
          profile?.is_approved !== undefined
            ? profile.is_approved
            : (user.app_metadata?.is_approved ?? user.user_metadata?.is_approved ?? true);

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

      // Redireciona com atualização completa de sessão
      window.location.href = '/';
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

    if (resellers.length > 0 && !regResellerId) {
      setErrorMsg('Por favor, selecione seu revendedor comercial.');
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
          reseller_id: regResellerId || null,
          representative_id: regResellerId || null,
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

  const selectedReseller = resellers.find((r) => r.id === regResellerId);
  const rawResellerPhone = selectedReseller?.whatsapp || selectedReseller?.phone;
  let cleanResellerPhone = rawResellerPhone ? rawResellerPhone.replace(/\D/g, '') : '';
  if (cleanResellerPhone && !cleanResellerPhone.startsWith('55') && (cleanResellerPhone.length === 10 || cleanResellerPhone.length === 11)) {
    cleanResellerPhone = `55${cleanResellerPhone}`;
  }
  const registrationWhatsAppUrl = cleanResellerPhone
    ? `https://wa.me/${cleanResellerPhone}?text=${encodeURIComponent(
        `Olá ${selectedReseller?.name || 'Zeiq'}! Sou da loja ${regStoreName || 'parceira'} e acabei de solicitar meu cadastro no Catálogo Zeiq com você como meu revendedor. Poderia verificar a aprovação do meu acesso?`
      )}`
    : null;

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

                {registrationWhatsAppUrl && (
                  <a
                    href={registrationWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-10 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      Solicitar Aprovação com {selectedReseller?.name ? selectedReseller.name.split(' ')[0] : 'Revendedor'} no WhatsApp
                    </span>
                  </a>
                )}
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
              {/* Seleção Obrigatória do Revendedor com Layout Premium Customizado */}
              <div ref={resellerDropdownRef} className="relative">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>Escolha seu revendedor comercial</span>
                    <span className="text-zeiq-orange font-bold">*</span>
                  </span>
                  {loadingResellers ? (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Carregando...
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {resellers.length} {resellers.length === 1 ? 'disponível' : 'disponíveis'}
                    </span>
                  )}
                </label>

                {/* Input oculto para validação nativa de formulário */}
                <input
                  type="hidden"
                  name="reseller_id"
                  value={regResellerId}
                  required={resellers.length > 0}
                />

                {/* Trigger Customizado do Seletor */}
                <button
                  type="button"
                  onClick={() => setResellerDropdownOpen((prev) => !prev)}
                  className={`w-full min-h-[46px] px-3 py-2 bg-zeiq-charcoal/95 border rounded-xl text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer shadow-xs ${
                    resellerDropdownOpen
                      ? 'border-zeiq-orange ring-1 ring-zeiq-orange/50 bg-zeiq-charcoal'
                      : regResellerId
                      ? 'border-white/20 bg-zeiq-charcoal'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {selectedReseller ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zeiq-orange/25 to-amber-500/10 border border-zeiq-orange/30 text-zeiq-orange font-bold text-xs flex items-center justify-center shrink-0 tracking-wider">
                          {getResellerInitials(selectedReseller.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate leading-tight">
                            {selectedReseller.name}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>
                              {formatPhoneBR(selectedReseller.whatsapp || selectedReseller.phone) || 'Sem telefone'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4 text-zeiq-orange" />
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          {resellers.length === 0 ? 'Nenhum revendedor ativo cadastrado' : 'Escolha seu revendedor comercial...'}
                        </div>
                      </>
                    )}
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      resellerDropdownOpen ? 'rotate-180 text-zeiq-orange' : ''
                    }`}
                  />
                </button>

                {/* Popover Customizado com Busca e Cards de Opção */}
                {resellerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#18181b] border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Barra de Busca rápida se houver mais de 3 revendedores */}
                    {resellers.length > 3 && (
                      <div className="p-2 border-b border-white/10 bg-white/2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={resellerSearch}
                            onChange={(e) => setResellerSearch(e.target.value)}
                            placeholder="Buscar por nome ou DDD..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-zeiq-orange/60"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    {/* Lista com Rolagem Fluida */}
                    <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                      {resellers
                        .filter((rep) => {
                          if (!resellerSearch.trim()) return true;
                          const term = resellerSearch.toLowerCase();
                          const nameMatch = (rep.name || '').toLowerCase().includes(term);
                          const phoneMatch = (rep.phone || rep.whatsapp || '').includes(term);
                          return nameMatch || phoneMatch;
                        })
                        .map((rep) => {
                          const isSelected = rep.id === regResellerId;
                          const phoneFormatted = formatPhoneBR(rep.whatsapp || rep.phone);
                          return (
                            <button
                              key={rep.id}
                              type="button"
                              onClick={() => {
                                setRegResellerId(rep.id);
                                setResellerDropdownOpen(false);
                                setResellerSearch('');
                              }}
                              className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zeiq-orange/15 border border-zeiq-orange/40 text-white'
                                  : 'hover:bg-white/10 border border-transparent text-slate-300 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 tracking-wider ${
                                    isSelected
                                      ? 'bg-zeiq-orange text-zeiq-black shadow-xs'
                                      : 'bg-white/5 border border-white/10 text-slate-300'
                                  }`}
                                >
                                  {getResellerInitials(rep.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                    {rep.name}
                                  </div>
                                  {phoneFormatted && (
                                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                      <span>{phoneFormatted}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-zeiq-orange text-zeiq-black flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-400 mt-1.5">
                  Seus pedidos e aprovação de acesso serão atendidos exclusivamente por este revendedor.
                </p>
              </div>

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

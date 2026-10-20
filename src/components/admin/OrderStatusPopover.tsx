'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Check,
  AlertCircle,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react';
import { OrderStatus } from '@/types';

export interface StatusOption {
  key: OrderStatus;
  label: string;
  badgeLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ORDER_STATUS_CONFIG: StatusOption[] = [
  {
    key: 'pending',
    label: 'Pendente',
    badgeLabel: 'Pendente',
    description: 'Aguardando conferência comercial',
    badgeBg: 'bg-amber-50 hover:bg-amber-100/80',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200/90',
    dotColor: 'bg-amber-500',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    icon: Clock,
  },
  {
    key: 'approved',
    label: 'Aprovado',
    badgeLabel: 'Aprovado',
    description: 'Condições comerciais validadas',
    badgeBg: 'bg-blue-50 hover:bg-blue-100/80',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200/90',
    dotColor: 'bg-blue-500',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    icon: CheckCircle2,
  },
  {
    key: 'processing',
    label: 'Em Separação',
    badgeLabel: 'Em Separação',
    description: 'Almoxarifado separando grade',
    badgeBg: 'bg-indigo-50 hover:bg-indigo-100/80',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200/90',
    dotColor: 'bg-indigo-500',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    icon: Package,
  },
  {
    key: 'shipped',
    label: 'Despachado',
    badgeLabel: 'Despachado',
    description: 'Em transporte com rastreamento',
    badgeBg: 'bg-purple-50 hover:bg-purple-100/80',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200/90',
    dotColor: 'bg-purple-500',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    icon: Truck,
  },
  {
    key: 'delivered',
    label: 'Entregue',
    badgeLabel: 'Entregue',
    description: 'Entregue com sucesso na loja/arena',
    badgeBg: 'bg-emerald-50 hover:bg-emerald-100/80',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200/90',
    dotColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    icon: Check,
  },
  {
    key: 'cancelled',
    label: 'Cancelado',
    badgeLabel: 'Cancelado',
    description: 'Pedido estornado ou cancelado',
    badgeBg: 'bg-rose-50 hover:bg-rose-100/80',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200/90',
    dotColor: 'bg-rose-500',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    icon: AlertCircle,
  },
];

interface OrderStatusPopoverProps {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStatus: (newStatus: OrderStatus) => Promise<void> | void;
  disabled?: boolean;
}

export function OrderStatusPopover({
  orderId,
  orderNumber,
  currentStatus,
  isOpen,
  onOpenChange,
  onSelectStatus,
  disabled = false,
}: OrderStatusPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTriggerVisible, setIsTriggerVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: 'top' | 'bottom';
  }>({ left: 0, placement: 'bottom' });

  // Garantir montagem no cliente para o Portal
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calcular posição precisa do popover no desktop (com auto-flip)
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) {
      setIsTriggerVisible(false);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();

    // Se o elemento estiver oculto (ex: display: none via md:hidden ou hidden md:block)
    if (rect.width === 0 || rect.height === 0 || (rect.top === 0 && rect.left === 0 && rect.bottom === 0)) {
      setIsTriggerVisible(false);
      return;
    }

    const menuWidth = 280;
    const menuHeight = 360;
    const padding = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldFlipTop = spaceBelow < menuHeight && rect.top > menuHeight;

    let left = rect.left + rect.width / 2 - menuWidth / 2;
    // Clamping para não vazar da tela
    left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));

    if (shouldFlipTop) {
      setCoords({
        bottom: window.innerHeight - rect.top + 8,
        left,
        placement: 'top',
      });
    } else {
      setCoords({
        top: rect.bottom + 8,
        left,
        placement: 'bottom',
      });
    }

    setIsTriggerVisible(true);
  }, []);

  // Recalcular quando abrir ou scroll/resize acontecer
  useEffect(() => {
    if (!isOpen) {
      setIsTriggerVisible(false);
      return;
    }

    calculatePosition();

    const handleScroll = (e: Event) => {
      // Se o scroll não for dentro do próprio menu do portal, fechar ou recalcular
      const target = e.target as HTMLElement;
      if (target && target.closest?.('.order-status-popover-content')) return;
      calculatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, calculatePosition, onOpenChange]);

  const currentOpt =
    ORDER_STATUS_CONFIG.find((s) => s.key === currentStatus) || ORDER_STATUS_CONFIG[0];

  const handleSelect = async (statusKey: OrderStatus) => {
    if (disabled || isUpdating) return;
    if (statusKey === currentStatus) {
      onOpenChange(false);
      return;
    }

    try {
      setIsUpdating(true);
      await onSelectStatus(statusKey);
    } finally {
      setIsUpdating(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      {/* Botão Acionador (Badge) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || isUpdating}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!isOpen);
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer shadow-2xs select-none ${
          currentOpt.badgeBg
        } ${currentOpt.badgeText} ${currentOpt.badgeBorder} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title="Clique para alterar o status operacional deste pedido"
        aria-expanded={isOpen}
      >
        {isUpdating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          <span className={`w-2 h-2 rounded-full shrink-0 ${currentOpt.dotColor}`} />
        )}
        <span className="whitespace-nowrap font-bold tracking-tight">
          {currentOpt.badgeLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover / Sheet via Portal para escapar de overflow:hidden e overflow-x:auto */}
      {isOpen && isTriggerVisible && mounted && typeof document !== 'undefined' &&
        createPortal(
          isMobile ? (
            // ==========================================
            // VERSÃO MOBILE: BOTTOM ACTION SHEET
            // ==========================================
            <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div
                className="fixed inset-0"
                onClick={() => onOpenChange(false)}
                aria-hidden="true"
              />
              <div className="relative z-10 bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 text-left">
                {/* Drag Handle */}
                <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto -mt-1" />

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Status Operacional
                    </span>
                    <h4 className="text-sm font-bold text-zeiq-black font-mono">
                      Pedido #{orderNumber}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {ORDER_STATUS_CONFIG.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = opt.key === currentStatus;

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleSelect(opt.key)}
                        disabled={isUpdating}
                        className={`w-full text-left p-3 rounded-2xl flex items-center justify-between gap-3 transition-all border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-white/20 text-white' : `${opt.iconBg} ${opt.iconColor}`
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block">{opt.label}</span>
                            <span
                              className={`text-[10px] block ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {opt.description}
                            </span>
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            // ==========================================
            // VERSÃO DESKTOP: POPOVER FLUTUANTE COM PORTAL
            // ==========================================
            <div className="fixed inset-0 z-[100]">
              {/* Backdrop invisível para fechar ao clicar fora */}
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                aria-hidden="true"
              />

              <div
                className="order-status-popover-content absolute w-[280px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/15 p-2 z-10 animate-in fade-in zoom-in-95 duration-150 text-left select-none"
                style={{
                  top: coords.top !== undefined ? `${coords.top}px` : undefined,
                  bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                  left: `${coords.left}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header do Popover */}
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                      Status Operacional
                    </span>
                    <span className="text-xs font-mono font-bold text-zeiq-black">
                      #{orderNumber}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Zeiq B2B</span>
                </div>

                {/* Opções de Status */}
                <div className="space-y-1 py-1">
                  {ORDER_STATUS_CONFIG.map((opt, index) => {
                    const Icon = opt.icon;
                    const isSelected = opt.key === currentStatus;
                    const isCancelled = opt.key === 'cancelled';

                    return (
                      <React.Fragment key={opt.key}>
                        {isCancelled && <div className="my-1 border-t border-slate-100" />}

                        <button
                          type="button"
                          onClick={() => handleSelect(opt.key)}
                          disabled={isUpdating}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all group ${
                            isSelected
                              ? `${opt.badgeBg} ${opt.badgeText} font-bold border ${opt.badgeBorder}`
                              : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-white shadow-2xs' : opt.iconBg
                              } ${opt.iconColor}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="block leading-tight">{opt.label}</span>
                              <span className="text-[10px] font-normal text-slate-400 block leading-tight">
                                {opt.description}
                              </span>
                            </div>
                          </div>

                          {isSelected && <Check className="w-4 h-4 text-current shrink-0" />}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Footer auxiliar */}
                <div className="pt-1.5 mt-1 border-t border-slate-100 px-2 text-[10px] text-slate-400 text-center">
                  Atualização imediata com notificação do pedido
                </div>
              </div>
            </div>
          ),
          document.body
        )}
    </>
  );
}

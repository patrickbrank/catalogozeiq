'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Upload, Trash2, Star, Loader2, Plus, Minus, Check, Search, Layers, Boxes, AlertTriangle } from 'lucide-react';
import { Product, Category, ProductImage, ProductHighlight } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { COMMON_SIZES, parseProductSizes } from '@/lib/utils/sizes';
import { parseProductSpecifications } from '@/lib/utils/specifications';
import { Department, DEFAULT_DEPARTMENTS, findDepartmentForCategory } from '@/lib/data/departments';

interface ProductFormModalProps {
  product: Product | null;
  categories: Category[];
  departments?: Department[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductFormModal({
  product,
  categories,
  departments,
  isOpen,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const activeDepts = departments && departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [catDeptFilter, setCatDeptFilter] = useState<string>('all');
  const [catSearchQuery, setCatSearchQuery] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [stockBySize, setStockBySize] = useState<Record<string, number>>({});
  const [defaultStock, setDefaultStock] = useState<number>(0);
  const [batchStockValue, setBatchStockValue] = useState('');
  const [highlights, setHighlights] = useState<ProductHighlight[]>([
    { label: '', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);
  const [images, setImages] = useState<{ id?: string; public_url: string; storage_path: string; is_cover: boolean; sort_order: number }[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setSku(product.code_sku || '');
      setPrice(product.price != null ? product.price.toString().replace('.', ',') : '');
      setOriginalPrice(product.original_price != null ? product.original_price.toString().replace('.', ',') : '');
      const parsedSpecs = parseProductSpecifications(product.description, product.highlights);
      const parsedSizes = parseProductSizes(parsedSpecs.cleanDescription, product.sizes);
      setDescription(parsedSizes.cleanDescription || '');
      const activeSizes = product.sizes && product.sizes.length > 0 ? product.sizes : parsedSizes.sizes;
      setSelectedSizes(activeSizes);

      // Carregar dados de estoque
      const initialStock: Record<string, number> = product.stock_by_size || {};
      const populatedStock: Record<string, number> = {};
      activeSizes.forEach((sz) => {
        populatedStock[sz] = typeof initialStock[sz] === 'number' ? initialStock[sz] : 0;
      });
      setStockBySize(populatedStock);
      setDefaultStock(
        typeof initialStock['_padrao'] === 'number'
          ? initialStock['_padrao']
          : typeof product.total_stock === 'number' && activeSizes.length === 0
          ? product.total_stock
          : 0
      );
      setBatchStockValue('');
      
      const currentHl = (product.highlights && product.highlights.length > 0) ? product.highlights : parsedSpecs.highlights;
      const hlSlots = [0, 1, 2, 3, 4].map((idx) => currentHl[idx] || { label: '', value: '' });
      setHighlights(hlSlots);

      setIsPublished(product.is_published ?? true);
      setIsFeatured(product.is_featured ?? false);
      setSelectedCategoryIds(product.categories?.map((c) => c.id) || []);
      setTagsInput(product.tags ? product.tags.join(', ') : '');
      setImages(
        product.images?.map((img, idx) => ({
          id: img.id,
          public_url: img.public_url,
          storage_path: img.storage_path,
          is_cover: img.is_cover || idx === 0,
          sort_order: img.sort_order ?? idx,
        })) || []
      );
    } else {
      setName('');
      setSku('');
      setPrice('');
      setOriginalPrice('');
      setDescription('');
      setHighlights([
        { label: '', value: '' },
        { label: '', value: '' },
        { label: '', value: '' },
        { label: '', value: '' },
        { label: '', value: '' },
      ]);
      setIsPublished(true);
      setIsFeatured(false);
      setSelectedCategoryIds([]);
      setTagsInput('');
      setImages([]);
      setSelectedSizes([]);
      setStockBySize({});
      setDefaultStock(0);
      setBatchStockValue('');
    }
    setCatDeptFilter('all');
    setCatSearchQuery('');
    setErrorMsg('');
  }, [product, isOpen]);

  const totalCalculatedStock = useMemo(() => {
    if (selectedSizes.length > 0) {
      return selectedSizes.reduce((sum, sz) => sum + (stockBySize[sz] || 0), 0);
    }
    return defaultStock || 0;
  }, [selectedSizes, stockBySize, defaultStock]);

  const handleToggleSize = (sz: string) => {
    setSelectedSizes((prev) => {
      if (prev.includes(sz)) {
        return prev.filter((s) => s !== sz);
      } else {
        setStockBySize((st) => ({ ...st, [sz]: st[sz] ?? 0 }));
        return [...prev, sz];
      }
    });
  };

  const handleUpdateStock = (sz: string, qty: number) => {
    setStockBySize((prev) => ({
      ...prev,
      [sz]: Math.max(0, qty),
    }));
  };

  const handleBatchSetStock = () => {
    const val = parseInt(batchStockValue, 10);
    if (isNaN(val) || val < 0) return;
    const updated: Record<string, number> = {};
    selectedSizes.forEach((sz) => {
      updated[sz] = val;
    });
    setStockBySize(updated);
    setBatchStockValue('');
  };

  const handleZeroAllStock = () => {
    const updated: Record<string, number> = {};
    selectedSizes.forEach((sz) => {
      updated[sz] = 0;
    });
    setStockBySize(updated);
  };

  const visibleCategories = useMemo(() => {
    let result = categories;
    if (catDeptFilter !== 'all') {
      const deptObj = activeDepts.find((d) => d.id === catDeptFilter);
      if (deptObj) {
        result = result.filter((c) =>
          deptObj.categoryNames.some(
            (name) => name.toLowerCase() === c.name.toLowerCase()
          )
        );
      }
    }
    if (catSearchQuery.trim()) {
      const q = catSearchQuery.toLowerCase().trim();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [categories, catDeptFilter, catSearchQuery, activeDepts]);

  const selectedCategories = useMemo(() => {
    return categories.filter((c) => selectedCategoryIds.includes(c.id));
  }, [categories, selectedCategoryIds]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const newUploadedImages: typeof images = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `admin-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('produtos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('produtos')
          .getPublicUrl(filePath);

        newUploadedImages.push({
          public_url: publicUrlData.publicUrl,
          storage_path: filePath,
          is_cover: images.length === 0 && i === 0,
          sort_order: images.length + i,
        });
      }

      setImages((prev) => [...prev, ...newUploadedImages]);
    } catch (err: any) {
      setErrorMsg(`Erro ao fazer upload da imagem: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSetCover = (index: number) => {
    setImages((prev) =>
      prev.map((img, idx) => ({
        ...img,
        is_cover: idx === index,
      }))
    );
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      if (filtered.length > 0 && !filtered.some((img) => img.is_cover)) {
        filtered[0] = { ...filtered[0], is_cover: true };
      }
      return filtered;
    });
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('O nome do produto é obrigatório.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + `-${Date.now().toString().slice(-4)}`;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      let cleanDesc = description.replace(/Tamanhos?:\s*[^\n\r]+/gi, '').trim();
      cleanDesc = cleanDesc.replace(/Especifica[çc][õo]es\s*T[ée]cnicas:?[^\n\r]*/gi, '').trim();

      const validHl = highlights.filter((h) => h.label.trim() && h.value.trim());
      if (validHl.length > 0) {
        cleanDesc = `${cleanDesc}\n\nEspecificações Técnicas:\n` + validHl.map((h) => `• ${h.label.trim()}: ${h.value.trim()}`).join('\n');
      }

      if (selectedSizes.length > 0) {
        cleanDesc = `${cleanDesc}\n\nTamanhos: ${selectedSizes.join(' | ')}`;
      }

      let productId = product?.id;

      const numPrice = price.trim() ? parseFloat(price.replace(/\./g, '').replace(',', '.')) : null;
      const numOriginalPrice = originalPrice.trim() ? parseFloat(originalPrice.replace(/\./g, '').replace(',', '.')) : null;

      let finalStockBySize: Record<string, number> = {};
      let finalTotalStock = 0;

      if (selectedSizes.length > 0) {
        selectedSizes.forEach((sz) => {
          finalStockBySize[sz] = Math.max(0, stockBySize[sz] || 0);
        });
        finalTotalStock = Object.values(finalStockBySize).reduce((a, b) => a + b, 0);
      } else {
        const dStock = Math.max(0, defaultStock || 0);
        finalStockBySize = { _padrao: dStock };
        finalTotalStock = dStock;
      }

      const basePayload: any = {
        name,
        code_sku: sku.trim() || null,
        description: cleanDesc,
        is_published: isPublished,
        is_featured: isFeatured,
        tags,
        stock_by_size: finalStockBySize,
        total_stock: finalTotalStock,
      };

      if (numPrice != null && !isNaN(numPrice)) {
        basePayload.price = numPrice;
      } else {
        basePayload.price = null;
      }

      if (numOriginalPrice != null && !isNaN(numOriginalPrice)) {
        basePayload.original_price = numOriginalPrice;
      } else {
        basePayload.original_price = null;
      }

      // Envia para a API administrativa segura (com chave de serviço e validação de sessão)
      const isEditing = !!product;
      const apiPayload = {
        ...basePayload,
        slug,
        id: product?.id,
        category_ids: selectedCategoryIds,
        images: images.map((img, idx) => ({
          public_url: img.public_url,
          storage_path: img.storage_path || `produtos/p-${product?.id || Date.now()}-${idx}.jpg`,
          is_cover: images.some((i) => i.is_cover) ? img.is_cover : idx === 0,
          sort_order: idx,
        })),
      };

      const res = await fetch('/api/admin/products', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Erro ao salvar produto via administração.');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar produto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="relative w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col my-0 sm:my-8 animate-in slide-in-from-bottom-3 sm:slide-in-from-bottom-0 sm:fade-in duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* 1. Cabeçalho Fixo (shrink-0) */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="text-base font-bold text-slate-900">
              {product ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Área de Conteúdo Rolável Isolada (flex-1 overflow-y-auto) */}
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1 overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Produto *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Raquete Zeiq Carbon 3K..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-zeiq-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código / SKU
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: 5001.003"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-zeiq-black font-mono"
              />
            </div>
          </div>

          {/* Preços e Condições Comerciais B2B */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80">
            <div>
              <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center justify-between">
                <span>Preço de Atacado / Revenda (R$)</span>
                <span className="text-xs text-emerald-700 font-normal">Exibido aos lojistas</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-800">
                  R$
                </span>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3.5 py-2 text-sm font-bold bg-white border border-emerald-300 rounded-xl text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Preço Sugerido Varejo (R$)</span>
                <span className="text-xs text-slate-500 font-normal">Opcional</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                  R$
                </span>
                <input
                  type="text"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-zeiq-black placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição e Detalhes Técnicos
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes, especificações de material, medidas, etc..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-zeiq-black"
            />
          </div>

          {/* Categorias do Produto (Redesign com Leitura Ampla e Filtros por Linha) */}
          <div className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <label className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zeiq-orange" />
                  <span>Categorias do Produto</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione onde o produto será classificado no catálogo:
                </p>
              </div>

              {/* Barra de Busca Rápida de Categorias */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catSearchQuery}
                  onChange={(e) => setCatSearchQuery(e.target.value)}
                  placeholder="Filtrar categorias..."
                  className="w-full pl-8 pr-7 py-1.5 text-base sm:text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                {catSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCatSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zeiq-black p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Pílulas de Filtro por Linha Esportiva */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setCatDeptFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  catDeptFilter === 'all'
                    ? 'bg-zeiq-black text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Todas</span>
                <span className="text-xs opacity-75 font-mono">({categories.length})</span>
              </button>

              {activeDepts.map((dept) => {
                const count = categories.filter((c) =>
                  dept.categoryNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
                ).length;
                const isSelected = catDeptFilter === dept.id;

                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setCatDeptFilter(isSelected ? 'all' : dept.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                      isSelected
                        ? 'bg-zeiq-black text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{dept.shortName}</span>
                    <span className="text-xs opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Resumo de Categorias Selecionadas em Destaque */}
            {selectedCategories.length > 0 && (
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Selecionadas ({selectedCategories.length}):</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryIds([])}
                    className="text-slate-400 hover:text-rose-600 transition-colors font-medium hover:underline text-xs"
                  >
                    Limpar todas
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zeiq-black text-white text-xs font-bold shadow-2xs"
                    >
                      <span>{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Grid Amplo de Categorias em Chips Táteis (Nomes Completos, Sem Cortes) */}
            <div className="max-h-60 sm:max-h-68 overflow-y-auto no-scrollbar p-1">
              {visibleCategories.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                  Nenhuma categoria encontrada para o filtro aplicado.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {visibleCategories.map((cat) => {
                    const isChecked = selectedCategoryIds.includes(cat.id);
                    const currentDept = findDepartmentForCategory(cat.name, activeDepts);

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 active:scale-98 cursor-pointer ${
                          isChecked
                            ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs font-bold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs block leading-snug break-words ${isChecked ? 'text-white font-bold' : 'text-zeiq-black font-semibold'}`}>
                            {cat.name}
                          </span>
                          {currentDept && (
                            <span className={`text-xs block mt-0.5 truncate ${isChecked ? 'text-slate-300' : 'text-slate-400'}`}>
                              {currentDept.shortName}
                            </span>
                          )}
                        </div>

                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                          isChecked
                            ? 'bg-zeiq-orange border-zeiq-orange text-zeiq-black'
                            : 'border-slate-300 bg-slate-50'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Gerenciamento de Tamanhos por Botões */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Grade de Tamanhos Disponíveis
              </label>
              <span className="text-xs text-slate-500">
                Clique nos botões para ativar/desativar
              </span>
            </div>

            {/* Grade de Roupas */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Vestuário & Roupas
              </span>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                {COMMON_SIZES.map((sz) => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleToggleSize(sz)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grade de Calçados e Chinelos */}
            <div className="mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Chinelos & Calçados
              </span>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                {['33/34', '35/36', '37/38', '39/40', '41/42', '43/44', 'P 33/36', 'M 37/40', 'G 40/44'].map((sz) => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleToggleSize(sz)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Adicionar tamanho customizado */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                placeholder="Adicionar outro tamanho (ex: G3, 38, 40)..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customSizeInput.trim() && !selectedSizes.includes(customSizeInput.trim())) {
                      const newSz = customSizeInput.trim();
                      setSelectedSizes((prev) => [...prev, newSz]);
                      setStockBySize((prev) => ({ ...prev, [newSz]: 0 }));
                      setCustomSizeInput('');
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customSizeInput.trim() && !selectedSizes.includes(customSizeInput.trim())) {
                    const newSz = customSizeInput.trim();
                    setSelectedSizes((prev) => [...prev, newSz]);
                    setStockBySize((prev) => ({ ...prev, [newSz]: 0 }));
                    setCustomSizeInput('');
                  }
                }}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Adicionar
              </button>
            </div>

            {/* CONTROLE INTERNO DE ESTOQUE */}
            {selectedSizes.length > 0 ? (
              <div className="mt-4 p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-zeiq-black text-white flex items-center justify-center shrink-0">
                      <Boxes className="w-4 h-4 text-zeiq-orange" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zeiq-black block">
                        Estoque Interno por Tamanho
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Tamanhos com estoque 0 serão bloqueados para compra na vitrine.
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border self-start sm:self-auto ${
                    totalCalculatedStock > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    Total: {totalCalculatedStock} un.
                  </span>
                </div>

                {/* Ações em Lote */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                  <span className="text-xs text-slate-500 font-medium">Ajuste rápido:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={batchStockValue}
                      onChange={(e) => setBatchStockValue(e.target.value)}
                      placeholder="Qtd..."
                      className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-center font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                    />
                    <button
                      type="button"
                      onClick={handleBatchSetStock}
                      disabled={!batchStockValue}
                      className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Definir em todos
                    </button>
                    <button
                      type="button"
                      onClick={handleZeroAllStock}
                      className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Zerar todos
                    </button>
                  </div>
                </div>

                {/* Grade de Inputs por Tamanho */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                  {selectedSizes.map((sz) => {
                    const currentQty = stockBySize[sz] ?? 0;
                    const isZero = currentQty === 0;

                    return (
                      <div
                        key={sz}
                        className={`p-2 rounded-xl border transition-all ${
                          isZero
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-zeiq-black font-mono">
                            {sz}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isZero
                              ? 'bg-rose-100 text-rose-700'
                              : currentQty <= 5
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isZero ? 'Esgotado' : `${currentQty} un.`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateStock(sz, Math.max(0, currentQty - 1))}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              handleUpdateStock(sz, isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            className="w-full text-center font-mono text-xs font-bold py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateStock(sz, currentQty + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-zeiq-black text-white flex items-center justify-center shrink-0">
                      <Boxes className="w-4 h-4 text-zeiq-orange" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zeiq-black block">
                        Estoque Geral (Produto sem variação de tamanho)
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Indicado para raquetes, capas, tubos de bolas, munhequeiras, etc.
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border self-start sm:self-auto ${
                    defaultStock > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {defaultStock > 0 ? `${defaultStock} un. em estoque` : 'Esgotado (0 un.)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 max-w-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setDefaultStock((prev) => Math.max(0, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={defaultStock}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setDefaultStock(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-24 text-center font-mono text-sm font-bold py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  <button
                    type="button"
                    onClick={() => setDefaultStock((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500 font-medium">unidades disponíveis</span>
                </div>
              </div>
            )}
          </div>

          {/* Destaques e Especificações Técnicas (até 5 tópicos opcionais) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Destaques & Especificações Técnicas (até 5 itens opcionais)
              </label>
              <span className="text-xs text-slate-400">
                Ideal para raquetes, materiais e acessórios técnicos
              </span>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {highlights.map((hl, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}.</span>
                  <input
                    type="text"
                    value={hl.label}
                    onChange={(e) => {
                      const updated = [...highlights];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setHighlights(updated);
                    }}
                    placeholder={`Rótulo (ex: ${idx === 0 ? 'Peso' : idx === 1 ? 'Comprimento' : idx === 2 ? 'Espessura' : idx === 3 ? 'Material' : 'Nível'})`}
                    className="w-1/3 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  <input
                    type="text"
                    value={hl.value}
                    onChange={(e) => {
                      const updated = [...highlights];
                      updated[idx] = { ...updated[idx], value: e.target.value };
                      setHighlights(updated);
                    }}
                    placeholder={`Valor (ex: ${idx === 0 ? '320g ± 10g' : idx === 1 ? '50cm' : idx === 2 ? '22mm' : idx === 3 ? 'Carbono 18K' : 'Avançado'})`}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Imagens & Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Imagens do Produto (Supabase Storage)
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zeiq-black hover:bg-zeiq-orange hover:text-zeiq-black text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Adicionar Imagens
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {images.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-xs text-slate-400">
                Nenhuma imagem adicionada ainda. Clique no botão acima para fazer upload.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`relative group aspect-square rounded-xl bg-white border overflow-hidden ${
                      img.is_cover ? 'border-zeiq-black ring-2 ring-zeiq-black/20 shadow-xs' : 'border-slate-200'
                    }`}
                  >
                    <img
                      src={img.public_url}
                      alt=""
                      className="w-full h-full object-cover object-top"
                    />

                    {/* Botões de Ação na Imagem */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetCover(idx)}
                        title={img.is_cover ? 'Foto principal' : 'Definir como capa'}
                        className={`p-1 rounded-lg text-xs ${
                          img.is_cover ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 hover:bg-amber-400 hover:text-white'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        title="Remover"
                        className="p-1 rounded-lg bg-white text-rose-600 hover:bg-rose-600 hover:text-white transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {img.is_cover && (
                      <span className="absolute top-1 left-1 bg-zeiq-black text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-sm">
                        Capa
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags / Palavras-chave de Busca */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Tags & Palavras-chave de Busca</span>
              <span className="text-xs text-slate-400 font-normal">Separadas por vírgula</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ex: beach tennis, raqueteira, carbono 18k, lançamento 2026..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zeiq-black"
            />
          </div>

          {/* Bloco Comercial: Disponibilidade & Visibilidade de Estoque */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="text-xs font-bold text-zeiq-black block">
                  Disponibilidade & Visibilidade de Estoque
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina se o produto está disponível para pedidos ou se deve ser pausado temporariamente por falta de estoque.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPublished(true)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-98 ${
                  isPublished
                    ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${isPublished ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-slate-300'}`} />
                  <div>
                    <span className="text-xs font-bold block text-zeiq-black">Em Estoque (Visível)</span>
                    <span className="text-xs text-slate-500 font-normal block">Ativo e disponível no catálogo dos lojistas</span>
                  </div>
                </div>
                {isPublished && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setIsPublished(false)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-98 ${
                  !isPublished
                    ? 'bg-amber-50/80 border-amber-500 text-amber-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${!isPublished ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-slate-300'}`} />
                  <div>
                    <span className="text-xs font-bold block text-zeiq-black">Sem Estoque (Oculto)</span>
                    <span className="text-xs text-slate-500 font-normal block">Pausado temporariamente da vitrine</span>
                  </div>
                </div>
                {!isPublished && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
              </button>
            </div>

            {/* Destaque Comercial */}
            <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded text-zeiq-black focus:ring-zeiq-black border-slate-300"
                />
                <span>Destacar este produto no topo da vitrine comercial (Estrela ⭐)</span>
              </label>
                {isFeatured && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Destaque Ativo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Rodapé Sólido Fixo (shrink-0) - 100% Isolado da Rolagem */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 pb-safe bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 z-20 shadow-md">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-zeiq-black hover:bg-zeiq-orange hover:text-zeiq-black text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Produto'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

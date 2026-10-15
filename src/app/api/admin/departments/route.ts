import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/admin-auth';
import { Department } from '@/lib/data/departments';
import { getDepartments, saveDepartments } from '@/lib/data/departments-server';

// GET: Retorna lista de departamentos e categorias vinculadas
export async function GET(request: NextRequest) {
  try {
    const departments = await getDepartments();
    return NextResponse.json({ success: true, departments });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Cria nova linha esportiva / departamento (ex: Corrida, Futvôlei, Treino)
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, shortName, categoryNames = [] } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nome do departamento é obrigatório.' }, { status: 400 });
    }

    const id = (shortName || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const current = await getDepartments();
    if (current.some((d) => d.id === id)) {
      return NextResponse.json({ success: false, error: 'Já existe um departamento com este identificador.' }, { status: 400 });
    }

    const newDept: Department = {
      id,
      name: name.trim(),
      shortName: (shortName || name).trim(),
      categoryNames: Array.isArray(categoryNames) ? categoryNames : [],
    };

    const updated = [...current, newDept];
    await saveDepartments(updated);

    return NextResponse.json({ success: true, department: newDept, departments: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Atualiza departamento existente ou associa categorias
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, shortName, categoryNames, moveCategory } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do departamento é obrigatório.' }, { status: 400 });
    }

    let current = await getDepartments();

    // Caso de uso rápido: Mover uma categoria específica de um departamento para outro
    if (moveCategory && moveCategory.categoryName && moveCategory.targetDepartmentId) {
      const { categoryName, targetDepartmentId } = moveCategory;

      current = current.map((d) => {
        // Remove a categoria de qualquer outro departamento
        const cleaned = d.categoryNames.filter(
          (c) => c.toLowerCase() !== categoryName.toLowerCase()
        );
        // Se for o departamento de destino, adiciona
        if (d.id === targetDepartmentId) {
          return {
            ...d,
            categoryNames: [...cleaned, categoryName],
          };
        }
        return { ...d, categoryNames: cleaned };
      });

      await saveDepartments(current);
      return NextResponse.json({ success: true, departments: current });
    }

    // Atualização normal dos dados do departamento
    const index = current.findIndex((d) => d.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Departamento não localizado.' }, { status: 404 });
    }

    current[index] = {
      ...current[index],
      name: name ? name.trim() : current[index].name,
      shortName: shortName ? shortName.trim() : current[index].shortName,
      categoryNames: Array.isArray(categoryNames) ? categoryNames : current[index].categoryNames,
    };

    await saveDepartments(current);
    return NextResponse.json({ success: true, department: current[index], departments: current });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remove departamento customizado
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID é obrigatório.' }, { status: 400 });
    }

    const current = await getDepartments();
    const filtered = current.filter((d) => d.id !== id);

    if (filtered.length === current.length) {
      return NextResponse.json({ success: false, error: 'Departamento não encontrado.' }, { status: 404 });
    }

    await saveDepartments(filtered);
    return NextResponse.json({ success: true, departments: filtered });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

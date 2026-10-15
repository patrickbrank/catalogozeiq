export interface Department {
  id: string;
  name: string;
  shortName: string;
  categoryNames: string[];
}

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'equipamentos',
    name: 'Equipamentos Esportivos',
    shortName: 'Equipamentos',
    categoryNames: [
      'Raquetes',
      'Raqueteiras/ Mochilas',
      'Bolas',
      'Redes e fitas de marcação',
      'Overgripe',
      'Óculos',
    ],
  },
  {
    id: 'vestuario-masculino',
    name: 'Vestuário Masculino',
    shortName: 'Masculino',
    categoryNames: [
      'Camiseta masculina',
      'Confecção masculina',
      'Short masculino',
      'Moletom masculino',
      'Jaqueta masculina',
      'Calças masculinas',
    ],
  },
  {
    id: 'vestuario-feminino',
    name: 'Vestuário Feminino',
    shortName: 'Feminino',
    categoryNames: [
      'Top feminino',
      'Short feminino',
      'Cropped feminino',
      'Regata feminina',
      'Baby look feminina',
      'Saia feminina',
      'Calça feminina',
      'Vestido feminino',
      'Moletom feminino',
      'Jaqueta feminina',
      'Macaquinho',
    ],
  },
  {
    id: 'acessorios',
    name: 'Acessórios & Linha Geral',
    shortName: 'Acessórios',
    categoryNames: [
      'Boné e viseira',
      'Garrafa e Copo térmico',
      'Manguito',
      'Munhequeira',
      'Head band',
      'Chinelo',
      'Sapatilha',
      'Meia',
      'Necessaire',
      'Pulseiras',
      'Infantil',
    ],
  },
];

export const DEPARTMENTS: Department[] = DEFAULT_DEPARTMENTS;

export function findDepartmentForCategory(
  categoryNameOrSlug: string,
  depts: Department[] = DEFAULT_DEPARTMENTS
): Department | undefined {
  const norm = categoryNameOrSlug.toLowerCase().trim();
  return depts.find((dept) =>
    dept.categoryNames.some(
      (c) =>
        c.toLowerCase() === norm ||
        c
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-') === norm
    )
  );
}

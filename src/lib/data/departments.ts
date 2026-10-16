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
      'Bolas',
      'Overgripe',
      'Raqueteiras/ Mochilas',
      'Raquetes',
      'Redes e fitas de marcação',
    ],
  },
  {
    id: 'vestuario-feminino',
    name: 'Vestuário Feminino',
    shortName: 'Feminino',
    categoryNames: [
      'Baby look feminina',
      'Calça feminina',
      'Cropped feminino',
      'Jaqueta feminina',
      'Macaquinho',
      'Moletom feminino',
      'Regata feminina',
      'Saia feminina',
      'Short feminino',
      'Top feminino',
      'Vestido feminino',
    ],
  },
  {
    id: 'vestuario-masculino',
    name: 'Vestuário Masculino',
    shortName: 'Masculino',
    categoryNames: [
      'Calças masculinas',
      'Camiseta masculina',
      'Confecção masculina',
      'Jaqueta masculina',
      'Moletom masculino',
      'Short masculino',
    ],
  },
  {
    id: 'vestuario-infantil',
    name: 'Vestuário Infantil',
    shortName: 'Infantil',
    categoryNames: [
      'Infantil',
    ],
  },
  {
    id: 'acessorios',
    name: 'Acessórios',
    shortName: 'Acessórios',
    categoryNames: [
      'Boné e viseira',
      'Chinelo',
      'Garrafa e Copo térmico',
      'Head band',
      'Manguito',
      'Meia',
      'Munhequeira',
      'Necessaire',
      'Óculos',
      'Pulseiras',
      'Sapatilha',
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

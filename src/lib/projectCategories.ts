export type CategoryFilterId = 'all' | 'web' | 'solar';

export interface CategoryOption {
  id: CategoryFilterId;
  labelKey: string;
  defaultLabel: string;
  categoryName?: 'Web Development' | 'Solar Energy';
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'all',
    labelKey: 'projects.filter_all',
    defaultLabel: 'All Projects'
  },
  {
    id: 'web',
    labelKey: 'projects.filter_web',
    defaultLabel: 'Web Development',
    categoryName: 'Web Development'
  },
  {
    id: 'solar',
    labelKey: 'projects.filter_solar',
    defaultLabel: 'Solar Energy',
    categoryName: 'Solar Energy'
  }
];

export function getProjectCategory(project: any): 'Web Development' | 'Solar Energy' {
  if (project?.category) {
    const raw = String(project.category).trim().toLowerCase();
    if (
      raw.includes('solar') ||
      raw.includes('electrical') ||
      raw.includes('energy') ||
      raw.includes('pv') ||
      raw.includes('battery')
    ) {
      return 'Solar Energy';
    }
    return 'Web Development';
  }

  const textToScan = [
    project?.title || '',
    project?.slug || '',
    project?.description || '',
    project?.long_description || project?.longDescription || '',
    ...(Array.isArray(project?.tech_stack) ? project.tech_stack : []),
    ...(Array.isArray(project?.tags) ? project.tags : []),
    ...(Array.isArray(project?.techStack) ? project.techStack : [])
  ]
    .join(' ')
    .toLowerCase();

  if (
    textToScan.includes('solar') ||
    textToScan.includes('electrical') ||
    textToScan.includes('photovoltaic') ||
    textToScan.includes('inverter') ||
    textToScan.includes('battery storage') ||
    textToScan.includes('lifepo4') ||
    textToScan.includes('renewable') ||
    textToScan.includes('microgrid') ||
    textToScan.includes('crouchend')
  ) {
    return 'Solar Energy';
  }

  return 'Web Development';
}

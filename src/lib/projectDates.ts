export interface ProjectDates {
  startDate?: string;
  completionDate?: string;
  formattedRange: string;
}

const DEFAULT_DATES_BY_KEY: Record<string, { start: string; completion: string }> = {
  'azure-hotel': { start: 'Jan 2024', completion: 'Apr 2024' },
  'luxury-hotel': { start: 'Jan 2024', completion: 'Apr 2024' },
  'hotel-booking': { start: 'Aug 2023', completion: 'Dec 2023' },
  'h-orizon-hotel': { start: 'Aug 2023', completion: 'Nov 2023' },
  'residential-solar-storage': { start: 'Mar 2024', completion: 'May 2024' },
  'commercial-solar-microgrid': { start: 'Sep 2023', completion: 'Jan 2024' },
  'crouchend-electrical': { start: 'Oct 2023', completion: 'Dec 2023' },
  'salon-website': { start: 'May 2023', completion: 'Jul 2023' },
  'lamasat-salon': { start: 'May 2023', completion: 'Aug 2023' },
  'daqn-plus': { start: 'Feb 2023', completion: 'Jun 2023' },
  'car-rental': { start: 'Jan 2023', completion: 'Apr 2023' },
  'val-car': { start: 'Jan 2023', completion: 'Apr 2023' },
  'mechanic': { start: 'Nov 2022', completion: 'Jan 2023' },
  'fashion-designer': { start: 'Jun 2022', completion: 'Sep 2022' }
};

export function getProjectDates(project: any): ProjectDates {
  const key = (project?.slug || project?.id || '').toLowerCase();
  const fallback = DEFAULT_DATES_BY_KEY[key] || { start: '2023', completion: '2024' };

  const rawStart = project?.start_date || project?.startDate;
  const rawCompletion = project?.completion_date || project?.completionDate;

  const startDate = rawStart && String(rawStart).trim() ? String(rawStart).trim() : fallback.start;
  const completionDate = rawCompletion && String(rawCompletion).trim() ? String(rawCompletion).trim() : fallback.completion;

  let formattedRange = '';
  if (startDate && completionDate && startDate !== completionDate) {
    formattedRange = `${startDate} – ${completionDate}`;
  } else if (completionDate) {
    formattedRange = completionDate;
  } else if (startDate) {
    formattedRange = startDate;
  }

  return {
    startDate,
    completionDate,
    formattedRange
  };
}

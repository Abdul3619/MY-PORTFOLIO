// Projects with these statuses are live on the public site; Draft and Archived stay private.
export const PUBLIC_PROJECT_STATUSES = ['Published', 'Completed'];

export const isPublicProject = (project: { status?: string | null } | null | undefined) =>
  !!project && PUBLIC_PROJECT_STATUSES.includes(project.status ?? '');

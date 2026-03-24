export type ProjectManagementListItem = {
  id: number
  name: string
  projectKey: string
  description: string | null
  isEnabled: boolean
  createdAt: string
}

export type ProjectManagementStatusFilter = 'all' | 'enabled' | 'disabled'
export type ProjectManagementSortOption = 'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc'

type ProjectManagementListOptions = {
  keyword: string
  status: ProjectManagementStatusFilter
  sortBy: ProjectManagementSortOption
}

type ProjectManagementPageOptions = ProjectManagementListOptions & {
  page: number
  pageSize: number
}

function compareString(left: string, right: string) {
  return left.localeCompare(right, 'zh-CN')
}

function normalizePositiveInteger(value: number, fallback: number) {
  const normalizedValue = Math.floor(value)

  if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
    return fallback
  }

  return normalizedValue
}

export function filterAndSortProjects(
  projects: ProjectManagementListItem[],
  options: ProjectManagementListOptions,
) {
  const keyword = options.keyword.trim().toLowerCase()

  return [...projects]
    .filter((project) => {
      const matchesKeyword =
        !keyword ||
        project.name.toLowerCase().includes(keyword) ||
        project.projectKey.toLowerCase().includes(keyword) ||
        (project.description || '').toLowerCase().includes(keyword)

      const matchesStatus =
        options.status === 'all' ||
        (options.status === 'enabled' && project.isEnabled) ||
        (options.status === 'disabled' && !project.isEnabled)

      return matchesKeyword && matchesStatus
    })
    .sort((left, right) => {
      if (options.sortBy === 'createdAtAsc') {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      }

      if (options.sortBy === 'nameAsc') {
        return compareString(left.name, right.name)
      }

      if (options.sortBy === 'nameDesc') {
        return compareString(right.name, left.name)
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
}

export function buildProjectManagementPage(
  projects: ProjectManagementListItem[],
  options: ProjectManagementPageOptions,
) {
  const filteredProjects = filterAndSortProjects(projects, options)
  const pageSize = normalizePositiveInteger(options.pageSize, 10)
  const totalItems = filteredProjects.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(normalizePositiveInteger(options.page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize

  return {
    items: filteredProjects.slice(startIndex, startIndex + pageSize),
    totalItems,
    totalPages,
    currentPage,
    pageSize,
  }
}

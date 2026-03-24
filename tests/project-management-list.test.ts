import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProjectManagementPage,
  filterAndSortProjects,
  type ProjectManagementListItem,
} from '../src/lib/project-management-list'

const projects: ProjectManagementListItem[] = [
  {
    id: 1,
    name: '默认项目',
    projectKey: 'default',
    description: '系统兼容默认项目',
    isEnabled: true,
    createdAt: '2026-03-20T08:00:00.000Z',
  },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    description: 'Chrome 插件项目',
    isEnabled: true,
    createdAt: '2026-03-22T08:00:00.000Z',
  },
  {
    id: 3,
    name: '桌面客户端',
    projectKey: 'desktop-client',
    description: 'Electron 客户端',
    isEnabled: false,
    createdAt: '2026-03-24T08:00:00.000Z',
  },
]

const moreProjects: ProjectManagementListItem[] = [
  {
    id: 11,
    name: 'Alpha',
    projectKey: 'alpha',
    description: 'alpha project',
    isEnabled: true,
    createdAt: '2026-03-20T08:00:00.000Z',
  },
  {
    id: 12,
    name: 'Beta',
    projectKey: 'beta',
    description: 'beta project',
    isEnabled: true,
    createdAt: '2026-03-21T08:00:00.000Z',
  },
  {
    id: 13,
    name: 'Gamma',
    projectKey: 'gamma',
    description: 'gamma project',
    isEnabled: false,
    createdAt: '2026-03-22T08:00:00.000Z',
  },
  {
    id: 14,
    name: 'Delta',
    projectKey: 'delta',
    description: 'delta project',
    isEnabled: true,
    createdAt: '2026-03-23T08:00:00.000Z',
  },
  {
    id: 15,
    name: 'Epsilon',
    projectKey: 'epsilon',
    description: 'epsilon project',
    isEnabled: false,
    createdAt: '2026-03-24T08:00:00.000Z',
  },
]

test('filterAndSortProjects 会按关键字搜索名称、项目标识和描述', () => {
  const filtered = filterAndSortProjects(projects, {
    keyword: '  chrome  ',
    status: 'all',
    sortBy: 'createdAtDesc',
  })

  assert.deepEqual(
    filtered.map((project) => project.projectKey),
    ['browser-plugin'],
  )
})

test('filterAndSortProjects 会按启用状态过滤项目', () => {
  const filtered = filterAndSortProjects(projects, {
    keyword: '',
    status: 'disabled',
    sortBy: 'createdAtDesc',
  })

  assert.deepEqual(
    filtered.map((project) => project.projectKey),
    ['desktop-client'],
  )
})

test('filterAndSortProjects 支持按项目名称升序排序', () => {
  const filtered = filterAndSortProjects(projects, {
    keyword: '',
    status: 'all',
    sortBy: 'nameAsc',
  })

  assert.deepEqual(
    filtered.map((project) => project.projectKey),
    ['browser-plugin', 'default', 'desktop-client'],
  )
})

test('buildProjectManagementPage 会在搜索、状态筛选、排序后再分页', () => {
  const page = buildProjectManagementPage(moreProjects, {
    keyword: 'a',
    status: 'enabled',
    sortBy: 'nameAsc',
    page: 2,
    pageSize: 2,
  })

  assert.equal(page.totalItems, 3)
  assert.equal(page.totalPages, 2)
  assert.equal(page.currentPage, 2)
  assert.deepEqual(
    page.items.map((project) => project.projectKey),
    ['delta'],
  )
})

test('buildProjectManagementPage 会将越界页码钳制到最后一页', () => {
  const page = buildProjectManagementPage(moreProjects, {
    keyword: '',
    status: 'all',
    sortBy: 'nameAsc',
    page: 99,
    pageSize: 2,
  })

  assert.equal(page.totalItems, 5)
  assert.equal(page.totalPages, 3)
  assert.equal(page.currentPage, 3)
  assert.deepEqual(
    page.items.map((project) => project.projectKey),
    ['gamma'],
  )
})

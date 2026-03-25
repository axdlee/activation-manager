import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ProjectWorkspace } from '../src/components/project-workspace'
import { buildProjectManagementPage, type ProjectManagementListItem } from '../src/lib/project-management-list'

const projects: ProjectManagementListItem[] = [
  {
    id: 1,
    name: '默认项目',
    projectKey: 'default',
    description: '系统默认项目',
    isEnabled: true,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    description: '浏览器插件授权',
    isEnabled: false,
    createdAt: '2026-03-10T00:00:00.000Z',
  },
]

function createManageView(overrides: Partial<React.ComponentProps<typeof ProjectWorkspace>['manageView']> = {}) {
  return {
    totalProjects: projects.length,
    searchTerm: '',
    statusFilter: 'all' as const,
    sortBy: 'createdAtDesc' as const,
    page: buildProjectManagementPage(projects, {
      keyword: '',
      status: 'all',
      sortBy: 'createdAtDesc',
      page: 1,
      pageSize: 10,
    }),
    startIndex: 1,
    endIndex: 2,
    getProjectNameDraft: (project: ProjectManagementListItem) => project.name,
    getProjectDescriptionDraft: (project: ProjectManagementListItem) => project.description || '',
    hasProjectNameChanged: () => false,
    hasProjectDescriptionChanged: () => false,
    onSearchTermChange: () => {},
    onStatusFilterChange: () => {},
    onSortByChange: () => {},
    onPageChange: () => {},
    onProjectNameChange: () => {},
    onProjectDescriptionChange: () => {},
    onCopyProjectKey: () => {},
    onSaveProjectName: () => {},
    onSaveProjectDescription: () => {},
    onToggleProjectStatus: () => {},
    onDeleteProject: () => {},
    ...overrides,
  }
}

function createProps(overrides: Partial<React.ComponentProps<typeof ProjectWorkspace>> = {}) {
  return {
    activeTab: 'create' as const,
    loading: false,
    enabledProjectsCount: 1,
    disabledProjectsCount: 1,
    compactInputClassName: 'input-class',
    panelClassName: 'panel-class',
    workspaceSummaryCardClassName: 'metric-class',
    primaryButtonClassName: 'primary-button',
    paginationButtonClassName: 'page-button',
    paginationActiveButtonClassName: 'page-button-active',
    createForm: {
      name: '',
      projectKey: '',
      description: '',
      onSubmit: () => {},
      onNameChange: () => {},
      onProjectKeyChange: () => {},
      onDescriptionChange: () => {},
    },
    manageView: createManageView(),
    onTabChange: () => {},
    ...overrides,
  }
}

test('ProjectWorkspace 在 create tab 渲染项目工作区头部与新建表单', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectWorkspace, createProps()))

  assert.equal(html.includes('项目管理中心'), true)
  assert.equal(html.includes('项目工作区'), true)
  assert.equal(html.includes('新建项目'), true)
  assert.equal(html.includes('项目标识，例如 browser-plugin'), true)
  assert.equal(html.includes('创建项目'), true)
  assert.equal(html.includes('browser-plugin'), true)
})

test('ProjectWorkspace 在 manage tab 渲染筛选、分页与空状态提示', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectWorkspace,
      createProps({
        activeTab: 'manage',
        manageView: createManageView({
          searchTerm: 'no-match',
          page: buildProjectManagementPage(projects, {
            keyword: 'no-match',
            status: 'all',
            sortBy: 'createdAtDesc',
            page: 1,
            pageSize: 10,
          }),
          startIndex: 0,
          endIndex: 0,
        }),
      }),
    ),
  )

  assert.equal(html.includes('项目列表'), true)
  assert.equal(html.includes('搜索项目'), true)
  assert.equal(html.includes('状态筛选'), true)
  assert.equal(html.includes('排序方式'), true)
  assert.equal(html.includes('默认项目名称固定，且不可停用'), true)
  assert.equal(html.includes('显示第 0 - 0 条，共 0 条记录'), true)
  assert.equal(html.includes('暂无匹配的项目'), true)
})

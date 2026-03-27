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
    allowAutoRebind: null,
    autoRebindCooldownMinutes: null,
    autoRebindMaxCount: null,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: '浏览器插件',
    projectKey: 'browser-plugin',
    description: '浏览器插件授权',
    isEnabled: false,
    allowAutoRebind: true,
    autoRebindCooldownMinutes: 180,
    autoRebindMaxCount: 2,
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
    getProjectRebindPolicyDraft: (project: ProjectManagementListItem) =>
      project.allowAutoRebind === true ? 'enabled' : project.allowAutoRebind === false ? 'disabled' : 'inherit',
    getProjectRebindCooldownMinutesDraft: (project: ProjectManagementListItem) =>
      project.autoRebindCooldownMinutes === null ? '' : String(project.autoRebindCooldownMinutes),
    getProjectRebindMaxCountDraft: (project: ProjectManagementListItem) =>
      project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount),
    hasProjectNameChanged: () => false,
    hasProjectDescriptionChanged: () => false,
    hasProjectRebindSettingsChanged: () => false,
    onSearchTermChange: () => {},
    onStatusFilterChange: () => {},
    onSortByChange: () => {},
    onPageChange: () => {},
    onProjectNameChange: () => {},
    onProjectDescriptionChange: () => {},
    onProjectRebindPolicyChange: () => {},
    onProjectRebindCooldownMinutesChange: () => {},
    onProjectRebindMaxCountChange: () => {},
    onCopyProjectKey: () => {},
    onSaveProjectName: () => {},
    onSaveProjectDescription: () => {},
    onSaveProjectRebindSettings: () => {},
    onToggleProjectStatus: () => {},
    onDeleteProject: () => {},
    ...overrides,
  }
}

function createProps(overrides: Partial<React.ComponentProps<typeof ProjectWorkspace>> = {}) {
  return {
    activeTab: 'manage' as const,
    loading: false,
    enabledProjectsCount: 1,
    disabledProjectsCount: 1,
    compactInputClassName: 'input-class',
    panelClassName: 'panel-class',
    workspaceSummaryCardClassName: 'metric-class',
    primaryButtonClassName: 'primary-button',
    ghostButtonClassName: 'ghost-button',
    paginationButtonClassName: 'page-button',
    paginationActiveButtonClassName: 'page-button-active',
    createForm: {
      name: '',
      projectKey: '',
      description: '',
      rebindPolicyValue: 'inherit',
      rebindCooldownMinutesValue: '',
      rebindMaxCountValue: '',
      onSubmit: () => {},
      onNameChange: () => {},
      onProjectKeyChange: () => {},
      onDescriptionChange: () => {},
      onRebindPolicyChange: () => {},
      onRebindCooldownMinutesChange: () => {},
      onRebindMaxCountChange: () => {},
    },
    manageView: createManageView(),
    onTabChange: () => {},
    ...overrides,
  }
}

test('ProjectWorkspace 在 create 模式下通过弹框渲染新建表单与换绑默认策略', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectWorkspace,
      createProps({
        activeTab: 'create',
      }),
    ),
  )

  assert.equal(html.includes('项目管理中心'), true)
  assert.equal(html.includes('项目工作区'), true)
  assert.equal(html.includes('新建项目'), true)
  assert.equal(html.includes('用弹框快速创建新的 projectKey'), true)
  assert.equal(html.includes('基础信息'), true)
  assert.equal(html.includes('策略设置'), true)
  assert.equal(html.includes('项目标识，例如 browser-plugin'), true)
  assert.equal(html.includes('项目级自助换绑策略'), true)
  assert.equal(html.includes('继承系统级策略'), true)
  assert.equal(html.includes('项目级换绑冷却时间（分钟）'), true)
  assert.equal(html.includes('留空则继承系统级策略'), true)
  assert.equal(html.includes('项目级自助换绑次数上限'), true)
  assert.equal(html.includes('0 表示不限制；留空则继承系统级策略'), true)
  assert.equal(html.includes('创建项目'), true)
  assert.equal(html.includes('browser-plugin'), true)
})

test('ProjectWorkspace 在 manage tab 渲染只读列表、创建弹框入口与空状态提示', () => {
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
  assert.equal(html.includes('列表只保留关键字段，所有编辑都改为弹框完成。'), true)
  assert.equal(html.includes('换绑策略'), true)
  assert.equal(html.includes('默认项目名称固定，且不可停用'), true)
  assert.equal(html.includes('新建项目'), true)
  assert.equal(html.match(/>新建项目</g)?.length ?? 0, 1)
  assert.equal(html.includes('显示第 0 - 0 条，共 0 条记录'), true)
  assert.equal(html.includes('暂无匹配的项目'), true)
  assert.equal(html.includes('编辑基础信息'), false)
  assert.equal(html.includes('保存换绑策略'), false)
})

test('ProjectWorkspace 在 manage tab 会渲染只读字段与弹框操作按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectWorkspace,
      createProps({
        activeTab: 'manage',
      }),
    ),
  )

  assert.equal(html.includes('复制标识'), true)
  assert.equal(html.includes('编辑基础信息'), true)
  assert.equal(html.includes('编辑换绑策略'), true)
  assert.equal(html.includes('项目级自助换绑策略：允许自助换绑'), true)
  assert.equal(html.includes('项目级换绑冷却时间：3 小时'), true)
  assert.equal(html.includes('项目级自助换绑次数上限：2 次'), true)
  assert.equal(html.includes('浏览器插件授权'), true)
  assert.equal(html.includes('默认项目不可停用，也不可删除。'), true)
  assert.equal(html.includes('保存基础信息'), false)
  assert.equal(html.includes('保存换绑策略'), false)
})

test('ProjectWorkspace 在 manage tab 默认不直接渲染新建项目弹框内容', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectWorkspace, createProps()))

  assert.equal(html.includes('用弹框快速创建新的 projectKey'), false)
  assert.equal(html.includes('保存名称'), false)
  assert.equal(html.includes('保存描述'), false)
})

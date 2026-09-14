import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  ADMIN_PROJECTS_DEFAULT_FILTER_STATE,
  buildAdminProjectsFilterQuery,
  parseAdminProjectsFilterQuery,
} from '../src/lib/admin-projects-query'
import { ProjectsPage } from '../src/components/admin/projects-page'
import { ProjectCreateDialog } from '../src/components/admin/project-create-dialog'
import { ProjectDetailDrawer } from '../src/components/admin/project-detail-drawer'
import {
  buildProjectManagementPage,
  type ProjectManagementListItem,
} from '../src/lib/project-management-list'

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

// ── 筛选 query（URL 可分享）────────────────────────────────

test('admin-projects-query：默认状态构建为空 query', () => {
  assert.equal(buildAdminProjectsFilterQuery(ADMIN_PROJECTS_DEFAULT_FILTER_STATE), '')
})

test('admin-projects-query：解析与构建往返一致', () => {
  const query = buildAdminProjectsFilterQuery({
    keyword: '插件',
    status: 'enabled',
    sortBy: 'nameAsc',
    page: 3,
  })
  assert.match(query, /keyword=/)
  assert.match(query, /status=enabled/)
  assert.match(query, /sort=nameAsc/)
  assert.match(query, /page=3/)

  const parsed = parseAdminProjectsFilterQuery(new URLSearchParams(query))
  assert.deepEqual(parsed, { keyword: '插件', status: 'enabled', sortBy: 'nameAsc', page: 3 })
})

test('admin-projects-query：非法值回退默认（未知 status/sort、page<1）', () => {
  const parsed = parseAdminProjectsFilterQuery(
    new URLSearchParams('status=weird&sort=weird&page=0&keyword='),
  )
  assert.deepEqual(parsed, { keyword: '', status: 'all', sortBy: 'createdAtDesc', page: 1 })
})

test('admin-projects-query：空 query 解析为默认状态', () => {
  assert.deepEqual(parseAdminProjectsFilterQuery(new URLSearchParams('')), {
    ...ADMIN_PROJECTS_DEFAULT_FILTER_STATE,
  })
})

// ── 页面渲染：列表优先 ────────────────────────────────────

function createPageProps() {
  const page = buildProjectManagementPage(projects, {
    keyword: '',
    status: 'all',
    sortBy: 'createdAtDesc',
    page: 1,
    pageSize: 10,
  })
  return {
    loading: false,
    error: null as string | null,
    onRetry: undefined as (() => void) | undefined,
    summary: { total: 2, enabled: 1, disabled: 1 },
    filters: { keyword: '', status: 'all' as const, sortBy: 'createdAtDesc' as const, page: 1 },
    onFiltersChange: () => {},
    pagination: {
      currentPage: page.currentPage,
      totalPages: page.totalPages,
      totalItems: page.totalItems,
      startIndex: 1,
      endIndex: page.items.length,
    },
    onPageChange: () => {},
    items: page.items,
    createForm: {
      values: {
        name: '',
        projectKey: '',
        description: '',
        rebindPolicyValue: 'inherit',
        rebindCooldownMinutesValue: '',
        rebindMaxCountValue: '',
      },
      onValueChange: () => {},
      onSubmit: () => {},
    },
    basics: {
      getDraft: (project: ProjectManagementListItem) => ({
        name: project.name,
        description: project.description || '',
      }),
      onDraftChange: () => {},
      isDirty: () => false,
      save: () => {},
    },
    policy: {
      getDraft: (project: ProjectManagementListItem) => ({
        policyValue:
          project.allowAutoRebind === true
            ? 'enabled'
            : project.allowAutoRebind === false
              ? 'disabled'
              : 'inherit',
        cooldownValue:
          project.autoRebindCooldownMinutes === null
            ? ''
            : String(project.autoRebindCooldownMinutes),
        maxCountValue:
          project.autoRebindMaxCount === null ? '' : String(project.autoRebindMaxCount),
      }),
      onDraftChange: () => {},
      isDirty: () => false,
      save: () => {},
    },
    onCopyProjectKey: () => {},
    onToggleStatusRequest: () => {},
    onDeleteRequest: () => {},
  }
}

test('ProjectsPage：列表优先——单 h1、表格行、工具栏筛选、分页摘要', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectsPage, createPageProps()))

  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /新建项目/)
  assert.match(html, /<table/)
  assert.match(html, /浏览器插件/)
  assert.match(html, /browser-plugin/)
  assert.match(html, /已停用/)
  // 工具栏合并为一行：搜索 + 状态 + 排序
  assert.match(html, /role="toolbar"/)
  assert.match(html, /aria-label="搜索项目"/)
  assert.match(html, /aria-label="状态筛选"/)
  assert.match(html, /aria-label="排序方式"/)
  // 分页摘要
  assert.match(html, /共 2 条/)
})

test('ProjectsPage：空列表展示 EmptyState 且保留新建入口', () => {
  const props = createPageProps()
  props.items = []
  props.pagination = { ...props.pagination, totalItems: 0, totalPages: 1, startIndex: 0, endIndex: 0 }
  const html = renderToStaticMarkup(React.createElement(ProjectsPage, props))

  assert.match(html, /还没有项目/)
  assert.match(html, /新建项目/)
})

test('ProjectsPage：默认项目用辅助文案说明不可停用，不占整行', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectsPage, createPageProps()))
  assert.match(html, /默认项目不可停用/)
})

test('ProjectsPage：错误态保留列表并提供重试', () => {
  const props = createPageProps()
  props.error = '网络错误'
  props.onRetry = () => {}
  const html = renderToStaticMarkup(React.createElement(ProjectsPage, props))
  assert.match(html, /role="alert"/)
  assert.match(html, /重试/)
  assert.match(html, /browser-plugin/)
})

// ── 创建 / 基础编辑共用 Dialog ─────────────────────────────

function createDialogProps(
  overrides: Partial<React.ComponentProps<typeof ProjectCreateDialog>> = {},
) {
  return {
    open: true,
    onOpenChange: () => {},
    loading: false,
    mode: 'create' as const,
    values: {
      name: '',
      projectKey: '',
      description: '',
      rebindPolicyValue: 'inherit',
      rebindCooldownMinutesValue: '',
      rebindMaxCountValue: '',
    },
    onValueChange: () => {},
    onSubmit: () => {},
    editingProject: null,
    basicsDirty: false,
    onSaveBasics: () => {},
    onCopyProjectKey: () => {},
    ...overrides,
  }
}

test('ProjectCreateDialog：create 模式表单语义完整（id/pattern/必填）', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectCreateDialog, createDialogProps()))

  assert.match(html, /id="create-project-form"/)
  assert.match(html, /id="create-project-name"/)
  assert.match(html, /id="create-project-key"/)
  assert.match(html, /id="create-project-description"/)
  assert.match(html, /type="submit" form="create-project-form"|form="create-project-form" type="submit"/)
  // 高级换绑策略默认字段存在
  assert.match(html, /id="create-project-rebind-policy"/)
  assert.match(html, /id="create-project-rebind-cooldown"/)
  assert.match(html, /id="create-project-rebind-max-count"/)
  // 不写实现说明文案
  assert.doesNotMatch(html, /更圆润/)
})

test('ProjectCreateDialog：edit-basics 模式复用表单且 pristine 时保存禁用', () => {
  const editing = projects[1]
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectCreateDialog,
      createDialogProps({
        mode: 'edit-basics',
        editingProject: editing,
        values: {
          name: editing.name,
          projectKey: editing.projectKey,
          description: editing.description || '',
          rebindPolicyValue: 'inherit',
          rebindCooldownMinutesValue: '',
          rebindMaxCountValue: '',
        },
        basicsDirty: false,
      }),
    ),
  )

  assert.match(html, /id="project-modal-name"/)
  assert.match(html, /编辑基础信息/)
  assert.match(html, /保存基础信息/)
  assert.match(html, /disabled/)
})

test('ProjectCreateDialog：dirty 时保存基础信息可用', () => {
  const editing = projects[1]
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectCreateDialog,
      createDialogProps({
        mode: 'edit-basics',
        editingProject: editing,
        values: {
          name: `${editing.name}改`,
          projectKey: editing.projectKey,
          description: editing.description || '',
          rebindPolicyValue: 'inherit',
          rebindCooldownMinutesValue: '',
          rebindMaxCountValue: '',
        },
        basicsDirty: true,
      }),
    ),
  )

  const saveArea = html.slice(html.indexOf('保存基础信息') - 400, html.indexOf('保存基础信息') + 40)
  assert.doesNotMatch(saveArea, /disabled=""/)
})

test('ProjectCreateDialog：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProjectCreateDialog, createDialogProps({ open: false })),
  )
  assert.equal(html, '')
})

// ── 项目详情 Drawer：策略 section + 危险操作 ────────────────

function createDrawerProps(
  overrides: Partial<React.ComponentProps<typeof ProjectDetailDrawer>> = {},
) {
  return {
    open: true,
    onOpenChange: () => {},
    project: projects[1],
    policyDraft: { policyValue: 'enabled', cooldownValue: '180', maxCountValue: '2' },
    onPolicyDraftChange: () => {},
    policyDirty: false,
    loading: false,
    onSavePolicy: () => {},
    onCopyProjectKey: () => {},
    onEditBasics: () => {},
    onToggleStatusRequest: () => {},
    onDeleteRequest: () => {},
    ...overrides,
  }
}

test('ProjectDetailDrawer：dialog 语义 + 策略分区 + 危险操作入口', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ProjectDetailDrawer,
      createDrawerProps({ project: { ...projects[1], isEnabled: true } }),
    ),
  )

  assert.match(html, /role="dialog"/)
  assert.match(html, /浏览器插件/)
  assert.match(html, /换绑策略/)
  assert.match(html, /id="project-detail-rebind-policy"/)
  assert.match(html, /复制标识/)
  assert.match(html, /编辑基础信息/)
  assert.match(html, /停用项目/)
  assert.match(html, /删除项目/)
})

test('ProjectDetailDrawer：默认项目隐藏停用入口并给出原因', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProjectDetailDrawer, createDrawerProps({ project: projects[0] })),
  )

  assert.doesNotMatch(html, /停用项目/)
  assert.match(html, /默认项目不可停用/)
})

test('ProjectDetailDrawer：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProjectDetailDrawer, createDrawerProps({ open: false })),
  )
  assert.equal(html, '')
})
